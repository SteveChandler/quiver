-- Fill missing beach descriptions using existing metadata columns.
-- Targets beaches (primarily early OC/SD/Baja seeds) that have NULL or empty descriptions.
-- Builds natural-sounding prose from: name, break_type, city, state, skill_level,
-- best_conditions_prose, features, and hazards.
--
-- Safe: only updates rows WHERE description IS NULL OR description = ''.
-- Idempotent: re-running on a populated description column changes nothing.

BEGIN;

UPDATE public.beaches
SET description = CONCAT_WS(
  ' ',

  -- Sentence 1: "[Name] is a [break_type] break in [city], [state]."
  name || ' is '
    || CASE
         WHEN break_type IS NOT NULL THEN
           CASE lower(break_type)
             WHEN 'beach'       THEN 'a beach break'
             WHEN 'reef'        THEN 'a reef break'
             WHEN 'point'       THEN 'a point break'
             WHEN 'jetty'       THEN 'a jetty break'
             WHEN 'rivermouth'  THEN 'a rivermouth break'
             WHEN 'sandbar'     THEN 'a sandbar break'
             WHEN 'pier'        THEN 'a pier break'
             ELSE 'a ' || break_type || ' break'
           END
         ELSE 'a surf spot'
       END
    || CASE
         WHEN city IS NOT NULL AND state IS NOT NULL THEN ' in ' || city || ', ' || state || '.'
         WHEN city IS NOT NULL THEN ' in ' || city || '.'
         WHEN state IS NOT NULL THEN ' in ' || state || '.'
         ELSE '.'
       END,

  -- Sentence 2: Skill level
  CASE
    WHEN skill_level IS NOT NULL THEN
      CASE lower(skill_level)
        WHEN 'beginner'            THEN 'It is well suited for beginners and those learning to surf.'
        WHEN 'beginner-friendly'   THEN 'It is beginner-friendly and great for surfers of all levels.'
        WHEN 'intermediate'        THEN 'It is best suited for intermediate surfers.'
        WHEN 'upper-intermediate'  THEN 'It is best suited for upper-intermediate to advanced surfers.'
        WHEN 'advanced'            THEN 'It is recommended for advanced surfers due to powerful waves and challenging conditions.'
        WHEN 'expert'              THEN 'It is reserved for expert surfers only, with heavy, fast-breaking waves.'
        WHEN 'all levels'          THEN 'It accommodates surfers of all skill levels.'
        ELSE 'It is suited for ' || skill_level || ' surfers.'
      END
    ELSE NULL
  END,

  -- Sentence 3: Best conditions prose (use directly if present)
  CASE
    WHEN best_conditions_prose IS NOT NULL AND best_conditions_prose <> ''
      THEN 'Best conditions: ' || best_conditions_prose || CASE WHEN right(best_conditions_prose, 1) = '.' THEN '' ELSE '.' END
    ELSE NULL
  END,

  -- Sentence 4: Features
  CASE
    WHEN features IS NOT NULL AND array_length(features, 1) > 0 THEN
      'Features include ' || array_to_string(features, ', ') || '.'
    ELSE NULL
  END,

  -- Sentence 5: Hazards
  CASE
    WHEN hazards IS NOT NULL AND array_length(hazards, 1) > 0 THEN
      'Watch out for ' || array_to_string(hazards, ', ') || '.'
    ELSE NULL
  END
)
WHERE description IS NULL OR description = '';

COMMIT;
