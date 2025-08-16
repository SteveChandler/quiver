-- Fast geo filter index on beaches latitude/longitude
-- Note: columns are named latitude, longitude (not lat, lon)

CREATE INDEX IF NOT EXISTS idx_beaches_lat_lon
  ON public.beaches (latitude, longitude);


