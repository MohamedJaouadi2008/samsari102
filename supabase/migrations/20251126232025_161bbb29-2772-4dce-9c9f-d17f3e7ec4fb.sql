-- Enable REPLICA IDENTITY FULL on messages table for real-time UPDATE events
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Ensure messages table is added to realtime publication
ALTER publication supabase_realtime ADD TABLE messages;