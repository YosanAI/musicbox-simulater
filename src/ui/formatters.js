/** Time labels intentionally use the original whole-second presentation. */
export function formatTime(seconds) {
  const nonnegative = Math.max(0, seconds);
  const minutes = Math.floor(nonnegative / 60);
  return `${minutes}:${String(Math.floor(nonnegative % 60)).padStart(2, '0')}`;
}
