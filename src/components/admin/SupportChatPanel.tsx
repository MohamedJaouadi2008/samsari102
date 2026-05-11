import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, CheckCircle, User, Clock } from "lucide-react";
import { format } from "date-fns";

type Conversation = {
  id: string;
  user_id: string;
  assigned_to: string | null;
  status: string;
  subject: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  unread_count?: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

const SupportChatPanel = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const statuses = filter === "open" ? ["open", "assigned"] : ["closed"];
    const { data: convos } = await supabase
      .from("support_conversations")
      .select("*")
      .in("status", statuses)
      .order("updated_at", { ascending: false });

    if (!convos) return;

    // Enrich with user names and unread counts
    const userIds = [...new Set(convos.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || p.username || "User"]) || []);

    // Get unread counts
    const enriched = await Promise.all(convos.map(async (c) => {
      const { count } = await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("read", false)
        .neq("sender_id", user?.id || "");

      return {
        ...c,
        user_name: profileMap.get(c.user_id) || "Unknown",
        unread_count: count || 0,
      };
    }));

    setConversations(enriched);
  }, [filter, user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Real-time refresh
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-convos")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => loadConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  const selectConversation = async (convo: Conversation) => {
    setActiveConvo(convo);

    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);

    // Mark messages as read
    await supabase
      .from("support_messages")
      .update({ read: true })
      .eq("conversation_id", convo.id)
      .eq("read", false)
      .neq("sender_id", user?.id || "");

    // Auto-assign if unassigned
    if (!convo.assigned_to && user) {
      await supabase
        .from("support_conversations")
        .update({ assigned_to: user.id, status: "assigned" })
        .eq("id", convo.id);
    }

    loadConversations();
  };

  // Real-time messages for active convo
  useEffect(() => {
    if (!activeConvo) return;

    const channel = supabase
      .channel(`admin-support-msgs-${activeConvo.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${activeConvo.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        // Auto-mark read
        if (user && msg.sender_id !== user.id) {
          supabase.from("support_messages").update({ read: true }).eq("id", msg.id).then(() => loadConversations());
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvo, user, loadConversations]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeConvo || !newMessage.trim()) return;
    setSending(true);
    try {
      await supabase.from("support_messages").insert({
        conversation_id: activeConvo.id,
        sender_id: user.id,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!activeConvo) return;
    await supabase
      .from("support_conversations")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", activeConvo.id);
    setActiveConvo(null);
    setMessages([]);
    loadConversations();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Conversation list */}
      <Card className="md:col-span-1 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Support Chats
          </CardTitle>
          <div className="flex gap-1 mt-2">
            <Button
              variant={filter === "open" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("open"); setActiveConvo(null); }}
            >
              Open
            </Button>
            <Button
              variant={filter === "closed" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("closed"); setActiveConvo(null); }}
            >
              Closed
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No conversations</p>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => selectConversation(convo)}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors ${
                    activeConvo?.id === convo.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{convo.user_name}</span>
                    {(convo.unread_count || 0) > 0 && (
                      <Badge variant="destructive" className="text-xs h-5 min-w-5 flex items-center justify-center">
                        {convo.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={convo.status === "assigned" ? "default" : "secondary"} className="text-[10px] h-4">
                      {convo.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(convo.updated_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="md:col-span-2 flex flex-col">
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to respond</p>
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="pb-2 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {activeConvo.user_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{activeConvo.subject}</p>
                </div>
                {activeConvo.status !== "closed" && (
                  <Button variant="outline" size="sm" onClick={closeConversation}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Close
                  </Button>
                )}
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isAgent = msg.sender_id !== activeConvo.user_id;
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          isAgent
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {activeConvo.status !== "closed" && (
              <form onSubmit={sendMessage} className="p-3 border-t border-border flex gap-2">
                <Input
                  placeholder="Type a reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                  className="text-sm"
                />
                <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default SupportChatPanel;
