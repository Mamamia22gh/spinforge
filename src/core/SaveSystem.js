export class SaveSystem {
  static STORAGE_KEY = 'spinforge_meta';

  static serialize(meta) {
    return JSON.stringify({ version: 1, timestamp: Date.now(), meta });
  }

  static deserialize(json) {
    try {
      const data = JSON.parse(json);
      if (!data || data.version !== 1 || !data.meta) return null;
      return data.meta;
    } catch { return null; }
  }

  static save(meta) {
    try {
      localStorage.setItem(SaveSystem.STORAGE_KEY, SaveSystem.serialize(meta));
      return true;
    } catch { return false; }
  }

  static load() {
    try {
      const json = localStorage.getItem(SaveSystem.STORAGE_KEY);
      return json ? SaveSystem.deserialize(json) : null;
    } catch { return null; }
  }

  static exportFull(gameState) {
    return JSON.stringify({
      version: 1, timestamp: Date.now(),
      phase: gameState.phase, seed: gameState.seed,
      meta: gameState.meta, run: gameState.run,
    }, null, 2);
  }
}
