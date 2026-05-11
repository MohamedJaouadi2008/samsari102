-- C5: Expand admin roles + Daily Picks reminder cron

-- 1) Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispute_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';
