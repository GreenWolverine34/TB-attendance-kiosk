var TAB_SPECS = [
  {
    sheetName: "Attendance Report",
    csvPropertyName: "ATTENDANCE_REPORT_CSV",
    urlPropertyName: "ATTENDANCE_REPORT_URL",
  },
  {
    sheetName: "Meeting Report",
    csvPropertyName: "MEETING_REPORT_CSV",
    urlPropertyName: "MEETING_REPORT_URL",
  },
  {
    sheetName: "Check in Data",
    csvPropertyName: "CHECKIN_DATA_CSV",
    urlPropertyName: "CHECKIN_DATA_URL",
  },
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TerrorBytes Kiosk")
    .addItem("Set up tabs", "setupKioskTabs")
    .addItem("Refresh all tabs", "refreshKioskTabs")
    .addToUi();
}

function setupKioskTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  TAB_SPECS.forEach(function (spec) {
    var sheet = getOrCreateSheet_(ss, spec.sheetName);
    sheet.clear();
    sheet.setFrozenRows(1);
  });
}

function refreshKioskTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  TAB_SPECS.forEach(function (spec) {
    var csvText = loadCsvText_(spec);
    writeCsvToSheet_(getOrCreateSheet_(ss, spec.sheetName), csvText);
  });
}

function refreshAttendanceReportTab() {
  refreshSingleTab_(TAB_SPECS[0]);
}

function refreshMeetingReportTab() {
  refreshSingleTab_(TAB_SPECS[1]);
}

function refreshCheckinDataTab() {
  refreshSingleTab_(TAB_SPECS[2]);
}

function refreshSingleTab_(spec) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  writeCsvToSheet_(getOrCreateSheet_(ss, spec.sheetName), loadCsvText_(spec));
}

function loadCsvText_(spec) {
  var props = PropertiesService.getScriptProperties();
  var inlineCsv = props.getProperty(spec.csvPropertyName);
  if (inlineCsv && inlineCsv.trim()) {
    return inlineCsv;
  }

  var url = props.getProperty(spec.urlPropertyName);
  if (url && url.trim()) {
    return fetchText_(url.trim());
  }

  throw new Error(
    "Set script property " +
      spec.csvPropertyName +
      " with raw CSV text, or " +
      spec.urlPropertyName +
      " with a CSV URL."
  );
}

function fetchText_(url) {
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: false,
    followRedirects: true,
  });
  return response.getContentText();
}

function writeCsvToSheet_(sheet, csvText) {
  var rows = Utilities.parseCsv(csvText);
  if (!rows || rows.length === 0) {
    sheet.clearContents();
    return;
  }

  var width = rows.reduce(function (maxWidth, row) {
    return Math.max(maxWidth, row.length);
  }, 0);

  var paddedRows = rows.map(function (row) {
    var copy = row.slice();
    while (copy.length < width) {
      copy.push("");
    }
    return copy;
  });

  sheet.clearContents();
  sheet.getRange(1, 1, paddedRows.length, width).setValues(paddedRows);
  sheet.setFrozenRows(1);

  if (width > 0) {
    sheet.getRange(1, 1, 1, width).setFontWeight("bold");
    sheet.autoResizeColumns(1, width);
  }
}

function getOrCreateSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}
