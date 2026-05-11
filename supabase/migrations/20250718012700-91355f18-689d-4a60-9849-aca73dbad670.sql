
-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, host_id, guest_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN DEFAULT false
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversations
CREATE POLICY "Users can view conversations they are part of" 
  ON public.conversations 
  FOR SELECT 
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Users can create conversations as guest" 
  ON public.conversations 
  FOR INSERT 
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Users can update conversations they are part of" 
  ON public.conversations 
  FOR UPDATE 
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Users can delete conversations they are part of" 
  ON public.conversations 
  FOR DELETE 
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for messages
CREATE POLICY "Users can view messages in their conversations" 
  ON public.messages 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.host_id = auth.uid() OR conversations.guest_id = auth.uid())
  ));

CREATE POLICY "Users can create messages in their conversations" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.host_id = auth.uid() OR conversations.guest_id = auth.uid())
  ) AND auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" 
  ON public.messages 
  FOR UPDATE 
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" 
  ON public.messages 
  FOR DELETE 
  USING (auth.uid() = sender_id);

-- Add booking request status to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS request_message TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS host_response TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;
