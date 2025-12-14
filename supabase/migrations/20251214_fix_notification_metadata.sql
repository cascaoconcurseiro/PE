-- RENAME COLUMN data TO metadata to match legacy RPCs and Triggers
ALTER TABLE public.user_notifications RENAME COLUMN data TO metadata;
