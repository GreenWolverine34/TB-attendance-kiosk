// Apps Script helper for the TerrorBytes attendance kiosk spreadsheet (scripts/kioskTabs.gs)
// Creates/initializes the expected tabs and sets header rows so the desktop app
// can append CSV rows to these tabs.

function ensureKioskTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Ensure rawData layout exists with correct tracking columns
  let rawDataSheet = ss.getSheetByName("rawData");
  if (!rawDataSheet) {
    rawDataSheet = ss.insertSheet("rawData");
  }
  if (rawDataSheet.getLastRow() === 0) {
    rawDataSheet.getRange("A1:D1").setValues([["First Name", "Last Name", "Date", "Hours"]]);
    rawDataSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
    rawDataSheet.setFrozenRows(1);
  }

  // 2. Ensure Output Summary layout is structured matching the visual dashboard model
  let outputSheet = ss.getSheetByName("Output");
  if (!outputSheet) {
    outputSheet = ss.insertSheet("Output");
  }

  // Only apply formulas if the dashboard layout needs generation
  if (outputSheet.getLastRow() === 0) {
    outputSheet.getRange("A1:B1").setValues([["Offseason", ""]]).setFontWeight("bold");
    outputSheet.getRange("D1:E1").setValues([["Build Season", ""]]).setFontWeight("bold");
    
    var dateSettings = [
      ["Start Date:", "2026-08-18", "", "Start Date:", "2027-01-09"],
      ["End Date:", "2027-01-08", "", "End Date:", "2027-05-01"]
    ];
    outputSheet.getRange("A2:E3").setValues(dateSettings);
    outputSheet.getRange("B2:B3").setNumberFormat("yyyy-mm-dd");
    outputSheet.getRange("E2:E3").setNumberFormat("yyyy-mm-dd");

    outputSheet.getRange("A5:B5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
    outputSheet.getRange("D5:E5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
    outputSheet.getRange("G5:H5").setValues([["Name", "Hours"]]).setFontWeight("bold").setBackground("#247c28").setFontColor("#ffffff");
    outputSheet.getRange("G4:H4").setValues([["Total Hours", ""]]).setFontWeight("bold");

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

    var overallFormula = 
      '=IFERROR(QUERY(ARRAYFORMULA(IF(rawData!A2:A="",, {rawData!A2:A & " " & rawData!B2:B, rawData!D2:D})), ' +
      '"SELECT Col1, SUM(Col2) WHERE Col1 IS NOT NULL GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'"), {"No Data", 0})';
    outputSheet.getRange("G6").setFormula(overallFormula);
  }
}

function clearKioskTabsForTesting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['rawData', 'Output'].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clearContents();
    }
  });
  ensureKioskTabs();
}
