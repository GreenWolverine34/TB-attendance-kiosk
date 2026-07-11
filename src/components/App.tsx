import { useState, useEffect } from "react";
import Clock from "./Clock";
import AttendanceRoster from "./AttendanceRoster";
import Form from "./Form";
import Logo from "./Logo";
import ExportModal from "./ExportModal";
import Modal from "react-modal";
import { AdminCodeAction, CurrentAttendanceEntry, EnabledActions } from "../types";

const PROMPT_SCAN = "Tap your NFC sticker on reader or enter PIN";
const PROMPT_LOCKED = "Enter attendance PIN to unlock scanning";
const PROMPT_WRONG_PIN = "Wrong PIN — try again";
const PROMPT_CLOSE_ERROR = "Could not close attendance";
const PROMPT_SUCCESS = "Check-in recorded";
const PROMPT_CLOSED = "Attendance closed";
const PROMPT_CLOSED_EMAIL = "Attendance closed and email sent";
const PROMPT_EXPORT = "Export reports";

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lastPromptTime, setLastPromptTime] = useState(null);
  const [promptText, setPromptText] = useState(PROMPT_LOCKED);
  const [hasFocus, setHasFocus] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [attendance, setAttendance] = useState<CurrentAttendanceEntry[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [enabledActions, setEnabledActions] = useState<EnabledActions>({
    sendToSlack: false,
    syncToMyPulse: false,
    sendReportEmail: false,
    backupDBToS3: false,
  });

  function handleSubmit(name: string) {
    setPromptText(name ? `${name} clocked in` : PROMPT_SUCCESS);
    setLastPromptTime(new Date());
  }

  async function handleAdminCode(pin: string): Promise<AdminCodeAction | null> {
    const response = await window.electron.authorizeAdminCode(pin);
    if (!response.success || !response.action) {
      setPromptText(PROMPT_WRONG_PIN);
      setLastPromptTime(new Date());
      return null;
    }

    if (response.action === "export") {
      setExportModalOpen(true);
      setPromptText(PROMPT_EXPORT);
      setLastPromptTime(new Date());
      return "export";
    }

    const nextUnlocked = !isUnlocked;
    if (!nextUnlocked) {
      const closeResponse = await window.electron.closeAttendance();
      if (!closeResponse.success) {
        setPromptText(PROMPT_CLOSE_ERROR);
        setLastPromptTime(new Date());
        return null;
      }
      setPromptText(
        closeResponse.emailed
          ? (closeResponse.numClosed > 0 ? `${PROMPT_CLOSED_EMAIL} — ${closeResponse.numClosed} checked out` : PROMPT_CLOSED_EMAIL)
          : (closeResponse.numClosed > 0 ? `${PROMPT_CLOSED} — ${closeResponse.numClosed} checked out` : PROMPT_CLOSED),
      );
    }
    setIsUnlocked(nextUnlocked);
    setShowRoster(false);
    if (nextUnlocked) {
      setPromptText(PROMPT_SCAN);
    }
    setLastPromptTime(new Date());
    return "attendance";
  }

  async function refreshAttendance() {
    try {
      const currentAttendance = await window.electron.getCurrentAttendance();
      setAttendance(currentAttendance);
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    if (lastPromptTime === null) {
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (promptText.endsWith("clocked in") || promptText === PROMPT_SUCCESS) {
      timeout = setTimeout(() => setPromptText(PROMPT_SCAN), 2000);
    } else if (promptText.startsWith(PROMPT_CLOSED)) {
      timeout = setTimeout(() => setPromptText(PROMPT_LOCKED), 2000);
    } else if (promptText === PROMPT_CLOSE_ERROR) {
      timeout = setTimeout(() => setPromptText(PROMPT_LOCKED), 10000);
    } else if (promptText === PROMPT_WRONG_PIN) {
      timeout = setTimeout(() => setPromptText(PROMPT_LOCKED), 10000);
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [lastPromptTime, promptText]);

  useEffect(() => {
    const handleFocus = () => setHasFocus(true);
    const handleBlur = () => setHasFocus(false);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.electron.getEnabledActions().then(setEnabledActions);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!isUnlocked || !showRoster) {
      return;
    }
    refreshAttendance();
    const interval = setInterval(refreshAttendance, 10000);
    return () => clearInterval(interval);
  }, [isUnlocked, showRoster]);

  function handleCloseExportModal() {
    setExportModalOpen(false);
    setPromptText(isUnlocked ? PROMPT_SCAN : PROMPT_LOCKED);
    setLastPromptTime(new Date());
  }

  let footerClass = "footer";
  if (promptText.endsWith("clocked in") || promptText === PROMPT_SUCCESS || promptText.startsWith(PROMPT_CLOSED)) {
    footerClass += " ok";
  } else if (promptText === PROMPT_WRONG_PIN || promptText === PROMPT_CLOSE_ERROR) {
    footerClass += " error";
  }

  return (
    <>
      <Modal className="modal focus-modal" isOpen={!hasFocus}>
        <div className="focus-modal-content" onClick={() => setHasFocus(true)}>
          <h1>Please tap the screen to continue</h1>
        </div>
      </Modal>

      {/* HEADER SECTION WITH FLOATING TOP-RIGHT CREDIT TEXT */}
      <div className="header-container">
        <h1 className="title">TerrorBytes Attendance</h1>
        <p className="source-credit">Modified from 694 Attendance System</p>
      </div>

      <div className="row">
        {/* LEFT PANEL */}
        <div className="column">
          {showRoster ? <AttendanceRoster attendees={attendance} /> : <Logo />}
          <Clock />
        </div>

        {/* MIDDLE SPLITTER LINE */}
        <div className="column-divider"></div>

        {/* RIGHT PANEL */}
        <div className="column">
          {!isUnlocked ? (
            <div className="pin-panel">
              <h2>Admin PIN Required</h2>
              <Form isUnlocked={false} isActive={true} onAdminCode={handleAdminCode} onSuccess={(name) => { refreshAttendance(); handleSubmit(name); }} />
            </div>
          ) : (
            <Form isUnlocked={true} isActive={true} onAdminCode={handleAdminCode} onSuccess={(name) => { refreshAttendance(); handleSubmit(name); }} />
          )}
        </div>
      </div>

      {/* FOOTER STRIP */}
      <div className={footerClass}>
        <span className="prompt">{promptText}</span>
      </div>

      <ExportModal isOpen={exportModalOpen} onClose={handleCloseExportModal} enabledActions={enabledActions} />
    </>
  );
}
