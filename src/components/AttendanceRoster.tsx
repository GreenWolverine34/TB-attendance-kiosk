import { CurrentAttendanceEntry } from "../types";

interface AttendanceRosterProps {
    attendees: CurrentAttendanceEntry[];
}

function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatName(attendee: CurrentAttendanceEntry) {
    const fullName = `${attendee.firstName} ${attendee.lastName}`.trim();
    return fullName.length > 0 ? fullName : attendee.idNumber;
}

export default function AttendanceRoster({ attendees }: AttendanceRosterProps) {
    return (
        <div className="attendance-roster">
            <div className="attendance-roster-header">
                <h2>Meeting Roster</h2>
                <p>{attendees.length} currently checked in</p>
            </div>
            <div className="attendance-roster-list">
                {attendees.length === 0 ? (
                    <div className="attendance-roster-empty">No one has checked in yet.</div>
                ) : attendees.map((attendee) => (
                    <div className="attendance-roster-item" key={`${attendee.idNumber}-${attendee.checkinTime}`}>
                        <div className="attendance-roster-name">{formatName(attendee)}</div>
                        <div className="attendance-roster-time">Since {formatTime(attendee.checkinTime)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
