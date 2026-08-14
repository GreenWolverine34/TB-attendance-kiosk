/**
 * TerrorBytes Kiosk - Spreadsheet Tab Automation (KioskTabs.gs)
 *
 * Configures 'rawData' for kiosk exports and 'Output' for live attendance summaries.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TerrorBytes Kiosk")
    .addItem("Set up / Reset Kiosk Tabs", "setupKioskTabs")
    .addItem("Clear Raw Data", "clearRawData")
    .addToUi();
}

/**
 * Initializes 'rawData' and 'Output' tabs with headers, date controls, and dynamic formulas.
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

  // --- SECTION 1: Overall Hours Table ---
  outputSheet.getRange("A1:B1").setValues([["Name", "Hours"]]);
  outputSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");

  var overallFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF(rawData!A2:A="",, {rawData!A2:A & " " & rawData!B2:B, VALUE(rawData!D2:D)})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data Recorded", 0})';
  outputSheet.getRange("A2").setFormula(overallFormula);

  // --- SECTION 2: Build Season Hours Table ---
  outputSheet.getRange("A5:B5").setValues([["Build Season - Name", "Hours"]]);
  outputSheet.getRange("A5:B5").setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");

  var buildSeasonFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF((rawData!A2:A="") + (DATEVALUE(rawData!C2:C) < DATEVALUE(B16)) + (DATEVALUE(rawData!C2:C) > DATEVALUE(B17)),, ' +
    '{rawData!A2:A & " " & rawData!B2:B, VALUE(rawData!D2:D)})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data for Build Season", 0})';
  outputSheet.getRange("A6").setFormula(buildSeasonFormula);

  // --- SECTION 3: Offseason Hours Table ---
  outputSheet.getRange("A10:B10").setValues([["Offseason - Name", "Hours"]]);
  outputSheet.getRange("A10:B10").setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");

  var offseasonFormula = 
    '=IFERROR(QUERY(ARRAYFORMULA(IF((rawData!A2:A="") + (DATEVALUE(rawData!C2:C) < DATEVALUE(B20)) + (DATEVALUE(rawData!C2:C) > DATEVALUE(B21)),, ' +
    '{rawData!A2:A & " " & rawData!B2:B, VALUE(rawData!D2:D)})), ' +
    '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data for Offseason", 0})';
  outputSheet.getRange("A11").setFormula(offseasonFormula);

  // --- DATE CONTROL PARAMETERS BLOCK ---
  var dateSettings = [
    ["Build Season", ""],
    ["Start Date:", "2027-01-09"],
    ["End Date:", "2027-05-01"],
    ["", ""],
    ["Offseason", ""],
    ["Start Date:", "2026-08-18"],
    ["End Date:", "2027-01-08"]
  ];

  outputSheet.getRange("A15:B21").setValues(dateSettings);
  outputSheet.getRange("A15").setFontWeight("bold").setBackground("#e2f0d9");
  outputSheet.getRange("A19").setFontWeight("bold").setBackground("#e2f0d9");

  // Format Date Inputs
  outputSheet.getRange("B16").setNumberFormat("yyyy-mm-dd");
  outputSheet.getRange("B17").setNumberFormat("yyyy-mm-dd");
  outputSheet.getRange("B20").setNumberFormat("yyyy-mm-dd");
  outputSheet.getRange("B21").setNumberFormat("yyyy-mm-dd");

  // Formatting Column Widths
  rawDataSheet.autoResizeColumns(1, 4);
  outputSheet.autoResizeColumns(1, 2);

  ss.toast("Kiosk tabs initialized successfully!", "TerrorBytes Kiosk", 5);
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