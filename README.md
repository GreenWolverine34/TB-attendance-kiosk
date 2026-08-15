# TerrorBytes Attendance Kiosk

An Electron-based touch console application tailored for the TerrorBytes Robotics team. This application processes student attendance by logging check-ins and check-outs to a local SQLite database, with integrated capabilities to broadcast updates over Slack, email automated summaries via Gmail SMTP, and sync live session summaries to Google Sheets.

### Prerequisites & Dependency Setup

Before setting up the project, update your package lists and install all core runtime dependencies, development build tools (`dpkg`/`fakeroot`), and Docker:

```bash
# 1. Update system repository structures and install packaging tools
sudo apt update && sudo apt install -y dpkg-dev fakeroot

# 2. Install Docker using the official automated helper script
#replace USER with username on Pi
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker \USER && newgrp docker

# 3. Install NVM & Node.js LTS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
source ~/.bashrc
nvm install --lts
```

## Installation & Setup

Follow these clean, step-by-step commands in your local shell to replicate and register the repository codebase.

### 1. Clone the Repository

Clone the project directly from GitHub using your terminal environment, then change into the correct parent application directory:

```bash
# Clone the repository structure from GitHub
git clone https://github.com/GreenWolverine34/TB-attendance-kiosk/

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
Copy the configuration template or create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Configure your local secrets inside your `.env` file:
```env
ATTENDANCE_KIOSK_PIN=4561
ATTENDANCE_EXPORT_PIN=1654

GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type": "service_account", ...}

GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASS=your_16_character_app_password
REPORT_EMAIL_TO_ADDRESS=destination@domain.com

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

## Google Sheets Automation Setup

The repository contains a custom Google Apps Script (`google-sheets/KioskTabs.gs`) to automatically organize your spreadsheet dashboard, generate formula views, and split hours between different sub-seasons.

1. Create a new **Google Sheet**.
2. Click on **Extensions** > **Apps Script**.
3. Clear any template code and paste the complete contents of `google-sheets/KioskTabs.gs`.
4. Save the script project and refresh your spreadsheet. A new **TerrorBytes Kiosk** option will appear on the top menu bar.
5. Click **TerrorBytes Kiosk** > **Set up / Reset Kiosk Tabs** to automatically build your tracking dashboard layouts.

## Production Build & Pi Deployment

To compile and pack the standalone desktop package specifically optimized for 64-bit arm processors (such as a Raspberry Pi touch terminal deployment):

```bash
# Execute the multi-stage Docker build environment loop
npm run build

# Alternatively, trigger the specific architecture target pack natively
npm run make:pi
```
## Slack Integration Commands
When configured with valid Socket Mode tokens, you can issue remote commands to your kiosk:

* `/attendance` — Posts a live list of currently checked-in attendees.
* `/attendance close` — Forces a bulk checkout, emails the report, and locks the console UI.
* `/attendance help` — Prints system syntax reminders.

## Data Safety & Shutdown Behavior
To prevent tracking data loss during power cutouts or reboots:
* Intercepts `before-quit` app termination signals.
* Automatically signs out any active student using the current timestamp to preserve hours.

## License

This project is open-source software licensed under the terms of the **MIT License**.
