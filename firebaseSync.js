(function () {
  const DEFAULT_DB_PATH = 'nocturnals-dashboard/state';

  let storageKey = null;
  let stateRef = null;
  let realtimeEnabled = false;

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readLocalRaw() {
    if (!storageKey) return null;
    try {
      return localStorage.getItem(storageKey);
    } catch (err) {
      console.warn('Unable to read local dashboard state:', err);
      return null;
    }
  }

  function writeLocalRaw(raw) {
    if (!storageKey || !raw) return;
    try {
      localStorage.setItem(storageKey, raw);
    } catch (err) {
      console.warn('Unable to write local dashboard state:', err);
    }
  }

  async function initialize(options) {
    storageKey = options?.storageKey || null;
    const defaultState = options?.defaultState || null;
    const firebaseConfig = window.__FIREBASE_CONFIG;
    const firebaseNamespace = window.firebase;

    if (!firebaseNamespace || !firebaseConfig || !firebaseConfig.apiKey) {
      realtimeEnabled = false;
      return null;
    }

    try {
      const app = firebaseNamespace.apps.length
        ? firebaseNamespace.app()
        : firebaseNamespace.initializeApp(firebaseConfig);
      const database = app.database();
      const dbPath = window.__FIREBASE_DB_PATH || DEFAULT_DB_PATH;
      stateRef = database.ref(dbPath);
      realtimeEnabled = true;

      const snapshot = await stateRef.once('value');
      if (snapshot.exists()) {
        const remoteState = snapshot.val();
        writeLocalRaw(JSON.stringify(remoteState));
        return cloneState(remoteState);
      }

      const localRaw = readLocalRaw();
      if (localRaw) {
        const localState = JSON.parse(localRaw);
        await stateRef.set(localState);
        return cloneState(localState);
      }

      if (defaultState) {
        const cleanDefault = cloneState(defaultState);
        await stateRef.set(cleanDefault);
        writeLocalRaw(JSON.stringify(cleanDefault));
        return cleanDefault;
      }
    } catch (err) {
      console.warn('Firebase sync unavailable. Falling back to local storage.', err);
      realtimeEnabled = false;
      stateRef = null;
    }

    return null;
  }

  function subscribe(onStateChange) {
    if (!realtimeEnabled || !stateRef || typeof onStateChange !== 'function') {
      return () => {};
    }

    const callback = (snapshot) => {
      if (!snapshot.exists()) return;
      const value = snapshot.val();
      writeLocalRaw(JSON.stringify(value));
      onStateChange(cloneState(value));
    };

    stateRef.on('value', callback);
    return () => stateRef.off('value', callback);
  }

  function saveState(nextState) {
    const safeState = cloneState(nextState);
    writeLocalRaw(JSON.stringify(safeState));

    if (!realtimeEnabled || !stateRef) return;
    stateRef.set(safeState).catch((err) => {
      console.warn('Failed to sync dashboard state to Firebase:', err);
    });
  }

  window.firebaseSync = {
    initialize,
    subscribe,
    saveState,
    isRealtimeEnabled: () => realtimeEnabled,
  };
})();
