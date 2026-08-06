import { Rental } from "./types";

export const rentals: Rental[] = [
  {
    id: "r1",
    vehicleIds: ["v2"],
    customerId: "c1",
    startDate: "2025-01-10T12:00:00Z",
    endDate: "2025-01-15T12:00:00Z",
    dailyPrices: { "v2": 30 },
    payments: [{ id: "p1", amount: 150, date: "2025-01-10T12:00:00Z" }],
    totalAmount: 150,
    status: "active"
  },
  {
    id: "r2",
    vehicleIds: ["v6"],
    customerId: "c3",
    startDate: "2025-01-14T12:00:00Z",
    endDate: "2025-01-16T12:00:00Z",
    dailyPrices: { "v6": 30 },
    payments: [{ id: "p2", amount: 30, date: "2025-01-14T12:00:00Z" }],
    totalAmount: 60,
    status: "active"
  },
  {
    id: "r3",
    vehicleIds: ["v3"], // Let's pretend it was just returned but status is still active or something, or it's another vehicle
    customerId: "c5",
    startDate: "2025-01-15T12:00:00Z",
    endDate: "2025-01-20T12:00:00Z",
    dailyPrices: { "v3": 45 },
    payments: [],
    totalAmount: 225,
    status: "active"
  },
  {
    id: "r4",
    vehicleIds: ["v1"],
    customerId: "c2",
    startDate: "2024-12-20T12:00:00Z",
    endDate: "2024-12-25T12:00:00Z",
    dailyPrices: { "v1": 40 },
    payments: [{ id: "p3", amount: 200, date: "2024-12-20T12:00:00Z" }],
    totalAmount: 200,
    status: "ended",
    returnDate: "2024-12-25T12:00:00Z"
  },
  {
    id: "r5",
    vehicleIds: ["v5"],
    customerId: "c4",
    startDate: "2024-12-28T12:00:00Z",
    endDate: "2025-01-02T12:00:00Z",
    dailyPrices: { "v5": 130 },
    payments: [{ id: "p4", amount: 650, date: "2024-12-28T12:00:00Z" }],
    totalAmount: 650,
    status: "ended",
    returnDate: "2025-01-02T12:00:00Z"
  },
  {
    id: "r6",
    vehicleIds: ["v7"],
    customerId: "c6",
    startDate: "2025-01-01T12:00:00Z",
    endDate: "2025-01-05T12:00:00Z",
    dailyPrices: { "v7": 35 },
    payments: [{ id: "p5", amount: 140, date: "2025-01-01T12:00:00Z" }],
    totalAmount: 140,
    status: "ended",
    returnDate: "2025-01-05T12:00:00Z"
  },
  {
    id: "r7",
    vehicleIds: ["v4"],
    customerId: "c1",
    startDate: "2025-01-05T12:00:00Z",
    endDate: "2025-01-08T12:00:00Z",
    dailyPrices: { "v4": 90 },
    payments: [{ id: "p6", amount: 270, date: "2025-01-05T12:00:00Z" }],
    totalAmount: 270,
    status: "ended",
    returnDate: "2025-01-08T12:00:00Z"
  }
];
