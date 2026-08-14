import { CurrentAttendanceEntry } from "./types";

export function formatAttendanceForSlack(currentAttendance: CurrentAttendanceEntry[], now: Date = new Date()): string[] {
  return currentAttendance.map((attendee) => {
    const checkInTime = new Date(attendee.checkinTime);
    const diffMs = now.getTime() - checkInTime.getTime();
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeSpent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const fullName = `${attendee.firstName} ${attendee.lastName}`.trim();

    return `• ${fullName} — ${timeSpent}`;
  });
}