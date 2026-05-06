BEGIN;

INSERT INTO beach_sources (beach_id, camera_url)
SELECT b.id, 'https://hdontap.com/stream/158254/el-porto-beach-roving-live-cam/'
FROM beaches b
WHERE b.name = 'El Porto (Manhattan)'
  AND b.state = 'CA'
ON CONFLICT (beach_id) DO UPDATE
SET camera_url = EXCLUDED.camera_url;

COMMIT;
