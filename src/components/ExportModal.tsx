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
    const [numCheckinsToday, setNumCheckinsToday] = useState(0);
    const [numCheckoutsToday, setNumCheckoutsToday] = useState(0);
    const [checkoutRatePercent, setCheckoutRatePercent] = useState(0);

    // Selected report type (right-side buttons)
    const [selectedReportType, setSelectedReportType] = useState<"attendance" | "meeting" | "checkin">("attendance");

    function handleModalOpen() {
        const defaultStartDate = getStartDate();
        const defaultEndDate = getToday();

        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setSelectedReportType("attendance");

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

        // Actions (left column)
        if (buttonName === "action-export-usb") {
            // Export the currently selected report to USB (sendToSlack = false)
            if (selectedReportType === "attendance") {
                window.electron.exportAttendanceReport(startDate, endDate, 0, false);
            } else if (selectedReportType === "meeting") {
                window.electron.exportMeetingReport(startDate, endDate, 0, false);
            } else if (selectedReportType === "checkin") {
                window.electron.exportCheckinData(startDate, endDate, 0, false);
            }
        } else if (buttonName === "action-sync-google") {
            window.electron.syncToGoogleSheet();
        } else if (buttonName === "action-send-email") {
            window.electron.sendReportEmail(selectedReportType);
        }

        // Other actions
        else if (buttonName === "import-students") {
            window.electron.importStudents();
        }

        // Note: report-type buttons are handled with onClick (no form submit)
    }

    return <Modal
        className="modal export-modal"
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

            {/* Import Students above the two-column area */}
            <div className="modal-row">
                <button
                    name="import-students"
                    className="modal-submit-button"
                    type="submit">
                    Import Students
                </button>
            </div>

            {/* Two-column layout: left = actions, right = report type selectors */}
            <div className="modal-row two-column">
                <div className="column actions-column">
                    <button
                        name="action-export-usb"
                        className="modal-submit-button main-action"
                        type="submit">
                        Export to USB Drive
                    </button>

                    <button
                        name="action-sync-google"
                        className="modal-submit-button main-action"
                        type="submit">
                        Sync to Google Sheets
                    </button>

                    <button
                        name="action-send-email"
                        className="modal-submit-button main-action"
                        type="submit">
                        Send Report Email
                    </button>
                </div>

                <div className="column reports-column">
                    <div className={`report-option ${selectedReportType === "attendance" ? "selected" : ""}`}>
                        <button
                            type="button"
                            className="modal-submit-button report-select"
                            onClick={() => setSelectedReportType("attendance")}
                        >
                            Attendance Report
                        </button>
                    </div>

                    <div className={`report-option ${selectedReportType === "meeting" ? "selected" : ""}`}>
                        <button
                            type="button"
                            className="modal-submit-button report-select"
                            onClick={() => setSelectedReportType("meeting")}
                        >
                            Meeting Report
                        </button>
                    </div>

                    <div className={`report-option ${selectedReportType === "checkin" ? "selected" : ""}`}>
                        <button
                            type="button"
                            className="modal-submit-button report-select"
                            onClick={() => setSelectedReportType("checkin")}
                        >
                            Check in Data
                        </button>
                    </div>
                </div>
            </div>
        </form>
    </Modal>;
}
