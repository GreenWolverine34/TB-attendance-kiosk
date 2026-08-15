import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse";
import { WebClient } from "@slack/web-api";
import { App as SlackApp } from "@slack/bolt";
import schedule from "node-schedule";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import "dotenv/config";

import {
  generateAttendanceReport,
  generateCheckinData,
  generateMeetingReport,
  getCurrentAttendance,
  getStatsForDate,
  MEETING_THRESHOLD,
} from "./report";
import { sendReportEmail } from "./email";
import { uploadReportsToSheet } from "./sheets";
import { toISOString, getTimestampedFilename, getToday, getStartDate } from "./util";
import { EnabledActions } from "./types";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require("electron-squirrel-startup")) {
  app.quit();
}

const DB_PATH = path.join(app.getPath("userData"), "data.db");

// SECURED CREDENTIAL FALLBACKS: Removed hardcoded cleartext string pin keys
const KIOSK_PIN = process.env.ATTENDANCE_KIOSK_PIN;
const EXPORT_PIN = process.env.ATTENDANCE_EXPORT_PIN;

let dbInstance: Database | null = null;
let mainWindow: BrowserWindow | null = null;

async function initDB(): Promise<Database> {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.cached.Database,
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS student (
      idNumber TEXT PRIMARY KEY,
      firstName TEXT,
      lastName TEXT,
      slackId TEXT
    )
  `);

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS checkin (
      timestamp TEXT,
      idNumber TEXT
    )
  `);

  return dbInstance;
}

async function archiveAndClearAttendance(db: Database) {
  // Determine the oldest attendance record
  const oldest = await db.get<{ oldestDate: string | null }>(`
    SELECT MIN(date(timestamp)) AS oldestDate
    FROM checkin
  `);

  // Nothing to archive
  if (!oldest?.oldestDate) {
    return;
  }

  const today = getToday();

  // Generate ALL historical attendance data
  const checkinData = await generateCheckinData(
    db,
    oldest.oldestDate,
    today,
    MEETING_THRESHOLD
  );

  // Upload to Google Sheets FIRST
  await uploadReportsToSheet(checkinData);

  // Only delete if Google Sheets upload succeeded
  await db.run("DELETE FROM checkin");
}

async function syncAllAttendanceToGoogleSheets(db: Database) {
  const oldestRecord = await db.get<{ oldestDate: string | null }>(`
    SELECT MIN(date(timestamp)) AS oldestDate
    FROM checkin
  `);

  if (!oldestRecord?.oldestDate) {
    console.log("Google Sheets sync: no attendance data to upload.");
    return;
  }

  const today = getToday();

  const checkinData = await generateCheckinData(
    db,
    oldestRecord.oldestDate,
    today,
    MEETING_THRESHOLD
  );

  await uploadReportsToSheet(checkinData);

  console.log(
    `Google Sheets sync complete: ${oldestRecord.oldestDate} through ${today}.`
  );
}

// Initialize Slack Bolt Application
const slackBotToken = process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN;
const slackAppToken = process.env.SLACK_APP_TOKEN;

let slackClient: WebClient | null = null;
if (slackBotToken) {
  slackClient = new WebClient(slackBotToken);
}

