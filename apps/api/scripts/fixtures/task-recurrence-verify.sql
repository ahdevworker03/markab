DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Task" WHERE "id" = '00000000-0000-0000-0000-000000000101') THEN
    RAISE EXCEPTION 'Expected daily root task is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task"
    WHERE "id" = '00000000-0000-0000-0000-000000000101'
      AND (
        "organization_id" <> '00000000-0000-0000-0000-000000000001'
        OR "recurrence_interval" <> 1
        OR "recurrence_unit" <> 'DAY'::"TaskRecurrenceUnit"
        OR "occurrence_number" <> 1
        OR "title" <> 'Daily vehicle inspection'
      )
  ) THEN
    RAISE EXCEPTION 'Daily root task was not transformed as expected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Task" WHERE "id" = '00000000-0000-0000-0000-000000000102') THEN
    RAISE EXCEPTION 'Expected child task is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task"
    WHERE "id" = '00000000-0000-0000-0000-000000000102'
      AND (
        "organization_id" <> '00000000-0000-0000-0000-000000000001'
        OR "predecessor_id" <> '00000000-0000-0000-0000-000000000101'
        OR "recurrence_interval" IS NOT NULL
        OR "recurrence_unit" IS NOT NULL
        OR "occurrence_number" <> 2
        OR "title" <> 'مهمة بدون عنوان'
      )
  ) THEN
    RAISE EXCEPTION 'Non-recurring child task was not transformed as expected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Task" WHERE "id" = '00000000-0000-0000-0000-000000000103') THEN
    RAISE EXCEPTION 'Expected monthly task is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task"
    WHERE "id" = '00000000-0000-0000-0000-000000000103'
      AND (
        "organization_id" <> '00000000-0000-0000-0000-000000000002'
        OR "recurrence_interval" <> 1
        OR "recurrence_unit" <> 'MONTH'::"TaskRecurrenceUnit"
        OR "occurrence_number" <> 1
        OR "title" <> 'مهمة بدون عنوان'
      )
  ) THEN
    RAISE EXCEPTION 'Monthly task was not transformed as expected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Task'
      AND column_name = 'recurrence_type'
  ) THEN
    RAISE EXCEPTION 'Legacy recurrence_type column still exists';
  END IF;
END $$;
