
-- Add deletion tracking columns to conversations table
ALTER TABLE public.conversations 
ADD COLUMN deleted_by_host BOOLEAN DEFAULT false,
ADD COLUMN deleted_by_guest BOOLEAN DEFAULT false;
