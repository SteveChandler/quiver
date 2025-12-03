-- Migration: Normalize state values to 2-letter codes
-- This ensures consistency with URL routing which expects 2-letter state codes
-- The beach-url-utils.ts STATE_SLUG_MAP handles both formats, but database should be consistent

BEGIN;

-- Update Hawaii to HI
UPDATE beaches SET state = 'HI' WHERE state = 'Hawaii';

-- Update Oregon to OR  
UPDATE beaches SET state = 'OR' WHERE state = 'Oregon';

-- Update Washington to WA
UPDATE beaches SET state = 'WA' WHERE state = 'Washington';

-- Update Florida to FL
UPDATE beaches SET state = 'FL' WHERE state = 'Florida';

-- Update North Carolina to NC
UPDATE beaches SET state = 'NC' WHERE state = 'North Carolina';

-- Update South Carolina to SC
UPDATE beaches SET state = 'SC' WHERE state = 'South Carolina';

-- Update Texas to TX
UPDATE beaches SET state = 'TX' WHERE state = 'Texas';

-- Update New Jersey to NJ
UPDATE beaches SET state = 'NJ' WHERE state = 'New Jersey';

-- Update New York to NY
UPDATE beaches SET state = 'NY' WHERE state = 'New York';

-- Update Massachusetts to MA
UPDATE beaches SET state = 'MA' WHERE state = 'Massachusetts';

-- Update Rhode Island to RI
UPDATE beaches SET state = 'RI' WHERE state = 'Rhode Island';

-- Keep California as CA (most beaches already use this)
UPDATE beaches SET state = 'CA' WHERE state = 'California';

COMMIT;

-- Log the distinct state values after migration
-- SELECT DISTINCT state FROM beaches ORDER BY state;

