
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSavedProperties = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSavedProperties();
    }
  }, [user]);

  const fetchSavedProperties = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("saved_properties")
        .select("property_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const propertyIds = new Set(data.map(item => item.property_id));
      setSavedPropertyIds(propertyIds);
    } catch (error) {
      console.error("Error fetching saved properties:", error);
    }
  };

  const toggleSavedProperty = async (propertyId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save properties",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const isSaved = savedPropertyIds.has(propertyId);

      if (isSaved) {
        // Remove from saved
        const { error } = await supabase
          .from("saved_properties")
          .delete()
          .eq("user_id", user.id)
          .eq("property_id", propertyId);

        if (error) throw error;

        setSavedPropertyIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(propertyId);
          return newSet;
        });

        toast({
          title: "Property removed",
          description: "Property removed from your saved list"
        });
      } else {
        // Add to saved
        const { error } = await supabase
          .from("saved_properties")
          .insert([{
            user_id: user.id,
            property_id: propertyId
          }]);

        if (error) throw error;

        setSavedPropertyIds(prev => new Set([...prev, propertyId]));

        toast({
          title: "Property saved",
          description: "Property added to your saved list"
        });
      }
    } catch (error: any) {
      console.error("Error toggling saved property:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update saved property",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isPropertySaved = (propertyId: string) => savedPropertyIds.has(propertyId);

  return {
    savedPropertyIds,
    toggleSavedProperty,
    isPropertySaved,
    loading
  };
};
