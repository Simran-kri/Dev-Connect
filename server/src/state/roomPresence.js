// Shared across socket.js (which writes to this as people join/leave) and
// routes/rooms.js (which reads from it to show real "is anyone actually
// here right now" status in the room list).
export const roomPresence = new Map();

export function getRoomParticipantCount(roomId) {
  return roomPresence.get(String(roomId))?.size || 0;
}
