INSERT INTO "Organization" ("id", "name", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000001', 'Backup Fleet A', '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000002', 'Backup Fleet B', '2026-10-09T08:00:00.000Z');

INSERT INTO "User" ("id", "email", "password_hash", "role", "organization_id", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000101', 'owner-a@backup.example', 'hash-a', 'OWNER', '00000000-0000-0000-0000-000000000001', '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000102', 'owner-b@backup.example', 'hash-b', 'OWNER', '00000000-0000-0000-0000-000000000002', '2026-10-09T08:00:00.000Z');

INSERT INTO "Customer" ("id", "organization_id", "first_name", "last_name", "phone", "address", "national_id", "license_number", "license_expiry_date", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Amina', 'Fleet', '11111111', 'Beirut', 'A-001', 'LA-001', '2027-01-01T00:00:00.000Z', '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'Bilal', 'Fleet', '22222222', 'Tripoli', 'B-001', 'LB-001', '2027-01-01T00:00:00.000Z', '2026-10-09T08:00:00.000Z');

INSERT INTO "Vehicle" ("id", "organization_id", "make", "model", "plate_number", "year", "color", "transmission", "fuel_type", "seats", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Toyota', 'Yaris', 'A-123', 2024, 'White', 'AUTOMATIC', 'PETROL', 5, '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000002', 'Kia', 'Rio', 'B-123', 2024, 'Black', 'AUTOMATIC', 'PETROL', 5, '2026-10-09T08:00:00.000Z');

INSERT INTO "Rental" ("id", "organization_id", "customer_id", "vehicle_id", "pickup_date", "expected_return_date", "status", "daily_rate", "total_amount", "deposit_amount", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '2026-10-10T09:00:00.000Z', '2026-10-12T09:00:00.000Z', 'RESERVED', 50.00, 100.00, 100.00, '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000302', '2026-10-10T09:00:00.000Z', '2026-10-12T09:00:00.000Z', 'RESERVED', 60.00, 120.00, 120.00, '2026-10-09T08:00:00.000Z');

INSERT INTO "Task" ("id", "organization_id", "title", "due_date", "status", "recurrence_interval", "recurrence_unit", "occurrence_number", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'Inspect vehicle A', '2026-10-10T09:00:00.000Z', 'PENDING', 1, 'DAY', 1, '2026-10-09T08:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000002', 'Inspect vehicle B', '2026-10-10T09:00:00.000Z', 'PENDING', NULL, NULL, 1, '2026-10-09T08:00:00.000Z');
