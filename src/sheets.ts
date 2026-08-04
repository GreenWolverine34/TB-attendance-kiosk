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
        range: `Attendance Report!A1`, 
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

  // Generate Hours Summary from the checkin CSV (per-person total_hours sum)
  if (checkinCsv && checkinCsv.trim().length > 0) {
    try {
      // Parse CSV into records with columns
      const records: Array<Record<string, any>> = csvParse(checkinCsv, { columns: true, skip_empty_lines: true });

      // Normalize header keys to lowercase, underscore form for easy matching
      const normalizeKey = (k: string) => String(k || '').trim().toLowerCase();

      const totals: Record<string, { firstName: string; lastName: string; totalHours: number }> = {};
      for (const rec of records) {
        // Find id, names, and hours by checking common header variants
        const keys = Object.keys(rec);
        const lookup = (cands: string[]) => {
          for (const cand of cands) {
            const found = keys.find((k) => normalizeKey(k) === cand);
            if (found) return rec[found];
          }
          return undefined;
        };

        const idRaw = lookup(['id_number', 'idnumber', 'id']);
        const firstRaw = lookup(['first_name', 'firstname', 'first name']);
        const lastRaw = lookup(['last_name', 'lastname', 'last name']);
        const hoursRaw = lookup(['total_hours', 'totalhours', 'total hours', 'total_hours']);

        const id = idRaw ? String(idRaw).trim() : '';
        if (!id) continue;
        const first = firstRaw ? String(firstRaw).trim() : '';
        const last = lastRaw ? String(lastRaw).trim() : '';

        let hours = 0;
        if (typeof hoursRaw === 'number') {
          hours = hoursRaw;
        } else if (typeof hoursRaw === 'string') {
          const cleaned = hoursRaw.replace(/[^0-9.\-]/g, '');
          hours = parseFloat(cleaned) || 0;
        }

        if (!totals[id]) totals[id] = { firstName: first, lastName: last, totalHours: 0 };
        totals[id].totalHours += hours;
      }

      // Prepare output rows
      const outRows: any[][] = [['id_number', 'first_name', 'last_name', 'total_hours']];
      Object.keys(totals).sort().forEach((id) => {
        const t = totals[id];
        outRows.push([id, t.firstName || '', t.lastName || '', Number(t.totalHours.toFixed(2))]);
      });

      // Write (overwrite) Hours Summary sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Hours Summary!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: outRows },
      });
    } catch (err) {
      console.error('Failed to generate Hours Summary:', err);
    }
  }
}
