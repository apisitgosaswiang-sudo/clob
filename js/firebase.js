import { firebaseConfig } from "./config.js";

let firebaseReady = false;
let authUser = null;
let database = null;
let dbApi = null;
let storage = null;
let storageApi = null;
let firebaseError = null;

export async function initializeFirebase() {
  try {
    const [
      { initializeApp },
      { getAuth, signInAnonymously },
      { getDatabase, ref, get, set, update, push, runTransaction },
      { getStorage, ref: storageRef, uploadBytesResumable, getDownloadURL, deleteObject }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js")
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const credential = await signInAnonymously(auth);

    authUser = credential.user;
    database = getDatabase(app);
    dbApi = { ref, get, set, update, push, runTransaction };
    storage = getStorage(app);
    storageApi = { storageRef, uploadBytesResumable, getDownloadURL, deleteObject };
    firebaseReady = true;
    firebaseError = null;

    window.dispatchEvent(new CustomEvent("clob:firebase-status", {
      detail: { ready: true, uid: authUser.uid }
    }));

    return { ready: true, user: authUser };
  } catch (error) {
    firebaseReady = false;
    firebaseError = error;
    console.warn("Firebase initialization failed:", error);

    window.dispatchEvent(new CustomEvent("clob:firebase-status", {
      detail: { ready: false, error }
    }));

    return { ready: false, error };
  }
}

export function getFirebaseStatus() {
  return { ready: firebaseReady, user: authUser, error: firebaseError };
}

export async function getMemberByCode(code) {
  if (!firebaseReady || !database || !dbApi) return null;

  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/members/${code}`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load member:", error);
    return null;
  }
}


export async function saveMemberRecord(code, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(dbApi.ref(database, `clob/members/${code}`), payload);
    return true;
  } catch (error) {
    console.warn("Could not save member:", error);
    return false;
  }
}

export async function memberCodeExists(code) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    const snapshot = await dbApi.get(dbApi.ref(database, `clob/members/${code}`));
    return snapshot.exists();
  } catch (error) {
    console.warn("Could not check member code:", error);
    return false;
  }
}


export async function saveMemberSecurity(memberCode, security) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(dbApi.ref(database, `clob/members/${memberCode}/security`), security);
    return true;
  } catch (error) {
    console.warn("Could not save member security:", error);
    return false;
  }
}

export async function registerMemberPinFailure(memberCode, options = {}) {
  if (!firebaseReady || !database || !dbApi) return null;
  const maxAttempts = Number(options.maxAttempts || 5);
  const lockMs = Number(options.lockMs || 900000);
  try {
    const result = await dbApi.runTransaction(
      dbApi.ref(database, `clob/members/${memberCode}/security`),
      (current) => {
        if (!current?.pinHash) return current;
        const now = Date.now();
        if (Number(current.lockedUntil || 0) > now) return current;
        const failedAttempts = Number(current.failedAttempts || 0) + 1;
        return {
          ...current,
          failedAttempts: failedAttempts >= maxAttempts ? 0 : failedAttempts,
          lockedUntil: failedAttempts >= maxAttempts ? now + lockMs : 0,
          lastFailedAt: now
        };
      }
    );
    return result.snapshot.val();
  } catch (error) {
    console.warn("Could not register PIN failure:", error);
    return null;
  }
}

export async function clearMemberPinFailures(memberCode) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(dbApi.ref(database, `clob/members/${memberCode}/security`), {
      failedAttempts: 0,
      lockedUntil: 0,
      lastSuccessfulLoginAt: Date.now()
    });
    return true;
  } catch (error) {
    console.warn("Could not clear PIN failures:", error);
    return false;
  }
}

export async function resetMemberPinSecurity(memberCode) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(dbApi.ref(database, `clob/members/${memberCode}/security`), null);
    return true;
  } catch (error) {
    console.warn("Could not reset member PIN:", error);
    return false;
  }
}


export async function getCoachRecord(coachId) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(dbApi.ref(database, `clob/coaches/${coachId}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load coach record:", error);
    return null;
  }
}

export async function saveCoachRecord(coachId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(dbApi.ref(database, `clob/coaches/${coachId}`), payload);
    return true;
  } catch (error) {
    console.warn("Could not save coach record:", error);
    return false;
  }
}

export async function getCoachSecurity(coachId) {
  const coach = await getCoachRecord(coachId);
  return coach?.security || null;
}

export async function registerCoachPinFailure(coachId, options = {}) {
  if (!firebaseReady || !database || !dbApi) return null;
  const maxAttempts = Number(options.maxAttempts || 5);
  const lockMs = Number(options.lockMs || 900000);
  try {
    const result = await dbApi.runTransaction(
      dbApi.ref(database, `clob/coaches/${coachId}/security`),
      (current) => {
        const now = Date.now();
        const base = current || {};
        if (Number(base.lockedUntil || 0) > now) return base;
        const failedAttempts = Number(base.failedAttempts || 0) + 1;
        return {
          ...base,
          failedAttempts: failedAttempts >= maxAttempts ? 0 : failedAttempts,
          lockedUntil: failedAttempts >= maxAttempts ? now + lockMs : 0,
          lastFailedAt: now
        };
      }
    );
    return result.snapshot.val();
  } catch (error) {
    console.warn("Could not register coach PIN failure:", error);
    return null;
  }
}

