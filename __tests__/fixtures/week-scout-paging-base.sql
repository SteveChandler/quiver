CREATE SCHEMA extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions;
SET search_path = public, extensions;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.beaches (
  id uuid PRIMARY KEY,
  geog geography(Point, 4326),
  is_private boolean DEFAULT false,
  deleted_at timestamptz,
  recommendation_eligible boolean DEFAULT true
);
CREATE TABLE public.user_beach_exclusions (user_id uuid, beach_id uuid);

-- 500 tied locations exercise the stable ID order; the 501st is farther away.
INSERT INTO public.beaches (id, geog)
SELECT ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  CASE WHEN i=501 THEN ST_Project(ST_Point(-117.1,32.75)::geography,999,0)
       ELSE ST_Point(-117.1,32.75)::geography END
FROM generate_series(1,501) i ORDER BY i DESC;
INSERT INTO public.beaches (id, geog, is_private, deleted_at, recommendation_eligible) VALUES
('00000000-0000-4000-8000-000000000502', ST_Point(-117.1,32.75)::geography, true, NULL, true),
('00000000-0000-4000-8000-000000000503', ST_Point(-117.1,32.75)::geography, false, now(), true),
('00000000-0000-4000-8000-000000000504', ST_Point(-117.1,32.75)::geography, false, NULL, false),
('00000000-0000-4000-8000-000000000505', NULL, false, NULL, true),
('00000000-0000-4000-8000-000000000506', ST_Point(-117.1,32.75)::geography, false, NULL, true),
('00000000-0000-4000-8000-000000000507', ST_Project(ST_Point(-117.1,32.75)::geography,1001,0), false, NULL, true);
INSERT INTO public.user_beach_exclusions VALUES
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000506'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000501');
