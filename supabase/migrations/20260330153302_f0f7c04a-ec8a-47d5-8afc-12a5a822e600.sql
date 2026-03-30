
ALTER TABLE vyva_users ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE vyva_users ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE vyva_users ADD COLUMN IF NOT EXISTS call_duration numeric;
ALTER TABLE vyva_users ADD COLUMN IF NOT EXISTS call_timestamp timestamp with time zone;
