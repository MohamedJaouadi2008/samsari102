import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chooseCount(poolSize: number, requested?: number | null): number {
  if (requested && requested > 0) {
    // Round to nearest multiple of 4, capped at pool size
    const rounded = Math.max(4, Math.floor(requested / 4) * 4);
    return Math.min(rounded, Math.floor(poolSize / 4) * 4 || poolSize);
  }
  if (poolSize < 8) return Math.max(4, Math.floor(poolSize / 4) * 4);
  if (poolSize < 16) return 8;
  return 12;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);

    // 1. Admin override has highest priority
    const { data: override } = await supabase
      .from("admin_picks_override")
      .select("property_ids, count")
      .eq("pick_date", today)
      .maybeSingle();

    if (override?.property_ids && Array.isArray(override.property_ids) && override.property_ids.length > 0) {
      return new Response(
        JSON.stringify({ property_ids: override.property_ids, source: "admin_override" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Cached auto-pick for today
    const { data: cached } = await supabase
      .from("daily_picks_cache")
      .select("property_ids")
      .eq("pick_date", today)
      .maybeSingle();

    if (cached?.property_ids && Array.isArray(cached.property_ids) && cached.property_ids.length > 0) {
      return new Response(
        JSON.stringify({ property_ids: cached.property_ids, source: "cache" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Compute fresh picks
    const { data: props, error } = await supabase
      .from("properties")
      .select("id, governorate, created_at")
      .eq("status", "published")
      .eq("is_public", true)
      .eq("is_banned", false)
      .eq("is_frozen", false)
      .limit(1000);

    if (error) throw error;

    if (!props || props.length === 0) {
      return new Response(JSON.stringify({ property_ids: [], source: "empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = props.map((p) => p.id);
    const [reviewsRes, viewsRes] = await Promise.all([
      supabase.from("reviews").select("property_id, rating").in("property_id", ids).eq("status", "approved"),
      supabase
        .from("property_views")
        .select("property_id")
        .in("property_id", ids)
        .gte("viewed_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    const ratingMap: Record<string, { sum: number; count: number }> = {};
    reviewsRes.data?.forEach((r: any) => {
      if (!ratingMap[r.property_id]) ratingMap[r.property_id] = { sum: 0, count: 0 };
      ratingMap[r.property_id].sum += r.rating;
      ratingMap[r.property_id].count += 1;
    });

    const viewMap: Record<string, number> = {};
    viewsRes.data?.forEach((v: any) => {
      viewMap[v.property_id] = (viewMap[v.property_id] || 0) + 1;
    });

    const enriched = props.map((p) => {
      const r = ratingMap[p.id];
      const avg = r ? r.sum / r.count : 0;
      const views = viewMap[p.id] || 0;
      const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
      return { ...p, avg, reviewCount: r?.count || 0, views, ageDays };
    });

    const total = enriched.length;
    const targetCount = chooseCount(total);

    // Smart blend proportions: 40% top-rated, 25% trending, 25% new, 10% underexposed
    const nTopRated = Math.max(1, Math.round(targetCount * 0.4));
    const nTrending = Math.max(1, Math.round(targetCount * 0.25));
    const nNewest = Math.max(1, Math.round(targetCount * 0.25));
    const nUnder = Math.max(1, targetCount - nTopRated - nTrending - nNewest);

    const topRated = [...enriched]
      .filter((p) => p.reviewCount >= 1)
      .sort((a, b) => b.avg - a.avg || b.reviewCount - a.reviewCount)
      .slice(0, nTopRated);

    const trending = [...enriched]
      .filter((p) => !topRated.find((t) => t.id === p.id))
      .sort((a, b) => b.views - a.views)
      .slice(0, nTrending);

    const newest = [...enriched]
      .filter(
        (p) =>
          p.ageDays <= 30 &&
          !topRated.find((t) => t.id === p.id) &&
          !trending.find((t) => t.id === p.id)
      )
      .sort((a, b) => a.ageDays - b.ageDays)
      .slice(0, nNewest);

    const underexposed = [...enriched]
      .filter(
        (p) =>
          p.views < 5 &&
          !topRated.find((t) => t.id === p.id) &&
          !trending.find((t) => t.id === p.id) &&
          !newest.find((t) => t.id === p.id)
      )
      .sort(() => Math.random() - 0.5)
      .slice(0, nUnder);

    let picks = [...topRated, ...trending, ...newest, ...underexposed].map((p) => p.id);

    // Pad with random eligible if short of target
    if (picks.length < targetCount) {
      const remaining = enriched
        .filter((p) => !picks.includes(p.id))
        .sort(() => Math.random() - 0.5);
      picks = [...picks, ...remaining.slice(0, targetCount - picks.length).map((p) => p.id)];
    }

    picks = picks.slice(0, targetCount);

    // Cache
    await supabase.from("daily_picks_cache").upsert({
      pick_date: today,
      property_ids: picks,
      generated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ property_ids: picks, source: "auto", count: picks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("daily-picks error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
