let audio;
function enableSound() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ||= new Audio();
  if (audio.state !== 'running') audio.resume().catch(() => {});
}
document.addEventListener('pointerdown',enableSound);
document.addEventListener('keydown',enableSound);

export function watchOpponentMove() {
  let previous;
  return (archive,side) => {
    const events = archive.positions || archive.events || [];
    const start = previous;
    previous = events.length;
    if (start === undefined || audio?.state !== 'running' ||
      !events.slice(start).some(entry => entry.side && entry.side !== side &&
        ['play','pass','roll'].includes(entry.event))) return;
    const note = audio.createOscillator();
    const volume = audio.createGain();
    const now = audio.currentTime;
    note.frequency.setValueAtTime(560,now);
    note.frequency.exponentialRampToValueAtTime(330,now + .09);
    volume.gain.setValueAtTime(.13,now);
    volume.gain.exponentialRampToValueAtTime(.001,now + .12);
    note.connect(volume).connect(audio.destination);
    note.start(now);
    note.stop(now + .13);
  };
}
