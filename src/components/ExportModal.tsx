import React, { useState } from "react";
import Modal from "react-modal";
import { getStartDate, getToday } from "../util";
import { BluetoothDevice, ExportDestination, ExportResult } from "../types";
import packageJSON from "../../package.json";

const DEFAULT_MEETING_THRESHOLD = "20";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ReportKind = "attendance" | "meeting" | "checkin";

Modal.setAppElement("#app");

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Bluetooth action failed";
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const [startDate, setStartDate] = useState(getStartDate());
    const [endDate, setEndDate] = useState(getToday());
    const [meetingThreshold, setMeetingThreshold] = useState(DEFAULT_MEETING_THRESHOLD);
    const [destination, setDestination] = useState<ExportDestination>("usb");
    const [trustedDevices, setTrustedDevices] = useState<BluetoothDevice[]>([]);
    const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
    const [selectedDeviceAddress, setSelectedDeviceAddress] = useState("");
    const [status, setStatus] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [numCheckinsToday, setNumCheckinsToday] = useState(0);
    const [numCheckoutsToday, setNumCheckoutsToday] = useState(0);
    const [checkoutRatePercent, setCheckoutRatePercent] = useState(0);

    async function refreshBluetoothDevices() {
        const [trusted, paired] = await Promise.all([
            window.electron.getTrustedBluetoothDevices(),
            window.electron.getPairedBluetoothDevices(),
        ]);
        setTrustedDevices(trusted);
        setPairedDevices(paired);
        setSelectedDeviceAddress((current) => (
            trusted.some((device) => device.address === current)
                ? current
                : (trusted[0]?.address || "")
        ));
    }

    async function handleModalOpen() {
        setStartDate(getStartDate());
        setEndDate(getToday());
        setMeetingThreshold(DEFAULT_MEETING_THRESHOLD);
        setDestination("usb");
        setStatus("Starting Bluetooth...");

        window.electron.getTodaysStats().then(({ numCheckins, numCheckouts, checkoutRatePercent }) => {
            setNumCheckinsToday(numCheckins);
            setNumCheckoutsToday(numCheckouts);
            setCheckoutRatePercent(checkoutRatePercent);
        }).catch(() => undefined);

        try {
            const response = await window.electron.openBluetoothExport();
            setStatus(response.message);
            if (response.success) {
                await refreshBluetoothDevices();
            }
        } catch (err) {
            setStatus(errorMessage(err));
        }
    }

    function handleClose() {
        window.electron.closeBluetoothExport().catch(() => undefined);
        onClose();
    }

    async function handleRefreshDevices() {
        setIsBusy(true);
        try {
            await refreshBluetoothDevices();
            setStatus("Bluetooth device list refreshed");
        } catch (err) {
            setStatus(errorMessage(err));
        } finally {
            setIsBusy(false);
        }
    }

    async function handleTrustDevice(address: string) {
        setIsBusy(true);
        try {
            const devices = await window.electron.trustBluetoothDevice(address);
            setTrustedDevices(devices);
            setSelectedDeviceAddress(address);
            setStatus("Bluetooth export device trusted");
        } catch (err) {
            setStatus(errorMessage(err));
        } finally {
            setIsBusy(false);
        }
    }

    async function handleRemoveTrustedDevice(address: string) {
        setIsBusy(true);
        try {
            const devices = await window.electron.removeTrustedBluetoothDevice(address);
            setTrustedDevices(devices);
            setSelectedDeviceAddress((current) => current === address ? (devices[0]?.address || "") : current);
            setStatus("Bluetooth export device removed");
        } catch (err) {
            setStatus(errorMessage(err));
        } finally {
            setIsBusy(false);
        }
    }

    async function handleExport(reportKind: ReportKind) {
        if (destination === "bluetooth" && !selectedDeviceAddress) {
            setStatus("Select a trusted Bluetooth device");
            return;
        }

        setIsBusy(true);
        try {
            let result: ExportResult;
            if (reportKind === "attendance") {
                result = await window.electron.exportAttendanceReport(
                    startDate,
                    endDate,
                    Number(meetingThreshold),
                    destination,
                    selectedDeviceAddress || undefined,
                );
            } else if (reportKind === "meeting") {
                result = await window.electron.exportMeetingReport(
                    startDate,
                    endDate,
                    Number(meetingThreshold),
                    destination,
                    selectedDeviceAddress || undefined,
                );
            } else {
                result = await window.electron.exportCheckinData(
                    startDate,
                    endDate,
                    Number(meetingThreshold),
                    destination,
                    selectedDeviceAddress || undefined,
                );
            }

            if (!result.cancelled) {
                setStatus(result.message || "Report export failed");
            }
        } catch (err) {
            setStatus(errorMessage(err));
        } finally {
            setIsBusy(false);
        }
    }

    function decrementMeetingThreshold() {
        setMeetingThreshold(Math.max(Number(meetingThreshold) - 1, 1).toString());
    }

    function incrementMeetingThreshold() {
        setMeetingThreshold(Math.max(Number(meetingThreshold) + 1, 1).toString());
    }

    const trustedAddresses = new Set(trustedDevices.map((device) => device.address));

    return <Modal
        className="modal"
        isOpen={isOpen}
        onAfterOpen={handleModalOpen}
        onRequestClose={handleClose}
        closeTimeoutMS={250}>
        <button className="modal-close-button" type="button" onClick={handleClose}>×</button>
        <h2>Export Reports</h2>
        <div className="modal-row">
            <span className="today-stats">Check-ins today: {numCheckinsToday}</span>
            <span className="today-stats">Check-outs today: {numCheckoutsToday}</span>
            <span className="today-stats">Checkout rate: {checkoutRatePercent.toFixed(2)}%</span>
        </div>
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
            <div><label htmlFor="meeting-threshold">Meeting Threshold</label></div>
            <div>
                <button className="meeting-threshold-button" type="button" onClick={decrementMeetingThreshold}>−</button>
                <input
                    id="meeting-threshold"
                    name="meeting-threshold"
                    value={meetingThreshold}
                    type="number"
                    min="1"
                    required
                    onChange={(e) => setMeetingThreshold(e.target.value)} />
                <button className="meeting-threshold-button" type="button" onClick={incrementMeetingThreshold}>+</button>
            </div>
        </div>
        <div className="modal-row destination-options">
            <input
                type="radio"
                id="export-to-usb"
                name="export-destination"
                checked={destination === "usb"}
                onChange={() => setDestination("usb")} />
            <label htmlFor="export-to-usb">USB stick</label>
            <input
                type="radio"
                id="export-to-bluetooth"
                name="export-destination"
                checked={destination === "bluetooth"}
                onChange={() => setDestination("bluetooth")} />
            <label htmlFor="export-to-bluetooth">Bluetooth</label>
        </div>
        <div className="bluetooth-status" role="status">{status}</div>
        {destination === "bluetooth" && <div className="bluetooth-section">
            <div className="bluetooth-controls">
                <label htmlFor="trusted-bluetooth-device">Trusted device</label>
                <select
                    id="trusted-bluetooth-device"
                    value={selectedDeviceAddress}
                    onChange={(e) => setSelectedDeviceAddress(e.target.value)}>
                    <option value="">Select device</option>
                    {trustedDevices.map((device) => (
                        <option key={device.address} value={device.address}>{device.name}</option>
                    ))}
                </select>
                <button type="button" onClick={handleRefreshDevices} disabled={isBusy}>Refresh</button>
            </div>
            <div className="bluetooth-device-list">
                <div className="bluetooth-list-heading">Trusted export devices</div>
                {trustedDevices.length === 0 && <div className="bluetooth-empty-state">No trusted devices</div>}
                {trustedDevices.map((device) => <div className="bluetooth-device-row" key={device.address}>
                    <span className="bluetooth-device-name">{device.name}</span>
                    <code>{device.address}</code>
                    <button type="button" onClick={() => handleRemoveTrustedDevice(device.address)} disabled={isBusy}>Remove</button>
                </div>)}
            </div>
            <div className="bluetooth-device-list">
                <div className="bluetooth-list-heading">Paired devices</div>
                {pairedDevices.length === 0 && <div className="bluetooth-empty-state">No paired devices</div>}
                {pairedDevices.map((device) => <div className="bluetooth-device-row" key={device.address}>
                    <span className="bluetooth-device-name">{device.name}</span>
                    <code>{device.address}</code>
                    {trustedAddresses.has(device.address)
                        ? <span className="trusted-device-label">Trusted</span>
                        : <button type="button" onClick={() => handleTrustDevice(device.address)} disabled={isBusy}>Trust</button>}
                </div>)}
            </div>
        </div>}
        <div className="modal-row report-actions">
            <button className="modal-submit-button" type="button" onClick={() => handleExport("attendance")} disabled={isBusy}>Attendance Report</button>
            <button className="modal-submit-button" type="button" onClick={() => handleExport("meeting")} disabled={isBusy}>Meeting Report</button>
            <button className="modal-submit-button" type="button" onClick={() => handleExport("checkin")} disabled={isBusy}>Check-in Data</button>
            <button className="modal-submit-button" type="button" onClick={() => window.electron.importStudents()} disabled={isBusy}>Import Students</button>
        </div>
        <div className="build-footer">
            attendance-kiosk commit {packageJSON.commit} (built {packageJSON.buildTime})
        </div>
    </Modal>;
}
