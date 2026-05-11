import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, any>;
  alerts_enabled: boolean;
  last_alerted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useSavedSearches = () => {
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSearches = useCallback(async () => {
    if (!user) {
      setSearches([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setSearches(data as SavedSearch[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const createSearch = async (name: string, filters: Record<string, any>, alertsEnabled = true) => {
    if (!user) {
      toast.error("Please sign in to save searches");
      return null;
    }
    const { data, error } = await supabase
      .from("saved_searches")
      .insert({ user_id: user.id, name, filters, alerts_enabled: alertsEnabled })
      .select()
      .single();
    if (error) {
      toast.error("Failed to save search");
      return null;
    }
    toast.success("Search saved! You'll be alerted on matches.");
    await fetchSearches();
    return data;
  };

  const toggleAlerts = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("saved_searches")
      .update({ alerts_enabled: enabled })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update alerts");
      return;
    }
    await fetchSearches();
  };

  const deleteSearch = async (id: string) => {
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete search");
      return;
    }
    toast.success("Saved search removed");
    await fetchSearches();
  };

  return { searches, loading, createSearch, toggleAlerts, deleteSearch, refetch: fetchSearches };
};
