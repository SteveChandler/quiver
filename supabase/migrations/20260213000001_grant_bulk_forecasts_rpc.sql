BEGIN;

-- Grant execute permission on bulk forecasts RPC to authenticated users and service role
-- This function was created in 20260211150000_create_get_bulk_current_forecasts_rpc.sql
-- and needs to be callable by authenticated users for the /api/forecasts/bulk endpoint.
--
-- Function signature: get_bulk_current_forecasts(UUID[], DATE)
-- Returns: TABLE (beach_id UUID, wave_height TEXT, forecast_date DATE, forecast_time TIME)

GRANT EXECUTE ON FUNCTION public.get_bulk_current_forecasts(UUID[], DATE) TO authenticated, service_role;

COMMIT;
