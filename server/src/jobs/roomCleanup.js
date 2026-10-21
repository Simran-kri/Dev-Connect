import Room from "../models/Room.js";

const MAX_ROOM_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes

async function sweepOldRooms() {
  try {
    const cutoff = new Date(Date.now() - MAX_ROOM_AGE_MS);
    const result = await Room.deleteMany({ createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`Room cleanup: closed ${result.deletedCount} room(s) older than 6 hours.`);
    }
  } catch (error) {
    console.error("Room cleanup failed (non-fatal):", error.message);
  }
}

export function startRoomCleanupJob() {
  sweepOldRooms();
  const interval = setInterval(sweepOldRooms, SWEEP_INTERVAL_MS);
  interval.unref();
}
