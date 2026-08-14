/**
 * TerrorBytes Kiosk - Spreadsheet Tab Automation (KioskTabs.gs)
 * Matches top-aligned date boundaries and robust error checking routines.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TerrorBytes Kiosk")
    .addItem("Set up / Reset Kiosk Tabs", "setupKioskTabs")
    .addItem("Clear Raw Data", "clearRawData")
    .addToUi();
}

/**
 * Initializes 'rawData' and 'Output' tabs with headers, top-aligned date controls, and structural formulas.
 */
function setupKioskTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // -------------------------------------------------------------
  // 1. SETUP 'rawData' TAB
  // -------------------------------------------------------------
  var rawDataSheet = getOrCreateSheet_(ss, "rawData");
  if (rawDataSheet.getLastRow() === 0) {
    rawDataSheet.getRange("A1:D1").setValues([["First Name", "Last Name", "Date", "Hours"]]);
    rawDataSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
    rawDataSheet.setFrozenRows(1);
  }

  // -------------------------------------------------------------
  // 2. SETUP 'Output' SUMMARY DASHBOARD TAB
  // -------------------------------------------------------------
  var outputSheet = getOrCreateSheet_(ss, "Output");
  outputSheet.clear();

  // --- TOP DATE PARAMETERS BLOCK (Rows 1 to 3) ---
  outputSheet.getRange("A1:B1").setValues([["Offseason", ""]]).setFontWeight("bold");
  outputSheet.getRange("D1:E1").setValues([["Build Season", ""]]).setFontWeight("bold");
  
  var dateSettings = [
    ["Start Date:", "2026-08-18", "", "Start Date:", "2027-01-09"],
    ["End Date:", "2027-01-08", "", "End Date:", "2027-05-01"]
  ];
  outputSheet.getRange("A2:E3").setValues(dateSettings);

  // Format Date Inputs explicitly
  outputSheet.getRange("B2:B3").setNumberFormat("yyyy-mm-dd");
  outputSheet.getRange("E2:E3").setNumberFormat("yyyy-mm-dd");

  // --- SECTION HEADERS (Row 5) ---
  outputSheet.getRange("A5:B5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
  outputSheet.getRange("D5:E5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
  outputSheet.getRange("G5:H5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
  
  outputSheet.getRange("G4:H4").setValues([["Total Hours", ""]]).setFontWeight("bold");

  // --- DYNAMIC ROBUST CORE FORMULAS ---
  
  // Column A & B: Offseason Hours Table
  var offseasonFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF((rawData!A2:A="") + IF(rawData!C2:C="", TRUE, (DATEVALUE(rawData!C2:C) < DATEVALUE(B2)) + (DATEVALUE(rawData!C2:C) > DATEVALUE(B3))),, ' +
    '{rawData!A2:A & " " & rawData!B2:B, rawData!D2:D})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data", 0})';
  outputSheet.getRange("A6").setFormula(offseasonFormula);

  // Column D & E: Build Season Hours Table
  var buildSeasonFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF((rawData!A2:A="") + IF(rawData!C2:C="", TRUE, (DATEVALUE(rawData!C2:C) < DATEVALUE(E2)) + (DATEVALUE(rawData!C2:C) > DATEVALUE(E3))),, ' +
    '{rawData!A2:A & " " & rawData!B2:B, rawData!D2:D})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data", 0})';
  outputSheet.getRange("D6").setFormula(buildSeasonFormula);

  // Column G & H: Overall Total Lifetime Hours Cumulative Table
  var overallFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF(rawData!A2:A="",, {rawData!A2:A & " " & rawData!B2:B, rawData!D2:D})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data", 0})';
  outputSheet.getRange("G6").setFormula(overallFormula);

  // Sizing adjust routines
  rawDataSheet.autoResizeColumns(1, 4);
  outputSheet.autoResizeColumns(1, 8);

  ss.toast("Spreadsheet setup completed successfully!", "TerrorBytes Kiosk", 5);
}

/**
 * Clears data in 'rawData' while keeping headers intact.
 */
function clearRawData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("rawData");
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    ss.toast("rawData cleared successfully.", "TerrorBytes Kiosk", 3);
  }
}

/**
 * Helper function to retrieve or create a worksheet.
 */
function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
