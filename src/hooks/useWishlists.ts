import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WishlistCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_property_id: string | null;
  is_public: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface WishlistItem {
  id: string;
  collection_id: string;
  property_id: string;
  notes: string | null;
  added_at: string;
}

export const useWishlists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collections, setCollections] = useState<WishlistCollection[]>([]);
  const [propertyMembership, setPropertyMembership] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    if (!user) {
      setCollections([]);
      setPropertyMembership(new Map());
      return;
    }
    setLoading(true);
    try {
      const { data: cols, error } = await supabase
        .from("wishlist_collections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: items } = await supabase
        .from("wishlist_items")
        .select("collection_id, property_id");

      const counts = new Map<string, number>();
      const membership = new Map<string, Set<string>>(); // propertyId -> Set<collectionId>
      (items || []).forEach((it) => {
        counts.set(it.collection_id, (counts.get(it.collection_id) || 0) + 1);
        if (!membership.has(it.property_id)) membership.set(it.property_id, new Set());
        membership.get(it.property_id)!.add(it.collection_id);
      });

      setCollections((cols || []).map((c) => ({ ...c, item_count: counts.get(c.id) || 0 })));
      setPropertyMembership(membership);
    } catch (e: any) {
      console.error("fetchCollections", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const createCollection = async (name: string, description?: string) => {
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("wishlist_collections")
      .insert({ user_id: user.id, name, description: description || null })
      .select()
      .single();
    if (error) throw error;
    await fetchCollections();
    return data as WishlistCollection;
  };

  const renameCollection = async (id: string, name: string, description?: string) => {
    const { error } = await supabase
      .from("wishlist_collections")
      .update({ name, description: description ?? null })
      .eq("id", id);
    if (error) throw error;
    await fetchCollections();
  };

  const deleteCollection = async (id: string) => {
    const { error } = await supabase.from("wishlist_collections").delete().eq("id", id);
    if (error) throw error;
    await fetchCollections();
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    const { error } = await supabase
      .from("wishlist_collections")
      .update({ is_public: isPublic })
      .eq("id", id);
    if (error) throw error;
    await fetchCollections();
  };

  const addToCollection = async (collectionId: string, propertyId: string, notes?: string) => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("wishlist_items")
      .insert({ collection_id: collectionId, property_id: propertyId, notes: notes || null });
    if (error && !error.message.includes("duplicate")) throw error;
    await fetchCollections();
  };

  const removeFromCollection = async (collectionId: string, propertyId: string) => {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("property_id", propertyId);
    if (error) throw error;
    await fetchCollections();
  };

  const isInAnyCollection = (propertyId: string) =>
    (propertyMembership.get(propertyId)?.size || 0) > 0;

  const collectionsForProperty = (propertyId: string) =>
    propertyMembership.get(propertyId) || new Set<string>();

  return {
    collections,
    loading,
    createCollection,
    renameCollection,
    deleteCollection,
    togglePublic,
    addToCollection,
    removeFromCollection,
    isInAnyCollection,
    collectionsForProperty,
    refetch: fetchCollections,
  };
};
