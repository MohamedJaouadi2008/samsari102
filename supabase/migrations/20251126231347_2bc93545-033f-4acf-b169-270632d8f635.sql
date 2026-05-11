-- Fix search path security issue for reset_conversation_deleted_flags function
DROP FUNCTION IF EXISTS reset_conversation_deleted_flags() CASCADE;

CREATE OR REPLACE FUNCTION reset_conversation_deleted_flags()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset both deleted flags when a new message is inserted
  UPDATE conversations
  SET 
    deleted_by_host = false,
    deleted_by_guest = false,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS reset_deleted_on_new_message ON messages;
CREATE TRIGGER reset_deleted_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION reset_conversation_deleted_flags();