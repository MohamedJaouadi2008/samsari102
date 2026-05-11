import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SavedSearchFilters {
  governorate?: string;
  city?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  instantBook?: boolean;
  verifiedHost?: boolean;
  minRating?: number;
}

function matchesFilters(property: any, hostVerified: boolean, filters: SavedSearchFilters): boolean {
  if (filters.governorate && property.governorate !== filters.governorate) return false;
  if (filters.city && property.city !== filters.city) return false;
  if (filters.propertyType && property.property_type !== filters.propertyType) return false;
  if (filters.minPrice && Number(property.price_per_night) < filters.minPrice) return false;
  if (filters.maxPrice && Number(property.price_per_night) > filters.maxPrice) return false;
  if (filters.guests && (property.max_guests || 0) < filters.guests) return false;
  if (filters.bedrooms && (property.bedrooms || 0) < filters.bedrooms) return false;
  if (filters.bathrooms && (property.bathrooms || 0) < filters.bathrooms) return false;
  if (filters.instantBook && !property.booking_enabled) return false;
  if (filters.verifiedHost && !hostVerified) return false;
  if (filters.amenities && filters.amenities.length > 0) {
    const propAmenities: string[] = Array.isArray(property.amenities) ? property.amenities : [];
    const has = filters.amenities.every((a) => propAmenities.includes(a));
    if (!has) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Internal-only: must come from pg_net trigger (which doesn't pass a JWT) or cron with secret.
    const cronSecret = req.headers.get("x-cron-secret");
    const isInternal = cronSecret === Deno.env.get("CRON_SECRET");
    const isPgNetTrigger = !req.headers.get("authorization") && !req.headers.get("apikey");
    if (!isInternal && !isPgNetTrigger) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const property_id = typeof body?.property_id === "string" ? body.property_id : "";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(property_id)) {
      return new Response(JSON.stringify({ error: "property_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("*")
      .eq("id", property_id)
      .single();

    if (propErr || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", property.host_id)
      .maybeSingle();
    const hostVerified = hostProfile?.verification_status === "verified";

    const { data: searches } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("alerts_enabled", true);

    if (!searches || searches.length === 0) {
      return new Response(JSON.stringify({ matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let matched = 0;
    for (const search of searches) {
      // Don't notify the host about their own property
      if (search.user_id === property.host_id) continue;

      const filters = (search.filters || {}) as SavedSearchFilters;
      if (!matchesFilters(property, hostVerified, filters)) continue;

      matched++;

      // Build link with filters
      const params = new URLSearchParams();
      if (filters.governorate) params.set("governorate", filters.governorate);
      if (filters.city) params.set("city", filters.city);
      const link = `/search${params.toString() ? `?${params.toString()}` : ""}`;

      // Insert in-app notification
      await supabase.from("notifications").insert({
        user_id: search.user_id,
        type: "saved_search_match",
        title: `New match: ${search.name}`,
        message: `${property.title} in ${property.city} matches your saved search.`,
        link,
      });

      // Send instant email via existing notification email function
      const { data: userRow } = await supabase.auth.admin.getUserById(search.user_id);
      const email = userRow?.user?.email;
      if (email) {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            type: "saved_search_match",
            recipientEmail: email,
            recipientName: userRow?.user?.user_metadata?.full_name || "there",
            title: `New property matches "${search.name}"`,
            message: `${property.title} in ${property.city}, ${property.governorate} — ${property.price_per_night} TND/night.`,
            link: `https://samsari.tech${link}`,
          },
        });
      }

      // Update last_alerted_at
      await supabase
        .from("saved_searches")
        .update({ last_alerted_at: new Date().toISOString() })
        .eq("id", search.id);
    }

    return new Response(JSON.stringify({ matched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("process-saved-search-alerts error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
