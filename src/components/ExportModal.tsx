import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { getStartDate, getToday } from "../util";
import { EnabledActions } from "../types";

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

  const [activeColumn, setActiveColumn] = useState<"actions" | "reports">("reports");
  const [selectedReportType, setSelectedReportType] = useState<"attendance" | "meeting" | "checkin">("attendance");
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);

  function handleModalOpen() {
    setStartDate(getStartDate());
    setEndDate(getToday());
    setSelectedReportType("attendance");
    setSelectedActionIndex(0);
    setActiveColumn("reports");
    window.electron.getTodaysStats().then(({ numCheckins, numCheckouts, checkoutRatePercent }) => {
      setNumCheckinsToday(numCheckins);
      setNumCheckoutsToday(numCheckouts);
      setCheckoutRatePercent(checkoutRatePercent);
    });
  }

  function executeActionIndex(index: number) {
    if (index === 0) {
      if (selectedReportType === "attendance") {
        window.electron.exportAttendanceReport(startDate, endDate, 0, false);
      } else if (selectedReportType === "meeting") {
        window.electron.exportMeetingReport(startDate, endDate, 0, false);
      } else if (selectedReportType === "checkin") {
        window.electron.exportCheckinData(startDate, endDate, 0, false);
      }
    } else if (index === 1) {
      window.electron.syncToGoogleSheet();
    } else if (index === 2) {
      window.electron.sendReportEmail(selectedReportType);
    } else if (index === 3) {
      window.electron.importStudents();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const buttonName = (submitter as HTMLButtonElement).name;
    if (buttonName === "action-export-usb") executeActionIndex(0);
    else if (buttonName === "action-sync-google") executeActionIndex(1);
    else if (buttonName === "action-send-email") executeActionIndex(2);
    else if (buttonName === "import-students") executeActionIndex(3);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "4" || e.code === "Numpad4") {
        e.preventDefault();
        setActiveColumn("actions");
      }
      if (e.key === "ArrowRight" || e.key === "6" || e.code === "Numpad6") {
        e.preventDefault();
        setActiveColumn("reports");
      }

      if (e.key === "ArrowUp" || e.key === "8" || e.code === "Numpad8") {
        e.preventDefault();
        if (activeColumn === "reports") {
          setSelectedReportType((curr) => (curr === "checkin" ? "meeting" : curr === "meeting" ? "attendance" : curr));
        } else {
          setSelectedActionIndex((curr) => (curr > 0 ? curr - 1 : 3));
        }
      }

      if (e.key === "ArrowDown" || e.key === "2" || e.code === "Numpad2") {
        e.preventDefault();
        if (activeColumn === "reports") {
          setSelectedReportType((curr) => (curr === "attendance" ? "meeting" : curr === "meeting" ? "checkin" : curr));
        } else {
          setSelectedActionIndex((curr) => (curr < 3 ? curr + 1 : 0));
        }
      }

      if (e.key === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        if (activeColumn === "reports") executeActionIndex(0);
        else executeActionIndex(selectedActionIndex);
      }

      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeColumn, selectedReportType, selectedActionIndex, startDate, endDate, onClose]);

  return (
    <Modal className="modal export-modal" isOpen={isOpen} onAfterOpen={handleModalOpen} onRequestClose={onClose} closeTimeoutMS={250}>
      <button className="modal-close-button" onClick={onClose}>✕</button>
      <h2>Export Reports</h2>
      <div className="modal-row">
        <span className="today-stats">Checkins today: {numCheckinsToday}</span>
        <span className="today-stats">Checkouts today: {numCheckoutsToday}</span>
        <span className="today-stats">Checkout rate: {checkoutRatePercent.toFixed(2)}%</span>
      </div>

      <div className="modal-row" style={{ background: "#f5f5f5", padding: "0.5rem", borderRadius: "8px", fontSize: "0.9rem", color: "#444" }}>
        <strong>Numpad Nav Controls:</strong>
        <span style={{ margin: "0 0.5rem" }}>↕ [8 / 2] Move</span> |
        <span style={{ margin: "0 0.5rem" }}>↔ [4 / 6] Swap Column</span> |
        <span style={{ margin: "0 0.5rem" }}>⏎ [Enter] Select Action</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-row">
          <div><label>Date Range</label></div>
          <div className="date-range">
            <input className="date-input" name="start-date" type="date" value={startDate} required onChange={(e) => setStartDate(e.target.value)} />
            {" – "}
            <input className="date-input" name="end-date" type="date" value={endDate} required onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* TWO COLUMN SECTION */}
        <div className="modal-row two-column">
          <div className={`column actions-column ${activeColumn === "actions" ? "column-active-highlight" : ""}`} style={{ border: activeColumn === "actions" ? "2px dashed #247c28" : "2px solid transparent", padding: "0.5rem", borderRadius: "8px" }}>
            <button
              name="action-export-usb"
              className={`modal-submit-button main-action ${activeColumn === "actions" && selectedActionIndex === 0 ? "keyboard-focused" : ""}`}
              style={{ background: activeColumn === "actions" && selectedActionIndex === 0 ? "#e2f0d9" : "", borderColor: activeColumn === "actions" && selectedActionIndex === 0 ? "#247c28" : "" }}
              type="submit">
              Export to USB Drive
            </button>

            <button
              name="action-sync-google"
              className={`modal-submit-button main-action ${activeColumn === "actions" && selectedActionIndex === 1 ? "keyboard-focused" : ""}`}
              style={{ background: activeColumn === "actions" && selectedActionIndex === 1 ? "#e2f0d9" : "", borderColor: activeColumn === "actions" && selectedActionIndex === 1 ? "#247c28" : "" }}
              type="submit">
              Sync rawData to Google Sheets
            </button>

            <button
              name="action-send-email"
              className={`modal-submit-button main-action ${activeColumn === "actions" && selectedActionIndex === 2 ? "keyboard-focused" : ""}`}
              style={{ background: activeColumn === "actions" && selectedActionIndex === 2 ? "#e2f0d9" : "", borderColor: activeColumn === "actions" && selectedActionIndex === 2 ? "#247c28" : "" }}
              type="submit">
              Send Report Email
            </button>
          </div>

          <div className={`column reports-column ${activeColumn === "reports" ? "column-active-highlight" : ""}`} style={{ border: activeColumn === "reports" ? "2px dashed #247c28" : "2px solid transparent", padding: "0.5rem", borderRadius: "8px" }}>
            <div className={`report-option ${selectedReportType === "attendance" ? "selected" : ""}`}>
              <button type="button" className="modal-submit-button report-select" style={{ outline: activeColumn === "reports" && selectedReportType === "attendance" ? "3px solid #247c28" : "" }} onClick={() => setSelectedReportType("attendance")}>
                Attendance Report
              </button>
            </div>
            <div className={`report-option ${selectedReportType === "meeting" ? "selected" : ""}`}>
              <button type="button" className="modal-submit-button report-select" style={{ outline: activeColumn === "reports" && selectedReportType === "meeting" ? "3px solid #247c28" : "" }} onClick={() => setSelectedReportType("meeting")}>
                Meeting Report
              </button>
            </div>
            <div className={`report-option ${selectedReportType === "checkin" ? "selected" : ""}`}>
              <button type="button" className="modal-submit-button report-select" style={{ outline: activeColumn === "reports" && selectedReportType === "checkin" ? "3px solid #247c28" : "" }} onClick={() => setSelectedReportType("checkin")}>
                Check in Data
              </button>
            </div>
          </div>
        </div>

        {/* CENTERED AT BOTTOM BELOW TWO COLUMNS */}
        <div className="modal-row" style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
          <button
            name="import-students"
            className={`modal-submit-button ${activeColumn === "actions" && selectedActionIndex === 3 ? "keyboard-focused" : ""}`}
            style={{
              background: activeColumn === "actions" && selectedActionIndex === 3 ? "#e2f0d9" : "",
              borderColor: activeColumn === "actions" && selectedActionIndex === 3 ? "#247c28" : "",
              width: "auto",
              padding: "0.6rem 2rem",
            }}
            type="submit">
            Import Students
          </button>
        </div>
      </form>
    </Modal>
  );
}