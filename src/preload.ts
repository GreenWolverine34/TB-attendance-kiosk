// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";
import {
    AdminCodeAction,
    BluetoothDevice,
    CurrentAttendanceEntry,
    ExportDestination,
    ExportResult,
    TodaysStats,
} from "./types";

declare global {
    interface Window {
        electron: {
            submit: (idNumber: string) => Promise<{ success: boolean, name?: string }>;
            authorizeAdminCode: (pin: string) => Promise<{ success: boolean, action?: AdminCodeAction }>;
            closeAttendance: () => Promise<{ success: boolean, numClosed: number }>;
            getTodaysStats: () => Promise<TodaysStats>;
            getCurrentAttendance: () => Promise<CurrentAttendanceEntry[]>;
            exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) => Promise<ExportResult>;
            exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) => Promise<ExportResult>;
            exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) => Promise<ExportResult>;
            importStudents: () => void;
            openBluetoothExport: () => Promise<{ success: boolean, message: string }>;
            closeBluetoothExport: () => Promise<void>;
            getPairedBluetoothDevices: () => Promise<BluetoothDevice[]>;
            getTrustedBluetoothDevices: () => Promise<BluetoothDevice[]>;
            trustBluetoothDevice: (address: string) => Promise<BluetoothDevice[]>;
            removeTrustedBluetoothDevice: (address: string) => Promise<BluetoothDevice[]>;
        }
    }
}

contextBridge.exposeInMainWorld("electron", {
    submit: (idNumber: string) => ipcRenderer.invoke("submit", idNumber),
    authorizeAdminCode: (pin: string) => ipcRenderer.invoke("authorizeAdminCode", pin),
    closeAttendance: () => ipcRenderer.invoke("closeAttendance"),
    getTodaysStats: () => ipcRenderer.invoke("getTodaysStats"),
    getCurrentAttendance: () => ipcRenderer.invoke("getCurrentAttendance"),
    exportAttendanceReport: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) =>
        ipcRenderer.invoke("exportAttendanceReport", startDate, endDate, meetingThreshold, destination, bluetoothAddress),
    exportMeetingReport: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) =>
        ipcRenderer.invoke("exportMeetingReport", startDate, endDate, meetingThreshold, destination, bluetoothAddress),
    exportCheckinData: (startDate: string, endDate: string, meetingThreshold: number, destination: ExportDestination, bluetoothAddress?: string) =>
        ipcRenderer.invoke("exportCheckinData", startDate, endDate, meetingThreshold, destination, bluetoothAddress),
    importStudents: () => ipcRenderer.send("importStudents"),
    openBluetoothExport: () => ipcRenderer.invoke("openBluetoothExport"),
    closeBluetoothExport: () => ipcRenderer.invoke("closeBluetoothExport"),
    getPairedBluetoothDevices: () => ipcRenderer.invoke("getPairedBluetoothDevices"),
    getTrustedBluetoothDevices: () => ipcRenderer.invoke("getTrustedBluetoothDevices"),
    trustBluetoothDevice: (address: string) => ipcRenderer.invoke("trustBluetoothDevice", address),
    removeTrustedBluetoothDevice: (address: string) => ipcRenderer.invoke("removeTrustedBluetoothDevice", address),
});
