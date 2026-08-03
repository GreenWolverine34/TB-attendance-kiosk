import React, { useState } from "react";
import Modal from "react-modal";
import { getStartDate, getToday } from "../util";
import { EnabledActions } from "../types";
import packageJSON from "../../package.json";

const DEFAULT_MEETING_THRESHOLD = "20";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    enabledActions: EnabledActions;
}

Modal.setAppElement("#app");

export default function ExportModal({ isOpen, onClose, enabledActions }: ExportModalProps) {
    const defaultStartDate = getStartDate();
    const defaultEndDate = getToday();
    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [sendToSlack, setSendToSlack] = useState(true);
    const [sendToSlack, setSendToSlack] = useState(true);
    const [numCheckinsToday, setNumCheckinsToday] = useState(0);
    const [numCheckoutsToday, setNumCheckoutsToday] = useState(0);
    const [checkoutRatePercent, setCheckoutRatePercent] = useState(0);

    function handleModalOpen() {
        const defaultStartDate = getStartDate();
        const defaultEndDate = getToday();

        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setSendToSlack(false);

        window.electron.getTodaysStats().then(({ numCheckins, numCheckouts, checkoutRatePercent }) => {
            setNumCheckinsToday(numCheckins);
            setNumCheckoutsToday(numCheckouts);
            setCheckoutRatePercent(checkoutRatePercent);
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const buttonName = (submitter as HTMLButtonElement).name;
        if (buttonName === "export-attendance-report") {
            window.electron.exportAttendanceReport(startDate, endDate, 0, sendToSlack);
        } else if (buttonName === "export-meeting-report") {
            window.electron.exportMeetingReport(startDate, endDate, 0, sendToSlack);
        } else if (buttonName === "export-checkin-data") {
            window.electron.exportCheckinData(startDate, endDate, 0, sendToSlack);
        } else if (buttonName === "import-students") {
            window.electron.importStudents();
        } else if (buttonName === "sync-google-sheet") {
            window.electron.syncToGoogleSheet();
        } else if (buttonName === "send-report-email") {
            window.electron.sendReportEmail();
        }
    }

    return <Modal
        className="modal"
        isOpen={isOpen}
        onAfterOpen={handleModalOpen}
        onRequestClose={onClose}
        closeTimeoutMS={250}>
        <button className="modal-close-button" onClick={onClose}>✕</button>
        <h2>Export Reports</h2>
        <div className="modal-row">
            <span className="today-stats">Checkins today: {numCheckinsToday}</span>
            <span className="today-stats">Checkouts today: {numCheckoutsToday}</span>
            <span className="today-stats">Checkout rate: {checkoutRatePercent.toFixed(2)}%</span>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="modal-row">
                <div><label>Date Range</label></div>
                <div className="date-range">
                    <input
                        className="date-input"
                        name="start-date"
                        type="date"
                        value={startDate}
                        required
                        onChange={(e) => setStartDate(e.target.value)} />
                    {" – "}
                    <input
                        className="date-input"
                        name="end-date"
                        type="date"
                        value={endDate}
                        required
                        onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>
            <div className="modal-row">
                <input
                    type="radio"
                    id="export-to-file"
                    name="export-option"
                    checked={!sendToSlack}
                    onChange={() => setSendToSlack(false)} />
                <label htmlFor="export-to-file">Export to USB drive</label>
                <input
                    type="radio"
                    id="send-to-slack"
                    name="export-option"
                    disabled={!enabledActions.sendToSlack}
                    checked={sendToSlack}
                    onChange={() => setSendToSlack(true)} />
                <label htmlFor="send-to-slack">Send to Karissa on Slack</label>
            </div>
            <div className="modal-row">
                <button
                    name="export-attendance-report"
                    className="modal-submit-button"
                    type="submit">
                    Attendance Report
                </button>
                <button
                    name="export-meeting-report"
                    className="modal-submit-button"
                    type="submit">
                    Meeting Report
                </button>
                <button
                    name="export-checkin-data"
                    className="modal-submit-button"
                    type="submit">
                    Check in Data
                </button>
                <button
                    name="import-students"
                    className="modal-submit-button"
                    type="submit">
                    Import Students
                </button>
                <button
                    name="sync-to-mypulse"
                    className="modal-submit-button"
                    type="submit"
                    disabled={!enabledActions.syncToMyPulse}>
                    Sync to MyPulse
                </button>
                <button
                    name="sync-google-sheet"
                    className="modal-submit-button"
                    type="submit"
                    disabled={!enabledActions.sendToGoogleSheet}>
                    Sync to Google Sheets
                </button>
                <button
                    name="send-report-email"
                    className="modal-submit-button"
                    type="submit"
                    disabled={!enabledActions.sendReportEmail}>
                    Send Report Email
                </button>
            </div>
        </form>
        <div className="build-footer">
            attendance-kiosk commit {packageJSON.commit} (built {packageJSON.buildTime})
        </div>
    </Modal>;
}
