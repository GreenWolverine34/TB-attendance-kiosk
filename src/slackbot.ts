const attendeeLines = currentAttendance.map((attendee) => {
  const checkInTime = new Date(attendee.timestamp);
  const diffMs = now.getTime() - checkInTime.getTime();
  
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeSpent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const fullName = `${attendee.firstName} ${attendee.lastName}`;

  // If slackUsername exists, append (@username), otherwise just use full name
  const displayName = attendee.slackUsername 
    ? `(@${attendee.slackUsername})` 
    : `${fullName}`;

  return `• ${displayName} — ${timeSpent}`;
});