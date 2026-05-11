-- Reset deleted flags when new messages arrive in a conversation
-- This ensures that if user A deletes a conversation and user B sends a message,
-- the conversation will reappear for user A

CREATE OR REPLACE FUNCTION reset_conversation_deleted_flags()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to run after message insert
DROP TRIGGER IF EXISTS reset_deleted_on_new_message ON messages;
CREATE TRIGGER reset_deleted_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION reset_conversation_deleted_flags();