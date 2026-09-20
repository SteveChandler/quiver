BEGIN;

-- Per-field order is necessary: cancellation may arrive before its initial purchase.
-- Separate from rc_raw because verified server gifts replace that display metadata.
ALTER TABLE public.user_entitlements ADD COLUMN rc_field_events jsonb NOT NULL DEFAULT '{}';

CREATE FUNCTION public.revenuecat_entitlement_fields(event jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN event->>'type' IN ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','NON_RENEWING_PURCHASE')
  THEN ARRAY['is_pro','is_trialing','trial_ends_at','expires_at','product_id','will_renew','billing_issue','lapsed_at']
 WHEN event->>'type'='EXPIRATION' OR (event->>'type'='CANCELLATION' AND event->>'product_id'='app.quiversurf.surf.pro.lifetime')
  THEN ARRAY['is_pro','is_trialing','will_renew','billing_issue','lapsed_at','previous_product_id']
 WHEN event->>'type'='CANCELLATION' THEN ARRAY['will_renew']
 WHEN event->>'type'='BILLING_ISSUE' THEN ARRAY['billing_issue']
 WHEN event->>'type'='PRODUCT_CHANGE' THEN ARRAY['product_id','expires_at']
 ELSE ARRAY[]::text[] END;
$$;

CREATE FUNCTION public.guard_revenuecat_entitlement_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE incoming_ms numeric; field text; prior jsonb; incoming jsonb; fields text[]; accepted boolean:=false;
BEGIN
 IF TG_OP='UPDATE' THEN
  NEW.rc_field_events:=OLD.rc_field_events;
  -- Lazily seed existing rows from their last genuine provider event.
  IF jsonb_typeof(OLD.rc_raw->'event_timestamp_ms')='number' THEN
   FOREACH field IN ARRAY public.revenuecat_entitlement_fields(OLD.rc_raw) LOOP
    IF NOT NEW.rc_field_events ? field THEN
     NEW.rc_field_events:=jsonb_set(NEW.rc_field_events,ARRAY[field],jsonb_build_array(OLD.rc_raw->'event_timestamp_ms',coalesce(OLD.rc_raw->>'id','')));
    END IF;
   END LOOP;
  END IF;
 END IF;
 -- Only webhook-shaped writes have provider ordering; gifts and local QA retain it.
 fields:=public.revenuecat_entitlement_fields(NEW.rc_raw);
 IF cardinality(fields)=0 THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.rc_raw->'event_timestamp_ms') IS DISTINCT FROM 'number' THEN
  RAISE EXCEPTION 'RevenueCat event_timestamp_ms required';
 END IF;
 incoming_ms:=(NEW.rc_raw->>'event_timestamp_ms')::numeric;
 IF incoming_ms<=0 OR incoming_ms<>trunc(incoming_ms) THEN
  RAISE EXCEPTION 'Invalid RevenueCat event_timestamp_ms';
 END IF;
 IF TG_OP='UPDATE' AND OLD.is_pro THEN
  -- Repeat the route's protection under the row lock, including concurrent grants.
  IF OLD.expires_at IS NULL AND
   (starts_with(OLD.product_id,'rc_promo_') OR OLD.product_id='app.quiversurf.surf.pro.lifetime') AND
   NOT coalesce(NEW.is_pro AND NEW.expires_at IS NULL AND
    (starts_with(NEW.product_id,'rc_promo_') OR NEW.product_id='app.quiversurf.surf.pro.lifetime'),false) AND
   NOT coalesce(OLD.product_id='app.quiversurf.surf.pro.lifetime' AND NEW.is_pro=false AND NEW.previous_product_id=OLD.product_id,false) THEN
   RETURN NULL;
  END IF;
  IF starts_with(OLD.product_id,'rc_promo_') AND OLD.expires_at>now() AND NEW.is_pro=false AND
   NEW.rc_raw->>'product_id' IS DISTINCT FROM OLD.product_id THEN RETURN NULL; END IF;
  IF starts_with(OLD.product_id,'rc_promo_') AND OLD.expires_at>now() AND
   NEW.expires_at<OLD.expires_at THEN RETURN NULL; END IF;
 END IF;
 incoming:=jsonb_build_array(incoming_ms,coalesce(NEW.rc_raw->>'id',''));
 FOREACH field IN ARRAY fields LOOP
  prior:=NEW.rc_field_events->field;
  -- Stable ID ordering resolves timestamp ties in either delivery order.
  IF prior IS NOT NULL AND (incoming_ms,(incoming->>1) COLLATE "C") <= ((prior->>0)::numeric,(prior->>1) COLLATE "C") THEN
   NEW:=jsonb_populate_record(NEW,jsonb_build_object(field,to_jsonb(OLD)->field));
  ELSE
   NEW.rc_field_events:=jsonb_set(NEW.rc_field_events,ARRAY[field],incoming);
   accepted:=true;
  END IF;
 END LOOP;
 IF NOT accepted THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND jsonb_typeof(OLD.rc_raw->'event_timestamp_ms')='number' AND
  (incoming_ms,(incoming->>1) COLLATE "C") < ((OLD.rc_raw->>'event_timestamp_ms')::numeric,coalesce(OLD.rc_raw->>'id','') COLLATE "C") THEN
  NEW.rc_raw:=OLD.rc_raw;
 END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER guard_revenuecat_entitlement_event
 BEFORE INSERT OR UPDATE OF rc_raw ON public.user_entitlements
 FOR EACH ROW EXECUTE FUNCTION public.guard_revenuecat_entitlement_event();
REVOKE ALL ON FUNCTION public.guard_revenuecat_entitlement_event(),public.revenuecat_entitlement_fields(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_revenuecat_entitlement_event(),public.revenuecat_entitlement_fields(jsonb) TO service_role;

COMMIT;
