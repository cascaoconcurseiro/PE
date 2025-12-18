-- Function to check if a user exists by email (Securely)
-- Needs SECURITY DEFINER to access auth.users from a normal user context
CREATE OR REPLACE FUNCTION check_user_by_email(email_to_check text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
  requesting_user_id uuid;
BEGIN
  -- Get the ID of the user calling the function
  requesting_user_id := auth.uid();
  
  -- Prevent looking up basic info if not authenticated (optional hardness)
  IF requesting_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Look up the user in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_to_check;

  RETURN target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_by_email(text) TO authenticated;
