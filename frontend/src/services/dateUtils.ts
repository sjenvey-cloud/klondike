/**
 * Returns today's date as a YYYY-MM-DD string in the browser's local timezone.
 * Avoids the UTC-offset bug in new Date().toISOString().slice(0,10) which can
 * return yesterday's date for users east of UTC late in the evening.
 */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
