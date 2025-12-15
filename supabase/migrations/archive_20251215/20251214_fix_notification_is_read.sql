-- RENAME COLUMN read TO is_read for Consistency
ALTER TABLE public.user_notifications RENAME COLUMN read TO is_read;

-- Fix Index
DROP INDEX IF EXISTS idx_user_notifications_unread;
CREATE INDEX idx_user_notifications_unread ON public.user_notifications(user_id) WHERE is_read = FALSE;
