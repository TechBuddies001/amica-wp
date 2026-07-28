-- Composite indexes to optimize CRM dashboard queries and speed up RLS-scoped lookups

-- 1. Optimize messages queries (aggregations, activity logs, message series)
CREATE INDEX IF NOT EXISTS idx_messages_account_created_at 
ON public.messages (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_account_sender_created_at 
ON public.messages (account_id, sender_type, created_at DESC);

-- 2. Optimize conversations queries (metrics counts)
CREATE INDEX IF NOT EXISTS idx_conversations_account_status_created_at 
ON public.conversations (account_id, status, created_at DESC);

-- 3. Optimize contacts queries (activity log, metrics count)
CREATE INDEX IF NOT EXISTS idx_contacts_account_created_at 
ON public.contacts (account_id, created_at DESC);

-- 4. Optimize deals queries (pipeline donut, activity logs)
CREATE INDEX IF NOT EXISTS idx_deals_account_status 
ON public.deals (account_id, status);

CREATE INDEX IF NOT EXISTS idx_deals_account_updated_at 
ON public.deals (account_id, updated_at DESC);

-- 5. Optimize automation logs queries (activity log)
CREATE INDEX IF NOT EXISTS idx_automation_logs_account_created_at 
ON public.automation_logs (account_id, created_at DESC);


-- -----------------------------------------------------------------------------
-- RPC Functions for Server-Side Aggregations (eliminates client-side memory loops)
-- -----------------------------------------------------------------------------

-- RPC 1: Get aggregated conversation series count
CREATE OR REPLACE FUNCTION public.get_conversations_series(
  range_days integer,
  tz_offset_minutes integer DEFAULT 0
)
RETURNS TABLE (
  day text,
  incoming bigint,
  outgoing bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT to_char(d, 'YYYY-MM-DD') AS day_key
    FROM generate_series(
      CURRENT_DATE - (range_days - 1) * INTERVAL '1 day',
      CURRENT_DATE,
      '1 day'::interval
    ) d
  ),
  message_counts AS (
    SELECT
      to_char((created_at - (tz_offset_minutes * INTERVAL '1 minute')), 'YYYY-MM-DD') AS message_day,
      SUM(CASE WHEN sender_type = 'customer' THEN 1 ELSE 0 END) AS incoming_count,
      SUM(CASE WHEN sender_type != 'customer' THEN 1 ELSE 0 END) AS outgoing_count
    FROM public.messages
    WHERE created_at >= (CURRENT_DATE - (range_days - 1) * INTERVAL '1 day')
    GROUP BY message_day
  )
  SELECT
    ds.day_key AS day,
    COALESCE(mc.incoming_count, 0)::bigint AS incoming,
    COALESCE(mc.outgoing_count, 0)::bigint AS outgoing
  FROM date_series ds
  LEFT JOIN message_counts mc ON ds.day_key = mc.message_day
  ORDER BY ds.day_key ASC;
END;
$$;

-- RPC 2: Get response time samples calculated on DB side
CREATE OR REPLACE FUNCTION public.get_response_time_samples(range_days integer DEFAULT 14)
RETURNS TABLE (
  customer_at timestamptz,
  response_at timestamptz,
  diff_minutes double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  current_conv text := '';
  pending_customer timestamptz := NULL;
BEGIN
  FOR r IN 
    SELECT conversation_id, sender_type, created_at
    FROM public.messages
    WHERE created_at >= (NOW() - (range_days || ' days')::interval)
    ORDER BY conversation_id ASC, created_at ASC
  LOOP
    IF r.conversation_id != current_conv THEN
      current_conv := r.conversation_id;
      pending_customer := NULL;
    END IF;

    IF r.sender_type = 'customer' THEN
      IF pending_customer IS NULL THEN
        pending_customer := r.created_at;
      END IF;
    ELSIF pending_customer IS NOT NULL THEN
      customer_at := pending_customer;
      response_at := r.created_at;
      diff_minutes := EXTRACT(EPOCH FROM (response_at - customer_at)) / 60.0;
      RETURN NEXT;
      pending_customer := NULL;
    END IF;
  END LOOP;
END;
$$;
