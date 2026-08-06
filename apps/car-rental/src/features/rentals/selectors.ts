import type { Rental } from "@/data/types";

export function getTotalPaid(rental: Rental): number {
  return rental.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function getRemaining(rental: Rental): number {
  return Math.max(0, rental.totalAmount - getTotalPaid(rental));
}

export function getActiveRentals(rentals: Rental[]): Rental[] {
  return rentals.filter((r) => r.status === "active");
}

export function getEndedRentals(rentals: Rental[]): Rental[] {
  return rentals.filter((r) => r.status === "ended");
}

export function getMonthlyRevenue(rentals: Rental[], month: number, year: number): number {
  return rentals.reduce(
    (sum, r) =>
      sum +
      r.payments.reduce((s, p) => {
        const d = new Date(p.date);
        return d.getMonth() === month && d.getFullYear() === year ? s + p.amount : s;
      }, 0),
    0
  );
}

export function getPendingBalance(rentals: Rental[]): number {
  return getActiveRentals(rentals).reduce((sum, r) => sum + getRemaining(r), 0);
}

export function getVehicleRevenueForMonth(
  rentals: Rental[],
  month: number,
  year: number
): Record<string, number> {
  const byVehicle: Record<string, number> = {};
  rentals.forEach((r) => {
    r.payments.forEach((p) => {
      const d = new Date(p.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const share = p.amount / r.vehicleIds.length;
        r.vehicleIds.forEach((vid) => {
          byVehicle[vid] = (byVehicle[vid] ?? 0) + share;
        });
      }
    });
  });
  return byVehicle;
}

export function getCustomerBalances(rentals: Rental[]): Record<string, number> {
  const balances: Record<string, number> = {};
  getActiveRentals(rentals).forEach((r) => {
    const remaining = getRemaining(r);
    if (remaining > 0) {
      balances[r.customerId] = (balances[r.customerId] ?? 0) + remaining;
    }
  });
  return balances;
}

export function getRentalsEndingSoon(rentals: Rental[], daysFromToday: (dateStr: string) => number): Rental[] {
  return rentals
    .filter((r) => r.status === "active")
    .filter((r) => {
      const days = daysFromToday(r.endDate);
      return days >= 0 && days <= 2;
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
}

export function getRecentEndedRentals(rentals: Rental[], limit: number): Rental[] {
  return rentals
    .filter((r) => r.status === "ended" && r.returnDate)
    .sort(
      (a, b) => new Date(b.returnDate!).getTime() - new Date(a.returnDate!).getTime()
    )
    .slice(0, limit);
}
