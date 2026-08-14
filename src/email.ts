import { Database } from "sqlite";
import nodemailer from "nodemailer";
import { getStartDate, getToday, getTimestampedFilename } from "./util";
import {
  generateAttendanceReport,
  generateCheckinData,
  generateMeetingReport,
  getStatsForDate,
  MEETING_THRESHOLD,
} from "./report";
import { uploadReportsToSheet } from "./sheets";

export async function sendReportEmail(
  db: Database, 
  reportType?: "attendance" | "meeting" | "checkin" | "all" | "summary_only"
) {
  const startDate = getStartDate();
  const today = getToday();

  // Always fetch stats and attendees for the email body
  const todaysStats = await getStatsForDate(db, today);
  
  // Get all check-ins for today
  const todaysAttendees = await db.all(`
    SELECT checkin.idNumber,
           ifnull(student.firstName, '') AS firstName,
           ifnull(student.lastName, '') AS lastName,
           min(timestamp) AS checkinTime,
           max(timestamp) AS checkoutTime,
           count(*) AS entryCount
    FROM checkin
    LEFT JOIN student ON checkin.idNumber = student.idNumber
    WHERE date(timestamp) = :today
    GROUP BY checkin.idNumber
    ORDER BY min(timestamp) ASC
  `, { ":today": today });

  // Format attendee roster lines
  const attendeeLines = todaysAttendees.length > 0
    ? todaysAttendees.map((a) => {
        const fullName = `${a.firstName} ${a.lastName}`.trim() || a.idNumber;
        const checkinTimeFormatted = new Date(a.checkinTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const checkedOut = a.entryCount % 2 === 0;
        const checkoutTimeFormatted = checkedOut ? new Date(a.checkoutTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Still checked in";
        
        return `• ${fullName} (Check-in: ${checkinTimeFormatted} | Check-out: ${checkoutTimeFormatted})`;
      }).join("\n")
    : "No attendees recorded for today.";

  let attendanceReport = "";
  let meetingReport = "";
  let checkinData = "";

  // Only generate CSV content if requested
  if (reportType === "all" || reportType === "attendance") {
    attendanceReport = await generateAttendanceReport(db, startDate, today, MEETING_THRESHOLD);
  }
  if (reportType === "all" || reportType === "meeting") {
    meetingReport = await generateMeetingReport(db, startDate, today, MEETING_THRESHOLD);
  }
  if (reportType === "all" || reportType === "checkin") {
    checkinData = await generateCheckinData(db, startDate, today, MEETING_THRESHOLD);
  }

  // Clean text summary without attachment wording
  let text = `Attendance summary of today's meeting (${today})\n\n`;
  text += `Checkins: ${todaysStats.numCheckins}\n`;
  text += `Checkouts: ${todaysStats.numCheckouts}\n`;
  text += `Checkout rate: ${todaysStats.checkoutRatePercent.toFixed(2)}%\n\n`;
  text += `Attendees:\n${attendeeLines}`;

  if (reportType !== "summary_only") {
    text += `\n\nAttached are the attendance reports for the period ${startDate} to ${today}.`;
  }

  const html = text.replace(/\n/g, "<br>");
  const toAddress = process.env.REPORT_EMAIL_TO_ADDRESS;
  const subject = `TerrorBytes Attendance Summary - ${today}`;

  if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      await uploadReportsToSheet(checkinData || "");
      console.log("Reports uploaded to Google Sheet");
    } catch (sheetErr) {
      console.error("Failed to upload reports to Google Sheet:", sheetErr);
    }
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  try {
    const attachments: any[] = [];
    if (attendanceReport && attendanceReport.length > 0) {
      attachments.push({ filename: getTimestampedFilename("attendance-report", "csv"), content: attendanceReport });
    }
    if (meetingReport && meetingReport.length > 0) {
      attachments.push({ filename: getTimestampedFilename("meeting-report", "csv"), content: meetingReport });
    }
    if (checkinData && checkinData.length > 0) {
      attachments.push({ filename: getTimestampedFilename("checkins", "csv"), content: checkinData });
    }

    const info = await transporter.sendMail({
      from: `"TerrorBytes Attendance Kiosk" <${process.env.GMAIL_USER}>`,
      to: toAddress,
      subject: subject,
      text: text,
      html: html,
      attachments,
    });

    console.log("Email sent successfully! Message ID:", info.messageId);
    return info;
  } catch (error) {
    console.error("Failed to send Gmail email:", error);
    throw error;
  }
}