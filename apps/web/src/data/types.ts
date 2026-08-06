export type VehicleStatus = "available" | "rented" | "maintenance";

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  status: VehicleStatus;
  dailyPrice: number;
  mileage: number;
  notes?: string;
  photos: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes?: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Rental {
  id: string;
  vehicleIds: string[];
  customerId: string;
  startDate: string;
  endDate: string;
  dailyPrices: Record<string, number>;
  payments: Payment[];
  totalAmount: number;
  notes?: string;
  status: "active" | "ended";
  returnDate?: string;
}

export type MaintenanceType = "oil" | "inspection" | "insurance" | "registration" | "repair";

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  dueDate: string;
  completedDate?: string;
  cost?: number;
  notes?: string;
  status: "upcoming" | "completed" | "overdue";
}