export async function clearCoachPinFailures(coachId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(dbApi.ref(database, `clob/coaches/${coachId}/security`), {
      failedAttempts: 0,
      lockedUntil: 0,
      lastSuccessfulLoginAt: Date.now()
    });
    return true;
  } catch (error) {
    console.warn("Could not clear coach PIN failures:", error);
    return false;
  }
}

export async function saveCoachProfilePhoto(coachId, payload) {
  return saveCoachRecord(coachId, {
    profilePhoto: payload.url,
    profilePhotoPath: payload.fullPath,
    profilePhotoUpdatedAt: Date.now()
  });
}

export async function saveMemberActivity(code, payload) {
  if (!firebaseReady || !database || !dbApi) return false;

  try {
    await dbApi.push(
      dbApi.ref(database, `clob/members/${code}/activity`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save activity:", error);
    return false;
  }
}

export async function saveWorkoutSession(code, sessionId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;

  try {
    await dbApi.set(
      dbApi.ref(database, `clob/workoutSessions/${code}/${sessionId}`),
      payload
    );

    await dbApi.update(
      dbApi.ref(database, `clob/members/${code}`),
      {
        lastWorkoutStatus: payload.status,
        lastWorkoutTitle: payload.title,
        lastWorkoutUpdatedAt: payload.updatedAt
      }
    );

    return true;
  } catch (error) {
    console.warn("Could not save workout session:", error);
    return false;
  }
}


export async function getAllMembers() {
  if (!firebaseReady || !database || !dbApi) return null;

  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, "clob/members")
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load members:", error);
    return null;
  }
}

export async function getWorkoutSessions() {
  if (!firebaseReady || !database || !dbApi) return null;

  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, "clob/workoutSessions")
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load workout sessions:", error);
    return null;
  }
}


export async function getPrograms() {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(dbApi.ref(database, "clob/programs"));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load programs:", error);
    return null;
  }
}

export async function saveProgram(programId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/programs/${programId}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save program:", error);
    return false;
  }
}

export async function deleteProgram(programId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/programs/${programId}`),
      null
    );
    return true;
  } catch (error) {
    console.warn("Could not delete program:", error);
    return false;
  }
}

export async function assignProgramToMember(memberCode, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/memberPrograms/${memberCode}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not assign program:", error);
    return false;
  }
}


export async function getExercises() {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(dbApi.ref(database, "clob/exercises"));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load exercises:", error);
    return null;
  }
}

export async function saveExercise(exerciseId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(dbApi.ref(database, `clob/exercises/${exerciseId}`), payload);
    return true;
  } catch (error) {
    console.warn("Could not save exercise:", error);
    return false;
  }
}

export async function deleteExercise(exerciseId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(dbApi.ref(database, `clob/exercises/${exerciseId}`), null);
    return true;
  } catch (error) {
    console.warn("Could not delete exercise:", error);
    return false;
  }
}

export async function getExercisePreferences() {
  if (!firebaseReady || !database || !dbApi || !authUser) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/exercisePreferences/${authUser.uid}`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load exercise preferences:", error);
    return null;
  }
}

export async function saveExercisePreferences(payload) {
  if (!firebaseReady || !database || !dbApi || !authUser) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/exercisePreferences/${authUser.uid}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save exercise preferences:", error);
    return false;
  }
}


export function uploadImage(path, blob, onProgress = () => {}) {
  if (!firebaseReady || !storage || !storageApi || !authUser) {
    return Promise.reject(new Error("Firebase Storage is not ready."));
  }

  const target = storageApi.storageRef(storage, path);
  const task = storageApi.uploadBytesResumable(target, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "public,max-age=31536000"
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        onProgress(progress);
      },
      reject,
      async () => {
        const url = await storageApi.getDownloadURL(task.snapshot.ref);
        resolve({
          url,
          fullPath: task.snapshot.ref.fullPath,
          size: task.snapshot.totalBytes,
          contentType: task.snapshot.metadata.contentType
        });
      }
    );
  });
}

export async function saveProgressPhotoSet(memberCode, checkinId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/progress/${memberCode}/checkins/${checkinId}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save progress photos:", error);
    return false;
  }
}

export async function getProgressPhotoSets(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/progress/${memberCode}/checkins`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load progress photos:", error);
    return null;
  }
}

export async function saveMemberProfilePhoto(memberCode, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(
      dbApi.ref(database, `clob/members/${memberCode}`),
      {
        profilePhoto: payload.url,
        profilePhotoPath: payload.fullPath,
        profilePhotoUpdatedAt: Date.now()
      }
    );
    return true;
  } catch (error) {
    console.warn("Could not save profile photo:", error);
    return false;
  }
}


export async function saveMemberCheckin(memberCode, checkinId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/progress/${memberCode}/checkins/${checkinId}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save check-in:", error);
    return false;
  }
}

export async function getMemberCheckins(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/progress/${memberCode}/checkins`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load check-ins:", error);
    return null;
  }
}