let slackBot: SlackApp | null = null;
if (slackBotToken && slackAppToken) {
  slackBot = new SlackApp({
    token: slackBotToken,
    appToken: slackAppToken,
    socketMode: true,
  });

  // File: src/index.ts (Inside slackBot.command("/attendance", ...))

  slackBot.command("/attendance", async ({ ack, respond, command }) => {
    await ack();

    try {
      const db = await initDB();
      const param = (command.text || "").trim().toLowerCase();

      if (param === "help") {
        await respond({
          response_type: "ephemeral",
          text:
            `ℹ️ *Attendance Command Usage:*\n` +
            `• \`/attendance\` or \`/attendance status\` — View currently checked-in attendees\n` +
            `• \`/attendance close\` — Close session and check everyone out`,
        });
        return;
      }

      const currentAttendance = await getCurrentAttendance(db, getToday());

      if (currentAttendance.length === 0) {
        await respond({
          response_type: "in_channel",
          text: "⚠️ No users are currently checked in.",
        });
        return;
      }

      const now = new Date();
      const nowISO = toISOString(now);

      const attendeeLines = currentAttendance.map((attendee: any) => {
        const checkInTime = new Date(attendee.checkinTime || attendee.timestamp);
        const diffMs = now.getTime() - checkInTime.getTime();
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const timeSpent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        const fullName = `${attendee.firstName} ${attendee.lastName}`;

        const slackHandle = attendee.slackId
          ? ` (@${attendee.slackId.replace(/^@/, "")})`
          : "";

        return `• *${fullName}*${slackHandle} — ${timeSpent} (Checked in at ${checkInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
      });

      // Updated: Check specifically for "close" instead of "report"
      if (param === "close") {
        for (const attendee of currentAttendance) {
          await db.run(
            "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
            nowISO,
            attendee.idNumber,
          );
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("lock-console");
        }

        const messageText =
          `📋 *Meeting Attendance Summary Report*\n` +
          `*Attendance Status:* Closed\n` +
          `*Total Attendees Checked Out:* ${currentAttendance.length}\n\n` +
          attendeeLines.join("\n");

        await respond({
          response_type: "in_channel",
          text: messageText,
        });
      } else {
        const messageText =
          `🟢 *Active Attendance Status*\n` +
          `*Currently Checked In:* ${currentAttendance.length}\n\n` +
          attendeeLines.join("\n") +
          `\n\n_Tip: Type \`/attendance close\` to check everyone out and close the meeting session._`;

        await respond({
          response_type: "in_channel",
          text: messageText,
        });
      }
    } catch (err) {
      console.error("Error handling /attendance command:", err);
    }
  });

  slackBot.start().then(() => {
    console.log("Slack Bolt app is running in Socket Mode.");
  }).catch((err) => {
    console.error("Failed to start Slack Bolt app:", err);
  });
}
function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 768,
    width: 1024,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

app.on("ready", async () => {
  const db = await initDB();

  // Automatically sync Google Sheets every day at 11:59 PM
  schedule.scheduleJob("59 23 * * *", async () => {
    try {
      console.log("Starting automatic Google Sheets sync...");

      await syncAllAttendanceToGoogleSheets(db);

      console.log("Automatic Google Sheets sync successful.");
    } catch (err) {
      console.error("Automatic Google Sheets sync failed:", err);
    }
  });
  ipcMain.handle("submit", async (_, idNumber: string) => {
    const student = await db.get("SELECT * FROM student WHERE idNumber = ?", idNumber);
    if (!student) {
      return { success: false };
    }

    const nowISO = toISOString(new Date());
    await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", nowISO, idNumber);

    return {
      success: true,
      name: `${student.firstName} ${student.lastName}`,
    };
  });

  ipcMain.handle("authorizeAdminCode", async (_, pin: string) => {
    if (KIOSK_PIN && pin === KIOSK_PIN) {
      return { success: true, action: "attendance" };
    } else if (EXPORT_PIN && pin === EXPORT_PIN) {
      return { success: true, action: "export" };
    }
    return { success: false };
  });

  // File: src/index.ts (Inside ipcMain.handle("closeAttendance", ...))

  ipcMain.handle("closeAttendance", async () => {
    try {
      const today = getToday();
      const currentAttendance = await getCurrentAttendance(db, today);
      const nowISO = toISOString(new Date());

      for (const attendee of currentAttendance) {
        await db.run("INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)", nowISO, attendee.idNumber);
      }

      let emailed = false;
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
        try {
          // Pass "summary_only" to prevent CSV attachments in automated emails
          await sendReportEmail(db, "summary_only");
          emailed = true;
        } catch (emailErr) {
          console.error("Automated email send failed on close:", emailErr);
        }
      }

      return {
        success: true,
        numClosed: currentAttendance.length,
        emailed,
      };
    } catch (err) {
      console.error("Failed to close attendance:", err);
      return { success: false, numClosed: 0, emailed: false };
    }
  });

  ipcMain.handle("getTodaysStats", async () => {
    const today = getToday();
    return await getStatsForDate(db, today);
  });

  ipcMain.handle("getCurrentAttendance", async () => {
    const today = getToday();
    return await getCurrentAttendance(db, today);
  });

  ipcMain.handle("getEnabledActions", async (): Promise<EnabledActions> => {
    return {
      sendToSlack: false,
      sendReportEmail: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASS),
      sendToGoogleSheet: !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    };
  });

  ipcMain.handle("getStudentIds", async () => {
    const rows = await db.all<{ idNumber: string }[]>("SELECT idNumber FROM student");
    return rows.map((r) => r.idNumber);
  });

  // NON-BLOCKING FILE EXPORTS: Replaced slow writeFileSync loops with fast async Promises
  ipcMain.on("exportAttendanceReport", async (_, startDate: string, endDate: string, meetingThreshold: number) => {
    try {
      if (!mainWindow) return;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Attendance Report",
        defaultPath: getTimestampedFilename("Attendance_Report", "csv"),
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (result.canceled || !result.filePath) return;

      const csvData = await generateAttendanceReport(db, startDate, endDate, meetingThreshold || MEETING_THRESHOLD);
      await fs.promises.writeFile(result.filePath, csvData, "utf-8");

      await dialog.showMessageBox(mainWindow, {
        title: "Success",
        message: "Attendance report exported successfully.",
      });
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Export Error", String(err));
    }
  });

  ipcMain.on("exportMeetingReport", async (_, startDate: string, endDate: string, meetingThreshold: number) => {
    try {
      if (!mainWindow) return;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Meeting Report",
        defaultPath: getTimestampedFilename("Meeting_Report", "csv"),
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (result.canceled || !result.filePath) return;

      const csvData = await generateMeetingReport(db, startDate, endDate, meetingThreshold || MEETING_THRESHOLD);
      await fs.promises.writeFile(result.filePath, csvData, "utf-8");

      await dialog.showMessageBox(mainWindow, {
        title: "Success",
        message: "Meeting report exported successfully.",
      });
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Export Error", String(err));
    }
  });

  ipcMain.on("exportCheckinData", async (_, startDate: string, endDate: string, meetingThreshold: number) => {
    try {
      if (!mainWindow) return;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Checkin Data",
        defaultPath: getTimestampedFilename("Checkin_Data", "csv"),
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (result.canceled || !result.filePath) return;

      const csvData = await generateCheckinData(db, startDate, endDate, meetingThreshold || MEETING_THRESHOLD);
      await fs.promises.writeFile(result.filePath, csvData, "utf-8");

      await dialog.showMessageBox(mainWindow, {
        title: "Success",
        message: "Checkin data exported successfully.",
      });
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Export Error", String(err));
    }
  });
  // SECURED COMPILATION PARSER LOOP: Replaced inline string builders with prepared execution statements
  ipcMain.on("importStudents", async () => {
    try {
      if (!mainWindow) return;
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Import Students",
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) return;

      const filePath = result.filePaths[0];
      const fileContent = await fs.promises.readFile(filePath, "utf-8");

      parse(fileContent, { columns: true, skip_empty_lines: true, trim: true }, async (err, records) => {
        if (err) {
          if (mainWindow) dialog.showErrorBox("Import Failed", `Failed to parse CSV: ${err.message}`);
          return;
        }

        let numSuccess = 0;
        let numFailure = 0;
        const importedIds = new Set<string>();

        try {
          await archiveAndClearAttendance(db);
        } catch (err) {
        if (mainWindow) {
            dialog.showErrorBox(
              "Import Cancelled",
              `Could not archive attendance data to Google Sheets.\n\n${String(err)}`
            );
          }
          return;
        }
        await db.run("BEGIN TRANSACTION");
        try {
          const insertStmt = await db.prepare(
            "INSERT OR REPLACE INTO student (idNumber, firstName, lastName, slackId) VALUES (?, ?, ?, ?)"
          );

          for (const record of records) {
            const idNumber = (record.id_number || record.idNumber || record.ID)?.trim();
            const firstName = (record.first_name || record.firstName || record["First Name"])?.trim();
            const lastName = (record.last_name || record.lastName || record["Last Name"])?.trim();
            const slackId = (record.slack_id || record.slackId || record.slackUsername)?.trim() || null;

            if (!idNumber || !firstName || !lastName) {
              numFailure++;
              continue;
            }

            importedIds.add(idNumber);
            await insertStmt.run(idNumber, firstName, lastName, slackId);
            numSuccess++;
          }
          await insertStmt.finalize();

          // SECURED ROSTER UPDATING: Safely filters old names out without wiping historical logs
          if (importedIds.size > 0) {
            const idArray = Array.from(importedIds);
            const placeholders = idArray.map(() => "?").join(",");
            await db.run(`DELETE FROM student WHERE idNumber NOT IN (${placeholders})`, ...idArray);
          }

          await db.run("COMMIT");
        } catch (txnErr) {
          await db.run("ROLLBACK");
          if (mainWindow) dialog.showErrorBox("Import Error", `Transaction rolled back: ${String(txnErr)}`);
          return;
        }

        let message = `${numSuccess} student record${numSuccess !== 1 ? "s" : ""} imported. Outdated records removed.`;
        if (numFailure > 0) message += ` (${numFailure} failed validation)`;

        if (mainWindow) {
          await dialog.showMessageBox(mainWindow, {
            title: "Import Complete",
            message,
          });
        }
      });
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Import Error", String(err));
    }
  });

  ipcMain.on("sendReportEmail", async (_, reportType?: "attendance" | "meeting" | "checkin" | "all") => {
    try {
      await sendReportEmail(db, reportType || "all");
      if (mainWindow) {
        await dialog.showMessageBox(mainWindow, {
          title: "Email Sent",
          message: "Report email sent successfully.",
        });
      }
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Email Error", String(err));
    }
  });

  ipcMain.on("syncToGoogleSheet", async () => {
  try {
    await syncAllAttendanceToGoogleSheets(db);

    if (mainWindow) {
      await dialog.showMessageBox(mainWindow, {
        title: "Sync Complete",
        message: "Google Sheets is up to date.",
      });
    }
  } catch (err) {
    console.error("Google Sheets sync failed:", err);

    if (mainWindow) {
      dialog.showErrorBox(
        "Sync Error",
        `Google Sheets could not be updated.\n\n${String(err)}`
      );
    }
  }
});

  createWindow();
});

app.on("before-quit", async () => {
  if (dbInstance) {
    try {
      const today = getToday();
      const currentAttendance = await getCurrentAttendance(dbInstance, today);
      if (currentAttendance.length > 0) {
        const nowISO = toISOString(new Date());
        for (const attendee of currentAttendance) {
          await dbInstance.run(
            "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
            nowISO,
            attendee.idNumber
          );
        }
      }
    } catch (err) {
      console.error("Error clocking out users on exit:", err);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
