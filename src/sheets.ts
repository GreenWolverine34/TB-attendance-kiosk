import { google } from "googleapis"; 
import { parse as csvParse } from "csv-parse/sync"; 

async function getSheetsClient() { 
  const sheetId = process.env.GOOGLE_SHEET_ID; 
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; 

  if (!sheetId) throw new Error("GOOGLE_SHEET_ID environment variable is not set"); 
  if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set"); 

  let credentials;
  try {
    credentials = JSON.parse(creds);
  } catch (err) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: " + String(err));
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key"
    );
  }

  // Handle escaped newline characters safely in the private key
  credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth }); 

  return { sheets, sheetId };
}

async function ensureRawDataSheetExists(sheets: any, sheetId: string) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties.title",
  });
  const sheetsList = metadata.data.sheets || [];
  const rawDataSheet = sheetsList.find((sheet: any) => sheet.properties?.title === "rawData");

  if (!rawDataSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "rawData",
              },
            },
          },
        ],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "rawData!A1:D1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["First Name", "Last Name", "Date", "Hours"]],
      },
    });
  }
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

export async function uploadReportsToSheet(checkinInput: string | string[][]) {
  const { sheets, sheetId } = await getSheetsClient();
  await ensureRawDataSheetExists(sheets, sheetId);

  if (!checkinInput) return;

  let values: any[][] = [];

  if (typeof checkinInput === "string") {
    if (checkinInput.trim().length === 0) return;
    values = csvToValues(checkinInput, true);
  } else if (Array.isArray(checkinInput)) {
    if (checkinInput.length === 0) return;

    const hasHeader =
      checkinInput[0] &&
      String(checkinInput[0][0]).toLowerCase().includes("first");

    values = hasHeader ? checkinInput.slice(1) : checkinInput;
  }

  if (values.length === 0) return;

  // Read existing rawData records
  const existingResult = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "rawData!A2:D",
  });

  const existingRows = existingResult.data.values || [];

  // Create a unique key from the four rawData columns
  const makeKey = (row: any[]) =>
    row.map(value => String(value ?? "").trim()).join("\x1F");

  const existingKeys = new Set(
    existingRows.map(makeKey)
  );

  // Only upload rows that aren't already in rawData
  const newValues = values.filter(row => {
    const key = makeKey(row);

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  if (newValues.length === 0) {
    console.log("Google Sheets already contains all attendance data.");
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "rawData!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: newValues,
    },
  });

  console.log(
    `Google Sheets sync complete: ${newValues.length} new rows uploaded.`
  );
}