/** Equality for displayed date/time masks, not guesses about missing values. */
export function sameInputValue(
  current: string,
  wanted: string,
  label = "",
  type = "",
): boolean {
  if (current.trim() === wanted.trim()) return true;
  const clock = (s: string) => {
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const minute = Number(m[2]);
    if (minute > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) return null;
    if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
    return h * 60 + minute;
  };
  if (type === "time" || /time/i.test(label)) {
    const a = clock(current),
      b = clock(wanted);
    if (a !== null && b !== null) return a === b;
  }
  const date = (s: string) => {
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return us
      ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
      : null;
  };
  const a = date(current),
    b = date(wanted);
  if (a !== null && b !== null) return a === b;
  if (type === "tel" || /phone/i.test(label)) {
    const a = current.replace(/\D/g, ""),
      b = wanted.replace(/\D/g, "");
    if (a.length >= 7 && b.length >= 7) return a === b;
  }
  return false;
}
