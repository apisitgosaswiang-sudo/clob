import {
  getMemberDataBundle,
  createMemberBackup,
  appendAuditLog
} from "./firebase.js";

export const DATA_SCHEMA_VERSION = "1.0";
export const RELEASE_CHANNEL = "beta-trial";

export async function backupMemberData(memberCode, reason = "manual") {
  const bundle = await getMemberDataBundle(memberCode);
  if (!bundle) {
    throw new Error("Firebase is not connected or the member data could not be read.");
  }

  const localBackup = {
    schemaVersion: DATA_SCHEMA_VERSION,
    releaseChannel: RELEASE_CHANNEL,
    memberCode,
    createdAt: Date.now(),
    reason,
    data: bundle
  };

  localStorage.setItem(
    `clob_backup_${memberCode}_${localBackup.createdAt}`,
    JSON.stringify(localBackup)
  );

  const backupId = await createMemberBackup(memberCode, bundle, {
    reason,
    releaseChannel: RELEASE_CHANNEL
  });

  await appendAuditLog({
    action: "member_backup_created",
    memberCode,
    targetId: backupId || "local-only",
    reason
  });

  return { backupId, localBackup };
}

export async function exportMemberData(memberCode) {
  const bundle = await getMemberDataBundle(memberCode);
  if (!bundle) {
    throw new Error("Firebase is not connected or the member data could not be read.");
  }

  const exportData = {
    product: "Morning Warrior",
    brand: "CLOB",
    schemaVersion: DATA_SCHEMA_VERSION,
    releaseChannel: RELEASE_CHANNEL,
    memberCode,
    exportedAt: new Date().toISOString(),
    data: bundle
  };

  downloadJson(
    `Morning-Warrior-member-${memberCode}-${new Date().toISOString().slice(0, 10)}.json`,
    exportData
  );

  await appendAuditLog({
    action: "member_data_exported",
    memberCode
  });

  return exportData;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
