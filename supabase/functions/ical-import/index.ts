import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { checkRateLimit, clientIdentifier } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === SSRF PROTECTION ===
// Block private/loopback/link-local/metadata IP ranges
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) || // link-local + AWS metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast + reserved
  );
}

function validateFeedUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  // Block direct IP literals in private ranges (best-effort; DNS rebinding is mitigated by short timeout + size cap)
  const host = url.hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIPv4(host)) {
    return { ok: false, reason: "Private IP addresses are not allowed" };
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Internal hostnames are not allowed" };
  }
  // Block IPv6 loopback/link-local literals
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (v6 === "::1" || v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd")) {
      return { ok: false, reason: "Private IPv6 addresses are not allowed" };
    }
  }
  return { ok: true, url };
}

const MAX_FEED_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;

async function safeFetchFeed(rawUrl: string): Promise<string> {
  const validation = validateFeedUrl(rawUrl);
  if (!validation.ok) throw new Error(`Feed URL rejected: ${validation.reason}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(validation.url.toString(), {
      headers: { "User-Agent": "Samsari-iCal-Sync/1.0" },
      redirect: "manual", // prevent redirect-based SSRF
      signal: controller.signal,
    });
    if (resp.status >= 300 && resp.status < 400) {
      throw new Error(`Redirects are not followed (status ${resp.status})`);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body?.getReader();
    if (!reader) return await resp.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error("Feed exceeds 5 MB size limit");
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc, 0);
        merged.set(c, acc.length);
        return merged;
      }, new Uint8Array())
    );
  } finally {
    clearTimeout(timer);
  }
}

// Minimal RFC5545 VEVENT parser — extracts UID, DTSTART, DTEND, SUMMARY
function parseICS(text: string) {
  // Unfold lines (lines starting with space/tab continue previous)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: Array<{ uid: string; start: string; end: string; summary?: string }> = [];
  let cur: any = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur?.start && cur?.end) events.push(cur);
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const keyPart = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const key = keyPart.split(";")[0];
      if (key === "UID") cur.uid = value;
      else if (key === "DTSTART") cur.start = value;
      else if (key === "DTEND") cur.end = value;
      else if (key === "SUMMARY") cur.summary = value;
    }
  }
  return events;
}

// Convert ICS date (YYYYMMDD or YYYYMMDDTHHMMSSZ) to YYYY-MM-DD
function icsDateToISO(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Rate limit: 30 requests / 5 min per caller (cron runs once)
    const allowed = await checkRateLimit({
      identifier: clientIdentifier(req),
      scope: "ical-import",
      maxRequests: 30,
      windowSeconds: 300,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { feed_id } = body ?? {};
    if (feed_id !== undefined && (typeof feed_id !== "string" || !/^[0-9a-f-]{36}$/i.test(feed_id))) {
      return new Response(JSON.stringify({ error: "Invalid feed_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch feeds to sync (single feed if specified, all enabled feeds if cron)
    let query = supabase
      .from("property_calendar_feeds")
      .select("id, property_id, feed_url, enabled");
    if (feed_id) query = query.eq("id", feed_id);
    else query = query.eq("enabled", true);

    const { data: feeds, error: feedErr } = await query;
    if (feedErr) throw feedErr;

    const results: any[] = [];

    for (const feed of feeds ?? []) {
      try {
        const text = await safeFetchFeed(feed.feed_url);
        const events = parseICS(text);

        // Delete old entries for this feed and re-insert (simple full sync)
        await supabase.from("external_blocked_dates").delete().eq("feed_id", feed.id);

        const rows = events
          .map((e) => {
            const start = icsDateToISO(e.start);
            const end = icsDateToISO(e.end);
            if (!start || !end) return null;
            return {
              property_id: feed.property_id,
              feed_id: feed.id,
              start_date: start,
              end_date: end,
              summary: e.summary?.slice(0, 200) ?? null,
              external_uid: e.uid,
            };
          })
          .filter(Boolean);

        if (rows.length > 0) {
          const { error: insErr } = await supabase
            .from("external_blocked_dates")
            .insert(rows as any);
          if (insErr) throw insErr;
        }

        await supabase
          .from("property_calendar_feeds")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: "success",
            last_sync_error: null,
            events_imported: rows.length,
          })
          .eq("id", feed.id);

        results.push({ feed_id: feed.id, imported: rows.length });
      } catch (err: any) {
        await supabase
          .from("property_calendar_feeds")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: "error",
            last_sync_error: String(err?.message ?? err).slice(0, 500),
          })
          .eq("id", feed.id);
        results.push({ feed_id: feed.id, error: String(err?.message ?? err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ical-import error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
