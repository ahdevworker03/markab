/**
 * Shared formatting helpers.
 * Import these instead of redefining per-page.
 */

const LEBANESE_MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

/** Format a number as dollars: $1,500,000 */
export function formatCurrency(n: number): string {
  return "$" + new Intl.NumberFormat("en-US").format(n);
}

/** Full date with Western numerals and Lebanese month names: 15 كانون الثاني 2025 */
export function formatDateAr(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${LEBANESE_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short date without year: 15 كانون الثاني */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${LEBANESE_MONTHS[d.getMonth()]}`;
}

/** Two-letter initials from a name: "أحمد محمد" → "أم" */
export function formatInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
