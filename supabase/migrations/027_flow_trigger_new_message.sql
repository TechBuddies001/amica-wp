-- Add 'new_message_received' as a valid flow trigger type
-- This allows flows to start on ANY inbound text message, not just the first one.
ALTER TABLE flows DROP CONSTRAINT IF EXISTS flows_trigger_type_check;
ALTER TABLE flows ADD CONSTRAINT flows_trigger_type_check 
  CHECK (trigger_type IN ('keyword', 'first_inbound_message', 'manual', 'new_message_received'));
