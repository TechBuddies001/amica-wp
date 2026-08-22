-- Migration 030: WhatsApp Masked Relay System (Number Proxy / Exotel-style Relay)
-- Stores active proxy sessions connecting field agents (Side A) to customers (Side B)

CREATE TABLE IF NOT EXISTS public.whatsapp_masked_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    agent_phone VARCHAR(32) NOT NULL,
    agent_name VARCHAR(255),
    customer_phone VARCHAR(32) NOT NULL,
    customer_name VARCHAR(255),
    template_name VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & lookup indexes for inbound webhook routing
CREATE INDEX IF NOT EXISTS idx_masked_sessions_agent ON public.whatsapp_masked_sessions (account_id, agent_phone, status);
CREATE INDEX IF NOT EXISTS idx_masked_sessions_customer ON public.whatsapp_masked_sessions (account_id, customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_masked_sessions_status ON public.whatsapp_masked_sessions (account_id, status);

-- Enable RLS
ALTER TABLE public.whatsapp_masked_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Account members can view masked sessions" ON public.whatsapp_masked_sessions;
CREATE POLICY "Account members can view masked sessions"
    ON public.whatsapp_masked_sessions
    FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Account members can insert masked sessions" ON public.whatsapp_masked_sessions;
CREATE POLICY "Account members can insert masked sessions"
    ON public.whatsapp_masked_sessions
    FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Account members can update masked sessions" ON public.whatsapp_masked_sessions;
CREATE POLICY "Account members can update masked sessions"
    ON public.whatsapp_masked_sessions
    FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Account members can delete masked sessions" ON public.whatsapp_masked_sessions;
CREATE POLICY "Account members can delete masked sessions"
    ON public.whatsapp_masked_sessions
    FOR DELETE
    USING (
        account_id IN (
            SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
        )
    );
