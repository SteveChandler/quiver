-- Rollback for cardinal_to_deg(text) function

DROP FUNCTION IF EXISTS public.cardinal_to_deg(text);

DO $$
BEGIN
  RAISE NOTICE 'Dropped function public.cardinal_to_deg(text) if it existed';
END $$;


