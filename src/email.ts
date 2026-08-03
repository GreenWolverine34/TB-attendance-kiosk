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

export async function sendReportEmail(db: Database) {
  const startDate = getStartDate();
  const today = getToday();

  const [
    attendanceReport,
    meetingReport,
    checkinData,
    todaysStats,
  ] = await Promise.all([
    generateAttendanceReport(db, startDate, today, MEETING_THRESHOLD),
    generateMeetingReport(db, startDate, today, MEETING_THRESHOLD),
    generateCheckinData(db, startDate, today, MEETING_THRESHOLD),
    getStatsForDate(db, today),
  ]);

  const text = `Attendance summary of today's meeting\n\nCheckins: ${todaysStats.numCheckins}\nCheckouts: ${todaysStats.numCheckouts}\nCheckout rate: ${todaysStats.checkoutRatePercent.toFixed(2)}%\n\nAttached are the attendance reports for the period ${startDate} to ${today}.`;
  const html = text.replace(/\n/g, "<br>");

  const toAddress = process.env.REPORT_EMAIL_TO_ADDRESS;
  const subject = `TerrorBytes Attendance Reports - ${today}`;

  // Configure the Gmail SMTP transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,       // Your full Gmail address
      pass: process.env.GMAIL_APP_PASS,   // 16-character App Password (NOT your normal password)
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"TerrorBytes Attendance Kiosk" <${process.env.GMAIL_USER}>`,
      to: toAddress,
      subject: subject,
      text: text,
      html: html,
      attachments: [
        {
          filename: getTimestampedFilename("attendance-report", "csv"),
          content: attendanceReport, // Nodemailer converts strings/buffers automatically
        },
        {
          filename: getTimestampedFilename("meeting-report", "csv"),
          content: meetingReport,
        },
        {
          filename: getTimestampedFilename("checkins", "csv"),
          content: checkinData,
        },
      ],
    });

    console.log("Email sent successfully! Message ID:", info.messageId);
    return info;
  } catch (error) {
    console.error("Failed to send Gmail email:", error);
    throw error;
  }
}
