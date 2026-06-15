import { useState, useEffect } from "react";
import Clock from "./Clock";
import AttendanceRoster from "./AttendanceRoster";
import Form from "./Form";
import Logo from "./Logo";
import Modal from "react-modal";
import { CurrentAttendanceEntry } from "../types";

const PROMPT_SCAN = "tap your NFC sticker on reader or enter PIN to get data";
const PROMPT_LOCKED = "Enter PIN to unlock scanning";
const PROMPT_WRONG_PIN = "Wrong PIN — try again";
const PROMPT_SUCCESS = "Check-in recorded";

export default function App() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [lastPromptTime, setLastPromptTime] = useState(null);
    const [promptText, setPromptText] = useState(PROMPT_LOCKED);
    const [hasFocus, setHasFocus] = useState(false);
    const [showRoster, setShowRoster] = useState(false);
    const [attendance, setAttendance] = useState<CurrentAttendanceEntry[]>([]);

    function handleSubmit(name: string) {
        setPromptText(name ? `${name} clocked in` : PROMPT_SUCCESS);
        setLastPromptTime(new Date());
    }

    async function handleUnlock(pin: string) {
        const response = await window.electron.unlockWithPin(pin);
        if (!response.success) {
            setPromptText(PROMPT_WRONG_PIN);
            setLastPromptTime(new Date());
            return false;
        }

        const nextUnlocked = !isUnlocked;
        setIsUnlocked(nextUnlocked);
        setShowRoster(false);
        setPromptText(nextUnlocked ? PROMPT_SCAN : PROMPT_LOCKED);
        setLastPromptTime(new Date());
        return true;
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

    let footerClass = "footer";
    if (promptText.endsWith("clocked in") || promptText === PROMPT_SUCCESS) {
        footerClass += " ok";
    } else if (promptText === PROMPT_WRONG_PIN) {
        footerClass += " error";
    }

    return (
        <>
            <Modal
                className="modal focus-modal"
                isOpen={!hasFocus}>
                <div className="focus-modal-content" onClick={() => setHasFocus(true)}>
                    <h1>Please tap the screen to continue</h1>
                </div>
            </Modal>
            <h1 className="title">TerrorBytes Attendance Kiosk</h1>
            <div className="toolbar">
                <button
                    type="button"
                    className="panel-toggle-button"
                    disabled={!isUnlocked}
                    onClick={() => setShowRoster(current => !current)}>
                    {showRoster ? "Branding" : "Roster"}
                </button>
            </div>
            <div className="row">
                <div className="column">
                    {showRoster ? <AttendanceRoster attendees={attendance} /> : <Logo />}
                    <Clock />
                </div>
                <div className="column">
                    {!isUnlocked ? (
                        <div className="pin-panel">
                            <h2>Admin PIN Required</h2>
                            <p className="pin-instructions">{PROMPT_LOCKED}</p>
                            <Form
                                isUnlocked={false}
                                isActive={true}
                                onUnlock={handleUnlock}
                                onSuccess={(name) => {
                                    refreshAttendance();
                                    handleSubmit(name);
                                }} />
                        </div>
                    ) : (
                        <Form
                            isUnlocked={true}
                            isActive={true}
                            onUnlock={handleUnlock}
                            onSuccess={(name) => {
                                refreshAttendance();
                                handleSubmit(name);
                            }} />
                    )}
                </div>
            </div>
            <div className={footerClass}>
                <p className="prompt">{promptText}</p>
            </div>
            <p className="source-credit">Modified from Stuypulse attendance-kiosk</p>
        </>
    );
}
