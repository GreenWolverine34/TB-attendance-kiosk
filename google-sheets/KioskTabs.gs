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
    .addItem("Generate Hours Summary", "generateHoursSummary")
    .addToUi();
}

/**
 * Generate an hours summary per person by aggregating the 'total_hours' column
 * from the 'Check in Data' sheet. Writes results to (or creates) a sheet named
 * 'Hours Summary' with columns: id_number, first_name, last_name, total_hours
 */
function generateHoursSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var checkinSheet = ss.getSheetByName('Check in Data');
  if (!checkinSheet) {
    SpreadsheetApp.getUi().alert('Check in Data sheet not found. Run Refresh Checkin Data first.');
    return;
  }

  var values = checkinSheet.getDataRange().getValues();
  if (!values || values.length <= 1) {
    SpreadsheetApp.getUi().alert('No data found in Check in Data.');
    return;
  }

  // Identify header indices (case-insensitive match)
  var header = values[0].map(function(h) { return String(h || '').trim(); });
  var idxId = header.findIndex(function(h) { return /^id[_ ]?number$/i.test(h); });
  var idxFirst = header.findIndex(function(h) { return /^first[_ ]?name$/i.test(h); });
  var idxLast = header.findIndex(function(h) { return /^last[_ ]?name$/i.test(h); });
  var idxHours = header.findIndex(function(h) { return /^(total[_ ]?)?hours$/i.test(h); });

  if (idxId === -1 || idxFirst === -1 || idxLast === -1 || idxHours === -1) {
    SpreadsheetApp.getUi().alert('Check in Data sheet is missing expected columns (id_number, first_name, last_name, total_hours).');
    return;
  }

  var totals = {}; // map idNumber -> { firstName, lastName, totalHours }
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = String(row[idxId] || '').trim();
    if (!id) continue;
    var first = String(row[idxFirst] || '').trim();
    var last = String(row[idxLast] || '').trim();
    var hoursRaw = row[idxHours];
    var hours = 0;
    if (typeof hoursRaw === 'number') {
      hours = hoursRaw;
    } else if (typeof hoursRaw === 'string' && hoursRaw.trim() !== '') {
      // remove possible units and commas
      var cleaned = hoursRaw.replace(/[^0-9.\-]/g, '');
      hours = parseFloat(cleaned) || 0;
    }

    if (!totals[id]) {
      totals[id] = { firstName: first, lastName: last, totalHours: 0 };
    }
    totals[id].totalHours += hours;
  }

  // Prepare output rows
  var outRows = [['id_number','first_name','last_name','total_hours']];
  Object.keys(totals).sort().forEach(function(id) {
    var t = totals[id];
    outRows.push([id, t.firstName || '', t.lastName || '', Number(t.totalHours.toFixed(2))]);
  });

  var outSheet = ss.getSheetByName('Hours Summary');
  if (!outSheet) {
    outSheet = ss.insertSheet('Hours Summary');
  } else {
    outSheet.clearContents();
  }

  outSheet.getRange(1,1,outRows.length,outRows[0].length).setValues(outRows);
  outSheet.setFrozenRows(1);
  outSheet.autoResizeColumns(1,outRows[0].length);

  SpreadsheetApp.getUi().alert('Hours Summary generated with ' + (outRows.length-1) + ' rows.');
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
