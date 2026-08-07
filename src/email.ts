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

export async function sendReportEmail(db: Database, reportType?: "attendance" | "meeting" | "checkin" | "all") {
  const startDate = getStartDate();
  const today = getToday();

  // Always fetch stats for the email body
  const todaysStats = await getStatsForDate(db, today);

  // Generate only requested reports
  let attendanceReport = "";
  let meetingReport = "";
  let checkinData = "";

  if (!reportType || reportType === "all" || reportType === "attendance") {
    attendanceReport = await generateAttendanceReport(db, startDate, today, MEETING_THRESHOLD);
  }
  if (!reportType || reportType === "all" || reportType === "meeting") {
    meetingReport = await generateMeetingReport(db, startDate, today, MEETING_THRESHOLD);
  }
  if (!reportType || reportType === "all" || reportType === "checkin") {
    checkinData = await generateCheckinData(db, startDate, today, MEETING_THRESHOLD);
  }

  const text = `Attendance summary of today's meeting\n\nCheckins: ${todaysStats.numCheckins}\nCheckouts: ${todaysStats.numCheckouts}\nCheckout rate: ${todaysStats.checkoutRatePercent.toFixed(2)}%\n\nAttached are the attendance reports for the period ${startDate} to ${today}.`;
  const html = text.replace(/\n/g, "<br>");

  const toAddress = process.env.REPORT_EMAIL_TO_ADDRESS;
  const subject = `TerrorBytes Attendance Reports - ${today}`;

  // Optionally upload reports to Google Sheets if configuration is present
  if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      await uploadReportsToSheet(checkinData || "");
      console.log("Reports uploaded to Google Sheet");
    } catch (sheetErr) {
      console.error("Failed to upload reports to Google Sheet:", sheetErr);
    }
  }

  // Configure the Gmail SMTP transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,       // Your full Gmail address
      pass: process.env.GMAIL_APP_PASS,   // 16-character App Password (NOT your normal password)
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
