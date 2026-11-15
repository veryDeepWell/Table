export const disconnectMs = 30_000;
export const expiredSeats = (lastSeen, now) =>
  lastSeen.flatMap((seen,seat) => now - seen >= disconnectMs ? [seat] : []);
