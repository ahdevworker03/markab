// Fixed "today" anchor for the mock-data MVP so seed data stays consistent.
export const MOCK_TODAY = new Date("2025-01-15T12:00:00Z");
export const MOCK_TODAY_STR = "2025-01-15";

export function toISO(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toISOString();
}

export function daysFromToday(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - MOCK_TODAY.getTime();
  return Math.ceil(diff / 86_400_000);
}
