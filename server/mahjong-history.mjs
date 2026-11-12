import {tableView} from './mahjong.mjs';

export function createMahjongHistory(project = tableView,seats = 4) {
  const histories = Array.from({length:seats},() => []);
  return {
    record(game,event,time,actor,privateAction,action) {
      histories.forEach((history,seat) => {
        if (privateAction && seat !== actor) return;
        const position = structuredClone(project(game,seat));
        history.push({event,time,side:actor === undefined ? undefined : actor + 1,
          action:seat === actor ? action : undefined,position});
      });
    },
    read(seat) { return histories[seat]; },
  };
}
