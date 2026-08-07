import { google } from "googleapis"; 
import { parse as csvParse } from "csv-parse/sync"; 

async function getSheetsClient() { 
  const sheetId = process.env.GOOGLE_SHEET_ID; 
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; 

  if (!sheetId) throw new Error("GOOGLE_SHEET_ID environment variable is not set"); 
  if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set"); 

  const credentials = JSON.parse(creds);

  // FIX 1: Handle escaped newline characters safely in the private key
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.GoogleAuth({ 
    credentials, 
    scopes: ["https://googleapis.com"], 
  }); 

  // FIX 2: Pass 'auth' directly to avoid TypeScript 'auth.getClient()' type conflicts
  const sheets = google.sheets({ version: "v4", auth }); 

  return { sheets, sheetId }; 
} 

function csvToValues(csv: string, stripHeader = false): any[][] {
  try {
    const records = csvParse(csv, { columns: false, skip_empty_lines: true });
    return stripHeader && records.length > 0 ? (records as any[][]).slice(1) : (records as any[][]);
  } catch (err) {
    const rows = csv
      .split("\n")
      .map((r) => r.split(","))
      .filter((row) => row.some((col) => col.trim() !== ""));
    return stripHeader && rows.length > 0 ? rows.slice(1) : rows;
  }
}

export async function uploadReportsToSheet(checkinCsv: string) {
  const { sheets, sheetId } = await getSheetsClient();
  if (!checkinCsv || checkinCsv.trim().length === 0) {
    return;
  }

  const values = csvToValues(checkinCsv, true);
  if (values.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `rawData!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}
