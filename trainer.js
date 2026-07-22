export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function cleanCoachName(name, fallback = "Coach") {
  if (!name || typeof name !== "string") return fallback;

  const cleaned = name
    .trim()
    .replace(/^coach\s+/i, "")
    .replace(/\s+/g, " ");

  return cleaned || fallback;
}

export function getAvatarInitial(name, fallback = "?") {
  const cleaned = cleanCoachName(name, "");
  if (!cleaned) return fallback;

  const firstCharacter = Array.from(cleaned)[0];
  return firstCharacter ? firstCharacter.toLocaleUpperCase() : fallback;
}

export function renderAvatar({
  name,
  photoUrl = "",
  className = "avatar",
  alt = ""
} = {}) {
  const safeName = escapeHtml(cleanCoachName(name, "User"));
  const safeClass = escapeHtml(className);
  const safeAlt = escapeHtml(alt || safeName);

  if (photoUrl) {
    return `
      <span class="${safeClass}">
        <img src="${escapeHtml(photoUrl)}" alt="${safeAlt}">
      </span>
    `;
  }

  return `
    <span class="${safeClass}" aria-label="${safeAlt}">
      ${escapeHtml(getAvatarInitial(name))}
    </span>
  `;
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
