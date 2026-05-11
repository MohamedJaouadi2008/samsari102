
-- Create update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Support conversations table
CREATE TABLE public.support_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  assigned_to uuid NULL,
  status text NOT NULL DEFAULT 'open',
  subject text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone NULL
);

-- Support messages table
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS: support_conversations
CREATE POLICY "Users can view own support convos" ON public.support_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own support convos" ON public.support_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own support convos" ON public.support_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can view all support convos" ON public.support_conversations FOR SELECT TO authenticated USING (is_admin_or_moderator());
CREATE POLICY "Agents can update all support convos" ON public.support_conversations FOR UPDATE TO authenticated USING (is_admin_or_moderator());

-- RLS: support_messages
CREATE POLICY "Users can view own support msgs" ON public.support_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.support_conversations sc WHERE sc.id = support_messages.conversation_id AND sc.user_id = auth.uid()));

CREATE POLICY "Users can send own support msgs" ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.support_conversations sc WHERE sc.id = support_messages.conversation_id AND sc.user_id = auth.uid()));

CREATE POLICY "Agents can view all support msgs" ON public.support_messages FOR SELECT TO authenticated USING (is_admin_or_moderator());
CREATE POLICY "Agents can send support msgs" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND is_admin_or_moderator());
CREATE POLICY "Agents can update support msgs" ON public.support_messages FOR UPDATE TO authenticated USING (is_admin_or_moderator());

-- Realtime
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- Indexes
CREATE INDEX idx_support_convos_user ON public.support_conversations(user_id);
CREATE INDEX idx_support_convos_status ON public.support_conversations(status);
CREATE INDEX idx_support_msgs_convo ON public.support_messages(conversation_id);

-- Trigger
CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
