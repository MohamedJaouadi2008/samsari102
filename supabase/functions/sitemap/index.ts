import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SITE_URL = "https://samsari.tech";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Static pages - only pages with real unique content
const staticPages = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/search", priority: "0.9", changefreq: "daily" },
  { path: "/become-host", priority: "0.8", changefreq: "weekly" },
  { path: "/safety", priority: "0.7", changefreq: "monthly" },
  { path: "/help", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy", priority: "0.5", changefreq: "monthly" },
  { path: "/terms", priority: "0.5", changefreq: "monthly" },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all published properties with short codes
    const { data: properties, error } = await supabase
      .from("properties")
      .select("short_code, updated_at, governorate, city, photos, title")
      .eq("status", "published")
      .not("short_code", "is", null);

    if (error) {
      console.error("Error fetching properties:", error);
      throw error;
    }

    const today = new Date().toISOString().split("T")[0];
    const langs = ["en", "fr", "ar"];

    const buildAlternates = (loc: string) =>
      langs
        .map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l}" href="${loc}" />`
        )
        .join("\n") +
      `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    for (const page of staticPages) {
      const loc = `${SITE_URL}${page.path}`;
      xml += `  <url>
    <loc>${loc}</loc>
${buildAlternates(loc)}
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    if (properties && properties.length > 0) {
      const governorates = new Set<string>();
      for (const p of properties) {
        if (p.governorate) governorates.add(p.governorate);
      }

      for (const gov of governorates) {
        const loc = `${SITE_URL}/search?governorate=${encodeURIComponent(gov)}`;
        xml += `  <url>
    <loc>${loc}</loc>
${buildAlternates(loc)}
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      }

      for (const property of properties) {
        const lastmod = property.updated_at
          ? new Date(property.updated_at).toISOString().split("T")[0]
          : today;
        const loc = `${SITE_URL}/p/${property.short_code}`;

        let imageBlock = "";
        const photos = property.photos as any;
        if (Array.isArray(photos) && photos.length > 0 && photos[0]?.url) {
          const imgUrl = String(photos[0].url).replace(/&/g, "&amp;");
          imageBlock = `    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${(property.title || "").replace(/[<>&]/g, "")}</image:title>
    </image:image>
`;
        }

        xml += `  <url>
    <loc>${loc}</loc>
${buildAlternates(loc)}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
${imageBlock}  </url>
`;
      }
    }

    xml += `</urlset>`;

    console.log(`Generated sitemap with ${staticPages.length} static pages and ${properties?.length || 0} properties`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`,
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/xml; charset=utf-8",
        },
      }
    );
  }
});
