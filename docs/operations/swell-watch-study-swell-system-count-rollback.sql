-- Run only after epoch 5 is revoked. The epoch-4 function body and hash guard
-- are canonical in the existing rollback script; the widened rule constraint stays
-- so revoked epoch-5/6 rows remain valid.
\ir swell-watch-study-model-partition-count-rollback.sql
