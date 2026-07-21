
(() => {
  const firebaseConfig = window.CLOB_FIREBASE_CONFIG;
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.database();

  let currentUser = null;
  const state = { clients: {}, exercises: {}, favorites: {}, recent: {} };

  function userRoot() {
    if (!currentUser) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
    return db.ref(`clob/users/${currentUser.uid}`);
  }

  async function seedExerciseLibrary() {
    const metaRef = db.ref("clob/system/exerciseLibrary");
    const snap = await metaRef.once("value");
    const currentVersion = snap.val()?.version || 0;
    if (currentVersion >= 1) return false;

    const payload = {};
    window.CLOB_STARTER_EXERCISES.forEach(ex => payload[ex.id] = ex);
    await db.ref("clob/exercise_master").set(payload);
    await metaRef.set({
      version: 1,
      count: window.CLOB_STARTER_EXERCISES.length,
      seededAt: firebase.database.ServerValue.TIMESTAMP,
      seededBy: currentUser.uid
    });
    return true;
  }

  async function ensureUserProfile() {
    const profileRef = userRoot().child("profile");
    const snap = await profileRef.once("value");
    if (!snap.exists()) {
      await profileRef.set({
        role: "trainer",
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  function subscribeAll(onChange) {
    const refs = {
      clients: userRoot().child("clients"),
      favorites: userRoot().child("exerciseFavorites"),
      recent: userRoot().child("exerciseRecent"),
      exercises: db.ref("clob/exercise_master")
    };
    Object.entries(refs).forEach(([key, ref]) => {
      ref.on("value", snap => {
        state[key] = snap.val() || {};
        onChange(key, state[key]);
      });
    });
    return () => Object.values(refs).forEach(ref => ref.off());
  }

  async function saveClient(data) {
    const base = userRoot().child("clients");
    const id = data.id || base.push().key;
    const old = data.id ? (await base.child(id).once("value")).val() || {} : {};
    const now = firebase.database.ServerValue.TIMESTAMP;
    await base.child(id).set({
      ...old,
      name: data.name.trim(),
      phone: data.phone.trim(),
      goal: data.goal.trim(),
      packageStart: data.packageStart || "",
      packageMonths: Number(data.packageMonths) || 1,
      packageExpiry: calculateExpiry(data.packageStart, Number(data.packageMonths) || 1),
      createdAt: old.createdAt || now,
      updatedAt: now
    });
    return id;
  }

  async function deleteClient(id) {
    await userRoot().child(`clients/${id}`).remove();
  }

  function calculateExpiry(start, months) {
    if (!start) return "";
    const d = new Date(start + "T12:00:00");
    const originalDay = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(originalDay, lastDay));
    return d.toISOString().slice(0, 10);
  }

  async function toggleFavorite(exerciseId) {
    const ref = userRoot().child(`exerciseFavorites/${exerciseId}`);
    const snap = await ref.once("value");
    if (snap.exists()) await ref.remove();
    else await ref.set(true);
  }

  async function markRecent(exerciseId) {
    await userRoot().child(`exerciseRecent/${exerciseId}`).set(
      firebase.database.ServerValue.TIMESTAMP
    );
  }

  async function init() {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    if (!auth.currentUser) await auth.signInAnonymously();
    currentUser = auth.currentUser;
    await ensureUserProfile();
    const seeded = await seedExerciseLibrary();
    return { uid: currentUser.uid, seeded };
  }

  window.ClobDB = {
    init, subscribeAll, saveClient, deleteClient,
    toggleFavorite, markRecent, calculateExpiry,
    getState: () => state,
    getUid: () => currentUser?.uid || null
  };
})();
