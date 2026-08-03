import { google } from "googleapis";
import { parse as csvParse } from "csv-parse/sync";

async function getSheetsClient() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID environment variable is not set");
    if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set");

    const credentials = JSON.parse(creds);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    return { sheets, sheetId };
}

function csvToValues(csv: string): any[][] {
    // csv-parse/sync returns arrays of records when columns: false
    try {
        const records = csvParse(csv, { columns: false, skip_empty_lines: true });
        return records as any[][];
    } catch (err) {
        // Fallback: simple split (best-effort)
        return csv
            .split("\n")
            .map((r) => r.split(","));
    }
}

export async function uploadReportsToSheet(attendanceCsv: string, meetingCsv: string, checkinCsv: string) {
    const { sheets, sheetId } = await getSheetsClient();

    const uploads: Array<Promise<any>> = [];

    if (attendanceCsv && attendanceCsv.trim().length > 0) {
        const values = csvToValues(attendanceCsv);
        // Append under AttendanceReport tab
        uploads.push(
            sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `AttendanceReport!A1`,
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values },
            }),
        );
    }

    if (meetingCsv && meetingCsv.trim().length > 0) {
        const values = csvToValues(meetingCsv);
        uploads.push(
            sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `MeetingReport!A1`,
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values },
            }),
        );
    }

    if (checkinCsv && checkinCsv.trim().length > 0) {
        const values = csvToValues(checkinCsv);
        uploads.push(
            sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `Checkins!A1`,
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values },
            }),
        );
    }

    await Promise.all(uploads);
}
