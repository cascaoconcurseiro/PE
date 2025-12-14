-- FIX: Re-link users based on email
-- This fixes the issue where family members have emails but are not technically "linked" to the User ID.
-- Run this in Supabase SQL Editor.

UPDATE public.family_members AS fm
SET linked_user_id = au.id
FROM auth.users AS au
WHERE LOWER(fm.email) = LOWER(au.email)
  AND fm.linked_user_id IS NULL; -- Only update if missing

-- Also, verify if any trips need to be updated now
-- We can re-trigger trip mirroring for trips created in the last 24 hours
-- merely by "touching" them, or we can force it here?
-- Let's just touch trips that have shared participants.

UPDATE trips
SET updated_at = NOW()
WHERE participants IS NOT NULL 
  AND jsonb_array_length(participants) > 0
  AND updated_at > NOW() - INTERVAL '1 day'; -- Only recent ones to avoid chaos
