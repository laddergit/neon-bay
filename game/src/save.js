// Neon Bay — saving to localStorage: cash, mission progress, position,
// health, ammo, the clock and the stats. The seed is saved too, so a
// continued game wakes up in the same city it left.

const KEY = 'neon-bay-save-v1';

export function saveGame(S) {
  try {
    const data = {
      cash: S.player.cash,
      missionIdx: S.mission.idx,
      missionStage: S.mission.stage,
      px: S.player.x,
      py: S.player.y,
      hp: S.player.hp,
      ammo: S.player.ammo,
      reserve: S.player.reserve,
      clockMin: S.clockMin,
      seed: S.seed,
      stats: S.stats,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
}

export function saveExists() {
  return loadGame() !== null;
}
