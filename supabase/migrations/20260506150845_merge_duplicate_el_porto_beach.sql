BEGIN;

DO $$
DECLARE
  duplicate_beach_id uuid := '0bad04fb-2c2e-4d6f-b47d-ac77f7ce5836';
  canonical_beach_id uuid := '52879e4f-fc7f-4c02-a5e3-ea40b992ea80';
  ref_column record;
  unique_constraint record;
  unique_match_predicate text;
  deleted_count integer;
  updated_count integer;
  remaining_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.beaches
    WHERE id = canonical_beach_id
  ) THEN
    RAISE EXCEPTION 'Canonical El Porto beach % is missing', canonical_beach_id;
  END IF;

  UPDATE public.beach_sources canonical
  SET
    ndbc_buoy_ids = COALESCE((
      SELECT array_agg(DISTINCT source_id ORDER BY source_id)
      FROM unnest(canonical.ndbc_buoy_ids || duplicate.ndbc_buoy_ids) AS source_id
    ), '{}'),
    forecast_source_id = COALESCE(canonical.forecast_source_id, duplicate.forecast_source_id),
    camera_url = COALESCE(NULLIF(canonical.camera_url, ''), NULLIF(duplicate.camera_url, ''), canonical.camera_url)
  FROM public.beach_sources duplicate
  WHERE canonical.beach_id = canonical_beach_id
    AND duplicate.beach_id = duplicate_beach_id;

  FOR ref_column IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN (
        'beach_id',
        'home_beach_id',
        'spot_id',
        'nearest_beach_id',
        'best_beach_id',
        'favorite_spot_id'
      )
    ORDER BY c.table_name, c.column_name
  LOOP
    FOR unique_constraint IN
      SELECT
        index_class.relname AS constraint_name,
        string_agg(
          format('c.%1$I IS NOT DISTINCT FROM d.%1$I', indexed_attribute.attname),
          ' AND '
          ORDER BY array_position(index_record.indkey::smallint[], indexed_attribute.attnum::smallint)
        ) FILTER (WHERE indexed_attribute.attname <> ref_column.column_name) AS match_predicate
      FROM pg_index index_record
      JOIN pg_class table_class
        ON table_class.oid = index_record.indrelid
      JOIN pg_namespace table_namespace
        ON table_namespace.oid = table_class.relnamespace
      JOIN pg_class index_class
        ON index_class.oid = index_record.indexrelid
      JOIN pg_attribute target_attribute
        ON target_attribute.attrelid = table_class.oid
       AND target_attribute.attname = ref_column.column_name
       AND target_attribute.attnum = ANY(index_record.indkey)
      LEFT JOIN pg_attribute indexed_attribute
        ON indexed_attribute.attrelid = table_class.oid
       AND indexed_attribute.attnum = ANY(index_record.indkey)
       AND indexed_attribute.attnum > 0
      WHERE table_namespace.nspname = ref_column.table_schema
        AND table_class.relname = ref_column.table_name
        AND index_record.indisunique
        AND index_record.indpred IS NULL
        AND index_record.indexprs IS NULL
      GROUP BY index_class.relname
    LOOP
      unique_match_predicate := unique_constraint.match_predicate;

      EXECUTE format(
        'DELETE FROM %I.%I d
         WHERE d.%I = $1
           AND EXISTS (
             SELECT 1
             FROM %I.%I c
             WHERE c.%I = $2
               AND %s
           )',
        ref_column.table_schema,
        ref_column.table_name,
        ref_column.column_name,
        ref_column.table_schema,
        ref_column.table_name,
        ref_column.column_name,
        COALESCE(unique_match_predicate, 'TRUE')
      )
      USING duplicate_beach_id, canonical_beach_id;

      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      IF deleted_count > 0 THEN
        RAISE NOTICE 'Deleted % duplicate rows from %.% before merge',
          deleted_count,
          ref_column.table_name,
          ref_column.column_name;
      END IF;
    END LOOP;

    EXECUTE format(
      'UPDATE %I.%I
       SET %I = $1
       WHERE %I = $2',
      ref_column.table_schema,
      ref_column.table_name,
      ref_column.column_name,
      ref_column.column_name
    )
    USING canonical_beach_id, duplicate_beach_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      RAISE NOTICE 'Updated % rows in %.%',
        updated_count,
        ref_column.table_name,
        ref_column.column_name;
    END IF;
  END LOOP;

  DELETE FROM public.beaches
  WHERE id = duplicate_beach_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate El Porto beach row', deleted_count;

  FOR ref_column IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN (
        'beach_id',
        'home_beach_id',
        'spot_id',
        'nearest_beach_id',
        'best_beach_id',
        'favorite_spot_id'
      )
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'SELECT count(*)
       FROM %I.%I
       WHERE %I = $1',
      ref_column.table_schema,
      ref_column.table_name,
      ref_column.column_name
    )
    INTO remaining_count
    USING duplicate_beach_id;

    IF remaining_count > 0 THEN
      RAISE EXCEPTION 'Duplicate El Porto id remains in %.% (% rows)',
        ref_column.table_name,
        ref_column.column_name,
        remaining_count;
    END IF;
  END LOOP;
END $$;

COMMIT;
