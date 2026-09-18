export const roomPresence = new Map();

export function getRoomParticipantCount(roomId) {
  return roomPresence.get(String(roomId))?.size || 0;
}