# Google Sheets tabs

This folder contains a Google Apps Script that can populate three tabs from CSV data:

- `Attendance Report`
- `Meeting Report`
- `Check in Data`

## How to use

1. Open a Google Sheet.
2. Go to `Extensions` > `Apps Script`.
3. Paste the contents of `KioskTabs.gs` into the script editor.
4. Save the project and reload the spreadsheet.
5. Use the new `TerrorBytes Kiosk` menu to set up or refresh tabs.

## Data source options

The script reads either raw CSV text or a CSV URL from Script Properties.

Set one of these property pairs for each tab:

- `ATTENDANCE_REPORT_CSV` or `ATTENDANCE_REPORT_URL`
- `MEETING_REPORT_CSV` or `MEETING_REPORT_URL`
- `CHECKIN_DATA_CSV` or `CHECKIN_DATA_URL`

If the `*_CSV` property is present, it wins. Otherwise the script tries the `*_URL` property and fetches the CSV from there.

## Notes

- The kiosk app already generates CSV for all three report types.
- If you want this sheet to refresh automatically, you can add a time-driven trigger in Apps Script for `refreshKioskTabs`.
