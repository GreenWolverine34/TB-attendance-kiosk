export interface TodaysStats {
    numCheckins: number;
    numCheckouts: number;
    checkoutRatePercent: number;
}

export interface EnabledActions {
    sendToSlack: boolean;
    sendReportEmail: boolean;
}

export interface CurrentAttendanceEntry {
    idNumber: string;
    firstName: string;
    lastName: string;
    checkinTime: string;
}

export type AdminCodeAction = "attendance" | "export";
