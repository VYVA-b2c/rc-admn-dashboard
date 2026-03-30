ALTER TABLE vyva_users ADD COLUMN country text DEFAULT 'Germany';
ALTER TABLE vyva_users ALTER COLUMN language SET DEFAULT 'de';
ALTER TABLE vyva_users ALTER COLUMN timezone SET DEFAULT 'Europe/Berlin';