import type { MaintenanceRecord } from "@/data/types";

export function getOverdueMaintenance(records: MaintenanceRecord[]): MaintenanceRecord[] {
  return records.filter((m) => m.status === "overdue");
}

export function getUpcomingMaintenance(
  records: MaintenanceRecord[],
  daysFromToday: (dateStr: string) => number,
  withinDays: number
): MaintenanceRecord[] {
  return records
    .filter((m) => m.status === "upcoming")
    .filter((m) => daysFromToday(m.dueDate) <= withinDays)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export function getOverdueCount(records: MaintenanceRecord[]): number {
  return getOverdueMaintenance(records).length;
}
