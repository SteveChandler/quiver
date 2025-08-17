-- Add favorite_beaches table if missing, add rank, backfill, and indexes
DO $$
BEGIN
  IF to_regclass('public.favorite_beaches') IS NULL THEN
    -- Create table
    CREATE TABLE public.favorite_beaches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
      rank int,
      created_at timestamptz DEFAULT now()
    );

    -- RLS & policies
    ALTER TABLE public.favorite_beaches ENABLE ROW LEVEL SECURITY;
    CREATE POLICY favorite_beaches_select_own ON public.favorite_beaches
      FOR SELECT USING (user_id = (select auth.uid()));
    CREATE POLICY favorite_beaches_insert_own ON public.favorite_beaches
      FOR INSERT WITH CHECK (user_id = (select auth.uid()));
    CREATE POLICY favorite_beaches_update_own ON public.favorite_beaches
      FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
    CREATE POLICY favorite_beaches_delete_own ON public.favorite_beaches
      FOR DELETE USING (user_id = (select auth.uid()));

    -- Indexes
    CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique
      ON public.favorite_beaches (user_id, beach_id);
    CREATE INDEX IF NOT EXISTS idx_favorite_beaches_user_rank
      ON public.favorite_beaches (user_id, rank);
  ELSE
    -- Add rank column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'favorite_beaches' AND column_name = 'rank'
    ) THEN
      ALTER TABLE public.favorite_beaches ADD COLUMN rank int;
    END IF;

    -- Backfill rank per user if null
    WITH ranked AS (
      SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
      FROM public.favorite_beaches
    )
    UPDATE public.favorite_beaches fb
    SET rank = r.rn
    FROM ranked r
    WHERE r.id = fb.id AND fb.rank IS NULL;

    -- Ensure indexes exist
    CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique
      ON public.favorite_beaches (user_id, beach_id);
    CREATE INDEX IF NOT EXISTS idx_favorite_beaches_user_rank
      ON public.favorite_beaches (user_id, rank);
  END IF;
END $$;


