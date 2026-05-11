import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadSupportMessages } from "@/hooks/useUnreadSupportMessages";
import { format } from "date-fns";

type SupportConversation = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

const SupportChatWidget = () => {
  const { user } = useAuth();
  const { unreadCount, refetch } = useUnreadSupportMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing open conversation
  const loadConversation = useCallback(async () => {
    if (!user) return;
    setLoadingConvo(true);
    try {
      const { data } = await supabase
        .from("support_conversations")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["open", "assigned"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (data?.length) {
        setConversation(data[0]);
        await loadMessages(data[0].id);
      }
    } finally {
      setLoadingConvo(false);
    }
  }, [user]);

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);

    // Mark as read
    if (user) {
      await supabase
        .from("support_messages")
        .update({ read: true })
        .eq("conversation_id", convoId)
        .eq("read", false)
        .neq("sender_id", user.id);
      refetch();
    }
  };

  useEffect(() => {
    if (isOpen && user) loadConversation();
  }, [isOpen, user, loadConversation]);

  // Listen for external open events (from Help page)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`support-chat-${conversation.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        const msg = payload.new as SupportMessage;
        setMessages(prev => [...prev, msg]);
        // Auto-mark as read if widget is open
        if (isOpen && user && msg.sender_id !== user.id) {
          supabase
            .from("support_messages")
            .update({ read: true })
            .eq("id", msg.id)
            .then(() => refetch());
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation, isOpen, user, refetch]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const startConversation = async () => {
    if (!user || !subject.trim() || !newMessage.trim()) return;
    setSending(true);
    try {
      const { data: convo, error: convoErr } = await supabase
        .from("support_conversations")
        .insert({ user_id: user.id, subject: subject.trim() })
        .select()
        .single();

      if (convoErr) throw convoErr;

      const { error: msgErr } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: convo.id,
          sender_id: user.id,
          content: newMessage.trim(),
        });

      if (msgErr) throw msgErr;

      setConversation(convo);
      setNewMessage("");
      setSubject("");
      await loadMessages(convo.id);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !conversation || !newMessage.trim()) return;
    setSending(true);
    try {
      await supabase.from("support_messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conversation) sendMessage();
    else startConversation();
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-primary text-primary-foreground rounded-full p-3.5 sm:p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-5"
            >
              {unreadCount}
            </Badge>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed inset-x-2 bottom-2 top-2 sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:w-[380px] sm:h-[520px] sm:max-h-[calc(100vh-3rem)] z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-sm truncate">Support Chat</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-primary-foreground/20 rounded" aria-label="Minimize">
                <Minimize2 className="h-4 w-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-primary-foreground/20 rounded" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            {loadingConvo ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !conversation ? (
              <div className="space-y-3">
                <div className="text-center py-6">
                  <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h4 className="font-semibold text-sm">How can we help?</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a conversation with our support team.
                  </p>
                </div>
                <Input
                  placeholder="Subject (e.g. Payment issue)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-sm"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {conversation.subject}
                  </span>
                </div>
                {messages.map((msg) => {
                  const isMe = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        {!isMe && (
                          <p className="text-xs font-medium text-primary mb-0.5">Support</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-border flex gap-2">
            <Input
              placeholder={conversation ? "Type a message..." : "Describe your issue..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className="text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !newMessage.trim() || (!conversation && !subject.trim())}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
