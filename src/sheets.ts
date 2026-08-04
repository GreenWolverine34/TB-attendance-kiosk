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

function csvToValues(csv: string): any[][] { 
  try { 
    const records = csvParse(csv, { columns: false, skip_empty_lines: true }); 
    return records as any[][]; 
  } catch (err) { 
    return csv 
      .split("\n") .map((r) => r.split(",")); 
  } 
} 

export async function uploadReportsToSheet(attendanceCsv: string, meetingCsv: string, checkinCsv: string) { 
  const { sheets, sheetId } = await getSheetsClient(); 
  const uploads: Array<Promise<any>> = []; 

  if (attendanceCsv && attendanceCsv.trim().length > 0) { 
    const values = csvToValues(attendanceCsv); 
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
