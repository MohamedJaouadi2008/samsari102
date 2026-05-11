import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const scope = body?.scope === "portfolio" ? "portfolio" : "property";
    const force = body?.force === true;
    const property_id = typeof body?.property_id === "string" ? body.property_id : undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (scope === "property" && (!property_id || !UUID_RE.test(property_id))) {
      return new Response(JSON.stringify({ error: "property_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseService);

    // Cache check
    if (!force) {
      const cacheQuery = admin
        .from("host_ai_insights")
        .select("*")
        .eq("host_id", user.id)
        .eq("scope", scope)
        .gte("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1);
      if (scope === "property") cacheQuery.eq("property_id", property_id);
      else cacheQuery.is("property_id", null);
      const { data: cached } = await cacheQuery;
      if (cached && cached.length > 0) {
        return new Response(JSON.stringify({ ...cached[0], cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Gather metrics
    let metricsSnapshot: any = {};
    let propertiesContext: string;

    if (scope === "property") {
      const { data: prop } = await admin
        .from("properties")
        .select("title, governorate, city, property_type, bedrooms, max_guests, price_per_night, amenities")
        .eq("id", property_id)
        .eq("host_id", user.id)
        .single();
      if (!prop) {
        return new Response(JSON.stringify({ error: "Property not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count: views30 } = await admin
        .from("property_views")
        .select("id", { count: "exact", head: true })
        .eq("property_id", property_id)
        .gte("viewed_at", new Date(Date.now() - 30 * 86400000).toISOString());

      const { data: bookings } = await admin
        .from("bookings")
        .select("status, total_price, check_in_date, check_out_date, created_at")
        .eq("property_id", property_id)
        .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString());

      const confirmed = (bookings || []).filter((b) =>
        ["deposit_paid", "checked_in", "checked_out", "settlement_pending", "settled"].includes(b.status)
      );
      const revenue90 = confirmed.reduce((s, b) => s + Number(b.total_price || 0), 0);

      const { data: reviews } = await admin
        .from("reviews")
        .select("rating")
        .eq("property_id", property_id)
        .eq("status", "approved");
      const avgRating = reviews && reviews.length
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : null;

      metricsSnapshot = {
        property: prop,
        views_30d: views30 || 0,
        bookings_90d: confirmed.length,
        revenue_90d: revenue90,
        avg_rating: avgRating,
        review_count: reviews?.length || 0,
        conversion_rate: views30 ? Math.round((confirmed.length / views30) * 1000) / 10 : 0,
      };
      propertiesContext = `Property: ${prop.title} (${prop.property_type}) in ${prop.city}, ${prop.governorate}. ${prop.bedrooms} bed, sleeps ${prop.max_guests}, ${prop.price_per_night} TND/night.`;
    } else {
      const { data: props } = await admin
        .from("properties")
        .select("id, title, city, governorate, price_per_night, status")
        .eq("host_id", user.id);
      const propIds = (props || []).map((p) => p.id);

      const { data: bookings } = propIds.length
        ? await admin
            .from("bookings")
            .select("property_id, status, total_price, host_payout_amount, created_at")
            .in("property_id", propIds)
            .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
        : { data: [] };
      const confirmed = (bookings || []).filter((b: any) =>
        ["deposit_paid", "checked_in", "checked_out", "settlement_pending", "settled"].includes(b.status)
      );
      const revenue90 = confirmed.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
      const payout90 = confirmed.reduce((s: number, b: any) => s + Number(b.host_payout_amount || 0), 0);

      metricsSnapshot = {
        property_count: props?.length || 0,
        published_count: (props || []).filter((p) => p.status === "published").length,
        bookings_90d: confirmed.length,
        revenue_90d: revenue90,
        payout_90d: payout90,
        properties: (props || []).map((p) => ({ title: p.title, city: p.city, price: p.price_per_night })),
      };
      propertiesContext = `Portfolio of ${props?.length || 0} properties across ${new Set((props || []).map((p) => p.governorate)).size} regions in Tunisia.`;
    }

    // Call Lovable AI Gateway with tool calling for structured output
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a hospitality analytics expert for Samsari, Tunisia's short-term rental platform. Always: (1) use TND currency in any price mention, (2) reference Tunisian context — governorates (Tunis, Sousse, Nabeul/Hammamet, Sfax, Djerba, Monastir, Bizerte, Mahdia, Tozeur), high season (June–September, peak July–August), shoulder (May, October), low season (November–March, except holiday week around 20 Dec–5 Jan), (3) mention specific Tunisian guest expectations (A/C in summer is mandatory, parking, Wi-Fi, cleanliness, host responsiveness in Arabic/French), (4) be concise and actionable — no generic platitudes. Each recommendation must be a concrete next step the host can take this week.",
          },
          {
            role: "user",
            content: `${propertiesContext}\n\nMetrics (last 90 days):\n${JSON.stringify(metricsSnapshot, null, 2)}\n\nGenerate insights tailored to the Tunisian rental market with: 1 short summary (2-3 sentences), 3 strengths, 3 areas to improve, 4 actionable recommendations the host can implement within 7 days.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "host_insights",
              description: "Structured host insights",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "2-3 sentence overview" },
                  strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                  improvements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                  recommendations: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        action: { type: "string" },
                        impact: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["title", "action", "impact"],
                    },
                  },
                },
                required: ["summary", "strengths", "improvements", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "host_insights" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Add funds at Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI returned no insights" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const insights = JSON.parse(toolCall.function.arguments);

    // Cache it
    const { data: saved } = await admin
      .from("host_ai_insights")
      .insert({
        host_id: user.id,
        property_id: scope === "property" ? property_id : null,
        scope,
        insights,
        metrics_snapshot: metricsSnapshot,
        model: "google/gemini-3-flash-preview",
      })
      .select()
      .single();

    return new Response(JSON.stringify({ ...saved, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("host-ai-insights error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
