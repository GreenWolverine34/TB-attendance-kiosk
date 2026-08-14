import sqlite3 from "sqlite3";
import * as path from "path";

const dbPath = path.resolve(__dirname, "../attendance.db");
export const db = new sqlite3.Database(dbPath);

export interface AttendanceRecord {
  id: string;
  name: string;
  slackId?: string;
  checkinTime: string;
}

export function getCurrentAttendance(): Promise<AttendanceRecord[]> {
  const query = `
    SELECT 
      s.id AS id,
      s.name AS name,
      s.slack_id AS slackId,
      c.timestamp AS checkinTime
    FROM checkins c
    JOIN students s ON c.student_id = s.id
    WHERE c.type = 'CHECKIN'
      AND c.student_id NOT IN (
        SELECT student_id 
        FROM checkins 
        WHERE type = 'CHECKOUT' AND timestamp > c.timestamp
      )
    ORDER BY c.timestamp DESC;
  `;

  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows: AttendanceRecord[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}