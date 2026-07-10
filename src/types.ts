export interface TodaysStats {
    numCheckins: number;
    numCheckouts: number;
    checkoutRatePercent: number;
}

export interface CurrentAttendanceEntry {
    idNumber: string;
    firstName: string;
    lastName: string;
    checkinTime: string;
}

export type AdminCodeAction = "attendance" | "export";

export interface BluetoothDevice {
    address: string;
    name: string;
}

export type ExportDestination = "usb" | "bluetooth";

export interface ExportResult {
    success: boolean;
    cancelled?: boolean;
    message?: string;
}
