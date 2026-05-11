-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Create new policy that allows users to mark messages as read in conversations they're part of
CREATE POLICY "Users can update messages in their conversations"
ON messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.host_id = auth.uid() OR conversations.guest_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.host_id = auth.uid() OR conversations.guest_id = auth.uid())
  )
);