export async function deleteMemberCheckin(memberCode, checkinId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/progress/${memberCode}/checkins/${checkinId}`),
      null
    );
    return true;
  } catch (error) {
    console.warn("Could not delete check-in:", error);
    return false;
  }
}


export async function getMemberPRs(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/progress/${memberCode}/prs`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load PRs:", error);
    return null;
  }
}

export async function saveMemberPR(memberCode, prId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/progress/${memberCode}/prs/${prId}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save PR:", error);
    return false;
  }
}

export async function deleteMemberPR(memberCode, prId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/progress/${memberCode}/prs/${prId}`),
      null
    );
    return true;
  } catch (error) {
    console.warn("Could not delete PR:", error);
    return false;
  }
}


export async function getWeeklyCheckins(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/weeklyCheckins`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load weekly check-ins:", error);
    return null;
  }
}

export async function saveWeeklyCheckin(memberCode, checkinId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/weeklyCheckins/${checkinId}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save weekly check-in:", error);
    return false;
  }
}

export async function deleteWeeklyCheckin(memberCode, checkinId) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/weeklyCheckins/${checkinId}`),
      null
    );
    return true;
  } catch (error) {
    console.warn("Could not delete weekly check-in:", error);
    return false;
  }
}

export async function saveCoachReview(memberCode, checkinId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/reviews/${checkinId}`),
      payload
    );
    await dbApi.update(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/weeklyCheckins/${checkinId}`),
      {
        reviewStatus: payload.status || "reviewed",
        reviewedAt: payload.reviewedAt || Date.now()
      }
    );
    return true;
  } catch (error) {
    console.warn("Could not save coach review:", error);
    return false;
  }
}

export async function getCoachReviews(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/onlineCoaching/${memberCode}/reviews`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load coach reviews:", error);
    return null;
  }
}


// Pack10 data-safety APIs.
// These functions only add data under new paths. They never migrate, rename,
// or delete the legacy member/workout/progress/program data structures.

export async function getMemberExperienceDay(memberCode, dateKey) {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(
      dbApi.ref(database, `clob/v1/memberExperience/${memberCode}/daily/${dateKey}`)
    );
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load member experience day:", error);
    return null;
  }
}

export async function saveMemberExperienceDay(memberCode, dateKey, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.update(
      dbApi.ref(database, `clob/v1/memberExperience/${memberCode}/daily/${dateKey}`),
      payload
    );
    return true;
  } catch (error) {
    console.warn("Could not save member experience day:", error);
    return false;
  }
}

export async function getMemberDataBundle(memberCode) {
  if (!firebaseReady || !database || !dbApi) return null;

  const paths = {
    member: `clob/members/${memberCode}`,
    workoutSessions: `clob/workoutSessions/${memberCode}`,
    memberProgram: `clob/memberPrograms/${memberCode}`,
    progress: `clob/progress/${memberCode}`,
    onlineCoaching: `clob/onlineCoaching/${memberCode}`,
    memberExperience: `clob/v1/memberExperience/${memberCode}`
  };

  try {
    const entries = await Promise.all(
      Object.entries(paths).map(async ([key, path]) => {
        const snapshot = await dbApi.get(dbApi.ref(database, path));
        return [key, snapshot.exists() ? snapshot.val() : null];
      })
    );

    return Object.fromEntries(entries);
  } catch (error) {
    console.warn("Could not create member data bundle:", error);
    return null;
  }
}

export async function createMemberBackup(memberCode, bundle, metadata = {}) {
  if (!firebaseReady || !database || !dbApi || !bundle) return false;

  const backupId = `${Date.now()}`;
  try {
    await dbApi.set(
      dbApi.ref(database, `clob/systemBackups/members/${memberCode}/${backupId}`),
      {
        schemaVersion: "1.0",
        createdAt: Date.now(),
        createdByUid: authUser?.uid || null,
        metadata,
        data: bundle
      }
    );
    return backupId;
  } catch (error) {
    console.warn("Could not create member backup:", error);
    return false;
  }
}

export async function appendAuditLog(payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.push(
      dbApi.ref(database, "clob/system/auditLog"),
      {
        ...payload,
        uid: authUser?.uid || null,
        timestamp: Date.now(),
        appVersion: "Beta 1.0"
      }
    );
    return true;
  } catch (error) {
    console.warn("Could not append audit log:", error);
    return false;
  }
}


export async function getPackages() {
  if (!firebaseReady || !database || !dbApi) return null;
  try {
    const snapshot = await dbApi.get(dbApi.ref(database, "clob/packages"));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.warn("Could not load packages:", error);
    return null;
  }
}

export async function savePackageRecord(packageId, payload) {
  if (!firebaseReady || !database || !dbApi) return false;
  try {
    await dbApi.set(dbApi.ref(database, `clob/packages/${packageId}`), payload);
    return true;
  } catch (error) {
    console.warn("Could not save package:", error);
    return false;
  }
}
