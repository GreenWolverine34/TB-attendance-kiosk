# TerrorBytes Attendance Kiosk

An Electron-based touch console application tailored for the TerrorBytes Robotics team. This application processes student attendance by logging check-ins and check-outs to a local SQLite database, with integrated capabilities to broadcast updates over Slack, email automated summaries via Gmail SMTP, and sync live session summaries to Google Sheets.

## Prerequisites & Dependency Setup

Before setting up the project on a Raspberry Pi, update the package lists and install the required build tools:

sudo apt update
sudo apt install -y git dpkg-dev fakeroot build-essential

Node.js Setup:
Install NVM and the current Node.js LTS release:

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
source ~/.bashrc
nvm install --lts

Verify the installation:
node --version
npm --version

## Installation & Setup

### 1. Clone the Repository
cd ~
git clone https://github.com/GreenWolverine34/TB-attendance-kiosk/
cd TB-attendance-kiosk

### 2. Install Project Dependencies
npm install

### 3. Environment Configuration
cp .env.example .env
nano .env

Configure the required settings and secrets:

ATTENDANCE_KIOSK_PIN=4561
ATTENDANCE_EXPORT_PIN=1654
ATTENDANCE_EXIT_KIOSK_PIN=YOUR_SECRET_KIOSK_TOGGLE_PIN

GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type": "service_account", ...}

GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASS=your_16_character_app_password
REPORT_EMAIL_TO_ADDRESS=destination@domain.com

SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

Do not commit .env or any other file containing passwords, API keys, tokens, or service-account credentials to GitHub.

## PIN Configuration

- ATTENDANCE_KIOSK_PIN — administrative attendance controls.
- ATTENDANCE_EXPORT_PIN — access to attendance exports and student import functions.
- ATTENDANCE_EXIT_KIOSK_PIN — secret kiosk toggle PIN.

The kiosk toggle PIN does not close the application. Entering the kiosk toggle PIN once exits kiosk mode so an administrator can access the normal desktop/application window. Entering the same PIN again re-enters kiosk mode. Keep all PINs secret.

## Running the Application Locally

Before creating a production package, test the application:

npm start

Verify that:
- The attendance interface launches.
- Student IDs can be entered.
- The administrative PINs work.
- The kiosk toggle PIN works.
- Database operations work correctly.

## Initialize the Roster

The system checks incoming numeric inputs against pre-registered student profiles stored in the local SQLite database.

### 1. Prepare the CSV
Locate students.csv in the project root. Edit the file using this format:

id_number,first_name,last_name,slack_id
1234567890,John,Doe,@johndoe

Student IDs should be exactly 10 digits.

### 2. Import the Roster
1. Start the application.
2. Enter the ATTENDANCE_EXPORT_PIN.
3. Select Import Students.
4. Select the completed students.csv file.

The imported roster is stored in the kiosk's local SQLite database.

## Google Sheets Automation Setup

The repository contains a custom Google Apps Script:
google-sheets/KioskTabs.gs

The script automatically organizes the spreadsheet dashboard and generates the required formula views.

### Setup Steps
1. Create a new Google Sheet.
2. Open Extensions → Apps Script.
3. Clear the existing template code.
4. Paste the complete contents of google-sheets/KioskTabs.gs.
5. Save the Apps Script project.
6. Refresh the spreadsheet.
7. Open the TerrorBytes Kiosk menu.
8. Select Set up / Reset Kiosk Tabs.

The script will create the required kiosk tracking tabs and dashboard layout.

## Production Build & Raspberry Pi Deployment

The Raspberry Pi package can be created directly on a 64-bit Raspberry Pi without Docker.

### Verify Pi Architecture
Run:
uname -m

Expected result:
aarch64

### Build the ARM64 Package
From the project directory:
npm run make:pi

This runs Electron Forge with:
--platform linux --arch arm64

## Slack Integration Commands

When configured with valid Slack Socket Mode tokens, the kiosk supports remote attendance commands.

- /attendance — Posts a live list of currently checked-in attendees.
- /attendance close — Forces a bulk checkout, emails the attendance report, and locks the console UI.
- /attendance help — Displays the available attendance commands and usage information.

## Data Safety & Shutdown Behavior

The kiosk is designed to prevent attendance data loss during normal application shutdowns, reboots, and unexpected power interruptions where possible.

The application:
- Intercepts before-quit application termination signals.
- Automatically signs out active students using the current timestamp.
- Preserves recorded attendance hours when the application shuts down.
- Stores attendance data in the local SQLite database.

Always shut down the Raspberry Pi normally when possible rather than disconnecting power while the application is writing data.

## Raspberry Pi Automatic Startup

For a dedicated kiosk installation, the Electron attendance application should be started automatically when the Raspberry Pi graphical desktop session begins.


Before configuring automatic startup, verify components work manually:
npm start

## Technical Note
Running `npm install` installs Node dependencies, but native modules like SQLite still require system build tools. Keeping `build-essential`, `dpkg-dev`, and `fakeroot` installed via apt ensures native modules compile cleanly.

