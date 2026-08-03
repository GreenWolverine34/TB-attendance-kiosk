// Apps Script helper for the TerrorBytes attendance kiosk spreadsheet
// Creates/initializes the expected tabs and sets header rows so the desktop app
// can append CSV rows to these tabs.

function ensureKioskTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabs = [
    { name: 'AttendanceReport', headers: ['Timestamp', 'ID', 'First Name', 'Last Name', 'Status'] },
    { name: 'MeetingReport', headers: ['Meeting Date', 'Total Checkins', 'Total Checkouts', 'Checkout Rate'] },
    { name: 'Checkins', headers: ['Timestamp', 'ID', 'First Name', 'Last Name'] },
  ];

  tabs.forEach(function(tabSpec) {
    let sheet = ss.getSheetByName(tabSpec.name);
    if (!sheet) {
      sheet = ss.insertSheet(tabSpec.name);
    }

    // If sheet is empty, set headers
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, tabSpec.headers.length).setValues([tabSpec.headers]);
    } else {
      // Ensure the first row matches header length (do not overwrite existing data)
      const existingHeaders = sheet.getRange(1, 1, 1, tabSpec.headers.length).getValues()[0];
      let needsUpdate = false;
      for (let i = 0; i < tabSpec.headers.length; i++) {
        if (existingHeaders[i] !== tabSpec.headers[i]) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) {
        sheet.getRange(1, 1, 1, tabSpec.headers.length).setValues([tabSpec.headers]);
      }
    }
  });
}

function clearKioskTabsForTesting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['AttendanceReport', 'MeetingReport', 'Checkins'].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clearContents();
    }
  });
  ensureKioskTabs();
}
