export const disconnectMs = 20_000;
export const expiredSeats = (lastSeen, now) =>
  lastSeen.flatMap((seen,seat) => now - seen >= disconnectMs ? [seat] : []);
