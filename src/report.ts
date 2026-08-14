import { Database } from "sqlite";
import { CurrentAttendanceEntry, TodaysStats } from "./types";

// Minimum time a student must be checked in to be considered as having checked out
export const MIN_CHECKOUT_TIME_S = 5 * 60; // 5 minutes

// Meeting threshold to use for automated reports
export const MEETING_THRESHOLD = 0;

function escapeCsvCell(value: any): string {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function generateAttendanceReport(db: Database, startDate: string, endDate: string, meetingThreshold: number) {
    const [
        checkinCountsResult,
        totalMeetingsResult,
    ] = await Promise.all([
        db.all(`
            SELECT t.idNumber,
                   ifnull(student.firstName, '') AS firstName,
                   ifnull(student.lastName, '') AS lastName,
                   numCheckins,
                   numCheckouts,
                   numCheckouts * 100.0 / numCheckins AS checkoutRatePercent,
                   totalHours,
                   totalHours / numCheckouts AS averageHours
            FROM
              (SELECT idNumber,
                      count(*) AS numCheckins,
                      sum(hasCheckout) AS numCheckouts,
                      sum(totalHours) AS totalHours
               FROM
                 (SELECT date(timestamp) AS date,
                         idNumber,
                         (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout,
                         CASE
                             WHEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} THEN (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) / 3600.0
                             ELSE 0
                         END AS totalHours
                  FROM checkin
                  WHERE date IN
                      (SELECT date
                       FROM
                         (SELECT date(timestamp) AS date,
                                 count(DISTINCT idNumber) AS numCheckins
                          FROM checkin
                          WHERE timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
                          GROUP BY date
                          HAVING numCheckins >= :meetingThreshold))
                    AND timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
                  GROUP BY date, idNumber)
               GROUP BY idNumber
               ORDER BY numCheckins DESC) t
            LEFT JOIN student ON t.idNumber = student.idNumber
        `, {
            ":startDate": startDate,
            ":endDate": endDate,
            ":meetingThreshold": meetingThreshold,
        }),
        db.get(`
            SELECT count(*) AS total
            FROM
              (SELECT date(timestamp) AS date,
                      count(DISTINCT idNumber) AS numCheckins
               FROM checkin
               WHERE timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
               GROUP BY date
               HAVING numCheckins >= :meetingThreshold)
        `, {
            ":startDate": startDate,
            ":endDate": endDate,
            ":meetingThreshold": meetingThreshold,
        }),
    ]);

    const header = "id_number,first_name,last_name,num_checkins,attendance_rate_percent,num_checkouts,checkout_rate_percent,total_hours,average_hours\n";
    const totalMeetings = totalMeetingsResult.total || 1; // Fallback to 1 to prevent division by zero errors
    return header + checkinCountsResult.map((row) => {
        const attendanceRatePercent = (row.numCheckins / totalMeetings * 100).toFixed(2);
        const checkoutRatePercent = (row.checkoutRatePercent || 0).toFixed(2);
        const totalHours = (row.totalHours || 0).toFixed(2);
        const averageHours = (row.averageHours || 0).toFixed(2);
        return `${escapeCsvCell(row.idNumber)},${escapeCsvCell(row.firstName)},${escapeCsvCell(row.lastName)},${row.numCheckins},${attendanceRatePercent}%,${row.numCheckouts},${checkoutRatePercent}%,${totalHours},${averageHours}\n`;
    }).join("");
}

export async function generateMeetingReport(db: Database, startDate: string, endDate: string, meetingThreshold: number) {
    const meetingsResult = await db.all(`
        SELECT date, numCheckins,
                     numCheckouts,
                     numCheckouts * 100.0 / numCheckins AS checkoutRatePercent
        FROM
          (SELECT date, count(*) AS numCheckins,
                        sum(hasCheckout) AS numCheckouts
           FROM
             (SELECT date(timestamp) AS date,
                     idNumber,
                     (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout
              FROM checkin
              WHERE timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
              GROUP BY date,
                       idNumber)
           GROUP BY date
           HAVING numCheckins >= :meetingThreshold
           ORDER BY date)
    `, {
        ":startDate": startDate,
        ":endDate": endDate,
        ":meetingThreshold": meetingThreshold,
    });

    const header = "date,num_checkins,num_checkouts,checkout_rate_percent\n";
    return header + meetingsResult.map((row) =>
        `${row.date},${row.numCheckins},${row.numCheckouts},${(row.checkoutRatePercent || 0).toFixed(2)}%\n`
    ).join("");
}

export async function generateCheckinData(db: Database, startDate: string, endDate: string, meetingThreshold: number) {
    const checkinsResult = await db.all(`
        WITH meeting_dates AS (
            SELECT date(timestamp) AS date
            FROM checkin
            WHERE timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
            GROUP BY date
            HAVING count(DISTINCT idNumber) >= :meetingThreshold
        ), ordered AS (
            SELECT date(timestamp) AS date,
                   checkin.idNumber,
                   ifnull(student.firstName, '') AS firstName,
                   ifnull(student.lastName, '') AS lastName,
                   timestamp,
                   row_number() OVER (PARTITION BY date(timestamp), checkin.idNumber ORDER BY timestamp) AS rn
            FROM checkin
            LEFT JOIN student ON checkin.idNumber = student.idNumber
            WHERE date(timestamp) IN (SELECT date FROM meeting_dates)
              AND timestamp BETWEEN :startDate AND :endDate || 'T23:59:59'
        )
        SELECT o1.date AS date,
               o1.idNumber AS idNumber,
               o1.firstName AS firstName,
               o1.lastName AS lastName,
               o1.timestamp AS checkinTime,
               o2.timestamp AS checkoutTime,
               CASE WHEN o2.timestamp IS NOT NULL THEN (unixepoch(o2.timestamp) - unixepoch(o1.timestamp)) / 3600.0 ELSE 0 END AS totalHours
        FROM ordered o1
        LEFT JOIN ordered o2
          ON o1.idNumber = o2.idNumber
         AND o1.date = o2.date
         AND o2.rn = o1.rn + 1
        WHERE (o1.rn % 2) = 1
        ORDER BY o1.date, o1.idNumber, o1.timestamp
    `, {
        ":startDate": startDate,
        ":endDate": endDate,
        ":meetingThreshold": meetingThreshold,
    });

    const header = "first_name,last_name,date,hours\n";
    return header + checkinsResult.map((row) =>
        `${escapeCsvCell(row.firstName)},${escapeCsvCell(row.lastName)},${escapeCsvCell(row.date)},${row.totalHours.toFixed(2)}\n`
    ).join("");
}

export async function isMeetingDate(db: Database, date: string, meetingThreshold: number) {
    const meetingsResult = await db.all(`
        SELECT count(*) >= :meetingThreshold AS isMeeting
        FROM
          (SELECT idNumber
           FROM checkin
           WHERE date(timestamp) = :date
           GROUP BY idNumber)
    `, {
        ":date": date,
        ":meetingThreshold": meetingThreshold,
    });

    return meetingsResult[0]?.isMeeting === 1;
}

export async function getStatsForDate(db: Database, date: string): Promise<TodaysStats> {
    const result = await db.get(`
        SELECT count(*) AS numCheckins,
               ifnull(sum(hasCheckout), 0) AS numCheckouts,
               ifnull(sum(hasCheckout) * 100.0 / count(*), 0) AS checkoutRatePercent
        FROM
            (SELECT date(timestamp) AS date,
                    idNumber,
                    (unixepoch(max(timestamp)) - unixepoch(min(timestamp))) >= ${MIN_CHECKOUT_TIME_S} AS hasCheckout
             FROM checkin
             WHERE date(timestamp) = :date
             GROUP BY idNumber)
    `, {
        ":date": date,
    });

    return {
        numCheckins: result?.numCheckins || 0,
        numCheckouts: result?.numCheckouts || 0,
        checkoutRatePercent: result?.checkoutRatePercent || 0,
    };
}

export async function getCurrentAttendance(db: Database, date: string): Promise<CurrentAttendanceEntry[]> {
    return db.all(`
        SELECT checkin.idNumber,
               ifnull(student.firstName, '') AS firstName,
               ifnull(student.lastName, '') AS lastName,
               max(timestamp) AS checkinTime
        FROM checkin
        LEFT JOIN student ON checkin.idNumber = student.idNumber
        WHERE date(timestamp) = :date
        GROUP BY checkin.idNumber
        HAVING (count(*) % 2) = 1
        ORDER BY max(timestamp) ASC
    `, {
        ":date": date,
    });
}
