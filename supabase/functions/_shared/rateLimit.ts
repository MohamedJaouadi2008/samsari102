// Shared rate-limit helper for edge functions.
// Uses the public.check_rate_limit Postgres function (atomic increment).
// Returns true when the request is allowed, false when the limit is exceeded.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

let cached: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  return cached;
}

export async function checkRateLimit(opts: {
  identifier: string;     // user id, ip, or composite
  scope: string;          // function name + action
  maxRequests: number;
  windowSeconds: number;
}): Promise<boolean> {
  try {
    const { data, error } = await admin().rpc("check_rate_limit", {
      _identifier: opts.identifier.slice(0, 200),
      _scope: opts.scope.slice(0, 100),
      _max_requests: opts.maxRequests,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.error("[rateLimit] RPC error:", error.message);
      return true; // fail-open to avoid blocking legitimate traffic on infra issues
    }
    return data === true;
  } catch (e) {
    console.error("[rateLimit] threw:", e);
    return true;
  }
}

export function clientIdentifier(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "anon";
  return `ip:${ip}`;
}
