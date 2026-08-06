import { MaintenanceRecord } from "./types";

export const maintenance: MaintenanceRecord[] = [
  {
    id: "m1",
    vehicleId: "v4",
    type: "repair",
    dueDate: "2025-01-14T12:00:00Z", // overdue
    status: "overdue",
    notes: "تبديل بواجي"
  },
  {
    id: "m2",
    vehicleId: "v1",
    type: "oil",
    dueDate: "2025-01-12T12:00:00Z", // overdue
    status: "overdue"
  },
  {
    id: "m3",
    vehicleId: "v3",
    type: "inspection",
    dueDate: "2025-01-20T12:00:00Z", // upcoming
    status: "upcoming"
  },
  {
    id: "m4",
    vehicleId: "v5",
    type: "insurance",
    dueDate: "2025-01-22T12:00:00Z", // upcoming
    status: "upcoming"
  },
  {
    id: "m5",
    vehicleId: "v2",
    type: "oil",
    dueDate: "2024-12-15T12:00:00Z",
    completedDate: "2024-12-14T12:00:00Z",
    cost: 50,
    status: "completed"
  },
  {
    id: "m6",
    vehicleId: "v6",
    type: "registration",
    dueDate: "2024-11-10T12:00:00Z",
    completedDate: "2024-11-09T12:00:00Z",
    cost: 150,
    status: "completed"
  },
  {
    id: "m7",
    vehicleId: "v7",
    type: "inspection",
    dueDate: "2025-01-05T12:00:00Z",
    completedDate: "2025-01-04T12:00:00Z",
    cost: 40,
    status: "completed"
  }
];
