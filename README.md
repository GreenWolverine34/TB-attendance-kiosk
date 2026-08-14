# TerrorBytes Attendance Kiosk

An Electron-based touch console application tailored for the TerrorBytes Robotics team. This application processes student attendance by logging check-ins and check-outs to a local SQLite database, with integrated capabilities to broadcast updates over Slack, email automated summaries via Gmail SMTP, and sync live session summaries to Google Sheets.

## 📋 Prerequisites

Before setting up the project, make sure your local system has the following core software runtimes and libraries installed:

* **Language Runtime**: [Node.js](https://nodejs.org) v22.x (Recommended)
* **Build System Dependency**: [Docker](https://docker.com) (Required for compilation targeted at the Raspberry Pi platform)
* **Operating System Package Tools**: `dpkg` and `fakeroot` (Utilized inside Linux/Docker environments for packaging binaries)

## 🚀 Installation & Setup

Follow these clean, step-by-step commands in your local shell to replicate and register the repository codebase.

### 1. Clone the Repository

Clone the project directly from GitHub using your terminal environment, then change into the correct parent application directory:

```bash
# Clone the repository structure from GitHub
git clone https://github.com

# Enter the root directory of the application
cd TB-attendance-kiosk
```
### 2. Install Project Dependencies

Install the necessary Node.js modules listed in the package configuration. This handles both development tools and system libraries like SQLite:

```bash
# Install package dependencies locally
npm install
```

### 3. Environment Configuration

The application uses an environment file to store API tokens, secrets, and authorization pins. Copy the template or create a `.env` file in the root directory:

```bash
# Create your configuration file
touch .env
```

Open the `.env` file in your preferred editor and configure the following variables:

```env
# Security Pins (Used to unlock the UI console and access export screens)
ATTENDANCE_KIOSK_PIN=4561
ATTENDANCE_EXPORT_PIN=1654

# Google Sheets Integration (Optional)
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type": "service_account", "project_id": "..."}

# Automated Email Configuration (Optional Gmail SMTP Setup)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASS=your_16_character_gmail_app_password
REPORT_EMAIL_TO_ADDRESS=destination_email@domain.com

# Slack Integration Tokens (Optional Socket Mode Settings)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
```

### 4. Running the Application Locally

Launch the Electron application in development mode with a live rendering console window:

```bash
# Start the local development server and launch the desktop app
npm start
```
### 5. Initialize the Roster

The system checks incoming numeric inputs against pre-registered student profiles stored in the local SQLite database. To load your team roster:

1. Locate the `students.csv` file in the root directory.
2. Edit the file to match your team layout using this structure:
   ```csv
   id_number,first_name,last_name,slack_id
   1234567890,John,Doe,@johndoe
   ```
3. Boot up the app, type your `ATTENDANCE_EXPORT_PIN` into the keypad, select **Import Students**, and load your edited file.

## 📊 Google Sheets Automation Setup

The repository contains a custom Google Apps Script (`google-sheets/KioskTabs.gs`) to automatically organize your spreadsheet dashboard, generate formula views, and split hours between different sub-seasons.

1. Create a new **Google Sheet**.
2. Click on **Extensions** > **Apps Script**.
3. Clear any template code and paste the complete contents of `google-sheets/KioskTabs.gs`.
4. Save the script project and refresh your spreadsheet. A new **TerrorBytes Kiosk** option will appear on the top menu bar.
5. Click **TerrorBytes Kiosk** > **Set up / Reset Kiosk Tabs** to automatically build your tracking dashboard layouts.

## 🛠️ Production Build & Pi Deployment

To compile and pack the standalone desktop package specifically optimized for 64-bit arm processors (such as a Raspberry Pi touch terminal deployment):

```bash
# Execute the multi-stage Docker build environment loop
npm run build

# Alternatively, trigger the specific architecture target pack natively
npm run make:pi
```
## 💬 Slack Integration & Bot Commands

When configured with valid Socket Mode tokens, the integrated Slack Bolt engine allows team mentors and leaders to monitor or close down studio sessions remotely via channels or direct messages.

The application registers and listens for the following slash command workflow parameters:

* `/attendance` or `/attendance status` — Query the active SQLite runtime instances and post a live list of currently checked-in attendees directly into the channel view.
* `/attendance close` or `/attendance report` — Enforce a bulk check-out operations cycle for all active sessions, trigger automated report transmissions, lock the physical display console UI, and push a final formatted summary line onto Slack.
* `/attendance help` — Print localized ephemeral syntax reminders highlighting structural use criteria.

## 💾 Fail-Safe Shutdown Behavior

To prevent loss of tracking data or session drops during power cutouts or system reboots:
* The primary main lifecycle loop catches system termination signals via an `before-quit` handler interface.
* Any team member remaining on the active roster list at runtime exit is automatically logged out using the closing structural timestamp to preserve calculated tracking histories.

## 📝 License

This project is open-source software licensed under the terms of the **MIT License**.
