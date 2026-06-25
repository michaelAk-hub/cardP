// Parse a short duration string ("15m", "30d", "12h", "45s", "3600") into
// milliseconds. Used to compute refresh-token expiry from env config.
export function durationToMs(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${input}"`);
  }
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const factor: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * factor[unit];
}
