import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse";
import { WebClient } from "@slack/web-api";
import { App as SlackApp } from "@slack/bolt";
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
const KIOSK_PIN = process.env.ATTENDANCE_KIOSK_PIN || "4561";
const EXPORT_PIN = process.env.ATTENDANCE_EXPORT_PIN || "1654";

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

  // Handle /attendance command with parameter routing
  slackBot.command("/attendance", async ({ ack, respond, command }) => {
    await ack();

    try {
      const db = await initDB();
      const param = (command.text || "").trim().toLowerCase();

      // Parameter: "help"
      if (param === "help") {
        await respond({
          response_type: "ephemeral",
          text:
            `ℹ️ *Attendance Command Usage:*\n` +
            `• \`/attendance\` or \`/attendance status\` — View currently checked-in attendees (session remains open)\n` +
            `• \`/attendance report\` or \`/attendance close\` — Generate meeting report & close attendance session`,
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

      // Parameter: "report", "summary", or "close" -> Close session & output final report
      if (param === "report" || param === "summary" || param === "close") {
        for (const attendee of currentAttendance) {
          await db.run(
            "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
            nowISO,
            attendee.idNumber,
          );
        }

        const messageText =
          `📋 *Meeting Attendance Summary Report*\n` +
          `*Attendance Status:* Closed\n` +
          `*Total Attendees:* ${currentAttendance.length}\n\n` +
          attendeeLines.join("\n");

        await respond({
          response_type: "in_channel",
          text: messageText,
        });
      } else {
        // Default / "status" Parameter: Live status check (session stays open)
        const messageText =
          `🟢 *Active Attendance Status*\n` +
          `*Currently Checked In:* ${currentAttendance.length}\n\n` +
          attendeeLines.join("\n") +
          `\n\n_Tip: Type \`/attendance report\` to generate final report and close meeting session._`;

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

  // IPC Handlers matched with preload.ts
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
    if (pin === KIOSK_PIN) {
      return { success: true, action: "attendance" };
    } else if (pin === EXPORT_PIN) {
      return { success: true, action: "export" };
    }
    return { success: false };
  });

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
          await sendReportEmail(db, "all");
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

  // Report Export Listeners
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
      fs.writeFileSync(result.filePath, csvData, "utf-8");

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
      fs.writeFileSync(result.filePath, csvData, "utf-8");

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
      fs.writeFileSync(result.filePath, csvData, "utf-8");

      await dialog.showMessageBox(mainWindow, {
        title: "Success",
        message: "Checkin data exported successfully.",
      });
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Export Error", String(err));
    }
  });

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
      const fileContent = fs.readFileSync(filePath, "utf-8");

      parse(fileContent, { columns: true, skip_empty_lines: true, trim: true }, async (err, records) => {
        if (err) {
          if (mainWindow) dialog.showErrorBox("Import Failed", `Failed to parse CSV: ${err.message}`);
          return;
        }

        let numSuccess = 0;
        let numFailure = 0;

        await db.run("BEGIN TRANSACTION");
        try {
          for (const record of records) {
            const idNumber = (record.id_number || record.idNumber || record.ID)?.trim();
            const firstName = (record.first_name || record.firstName || record["First Name"])?.trim();
            const lastName = (record.last_name || record.lastName || record["Last Name"])?.trim();
            const slackId = (record.slack_id || record.slackId || record.slackUsername)?.trim() || null;

            if (!idNumber || !firstName || !lastName) {
              numFailure++;
              continue;
            }

            await db.run(
              "INSERT OR REPLACE INTO student (idNumber, firstName, lastName, slackId) VALUES (?, ?, ?, ?)",
              idNumber,
              firstName,
              lastName,
              slackId,
            );
            numSuccess++;
          }
          await db.run("COMMIT");
        } catch (txnErr) {
          await db.run("ROLLBACK");
          throw txnErr;
        }

        let message = `${numSuccess} student record${numSuccess !== 1 ? "s" : ""} imported successfully.`;
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
      const checkinData = await generateCheckinData(db, getStartDate(), getToday(), MEETING_THRESHOLD);
      await uploadReportsToSheet(checkinData);
      if (mainWindow) {
        await dialog.showMessageBox(mainWindow, {
          title: "Sync Complete",
          message: "Google Sheets updated successfully.",
        });
      }
    } catch (err) {
      if (mainWindow) dialog.showErrorBox("Sync Error", String(err));
    }
  });

  createWindow();
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