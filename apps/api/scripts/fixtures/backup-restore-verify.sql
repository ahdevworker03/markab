DO $$
BEGIN
  IF (SELECT count(*) FROM "Organization") <> 2 THEN
    RAISE EXCEPTION 'Expected two organizations after restore';
  END IF;

  IF (SELECT count(*) FROM "User") <> 2
    OR (SELECT count(*) FROM "Customer") <> 2
    OR (SELECT count(*) FROM "Vehicle") <> 2
    OR (SELECT count(*) FROM "Rental") <> 2
    OR (SELECT count(*) FROM "Task") <> 2 THEN
    RAISE EXCEPTION 'Expected representative records after restore';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Rental" rental
    JOIN "Customer" customer ON customer."id" = rental."customer_id"
    JOIN "Vehicle" vehicle ON vehicle."id" = rental."vehicle_id"
    WHERE rental."organization_id" <> customer."organization_id"
       OR rental."organization_id" <> vehicle."organization_id"
  ) THEN
    RAISE EXCEPTION 'Rental tenant ownership changed during restore';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task"
    WHERE ("id" = '00000000-0000-0000-0000-000000000501' AND "organization_id" <> '00000000-0000-0000-0000-000000000001')
       OR ("id" = '00000000-0000-0000-0000-000000000502' AND "organization_id" <> '00000000-0000-0000-0000-000000000002')
  ) THEN
    RAISE EXCEPTION 'Task tenant ownership changed during restore';
  END IF;
END $$;
