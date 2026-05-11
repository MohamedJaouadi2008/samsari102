/**
 * Centralized "publicly visible property" filter.
 *
 * A property is publicly visible when:
 *  - status      = 'published'
 *  - is_public   = true
 *  - is_banned   = false
 *  - is_frozen   = false
 *
 * Use these helpers everywhere a public-facing query reads `properties`,
 * so the rule never drifts across files (search, details, landing, autocomplete, profiles, etc.).
 */

export const PUBLIC_PROPERTY_STATUS = "published" as const;

/**
 * Apply the canonical "public visible property" filter to a Supabase query
 * builder on the `properties` table.
 *
 * Usage:
 *   const { data } = await applyPublicPropertyFilter(
 *     supabase.from("properties").select("*")
 *   );
 */
export function applyPublicPropertyFilter<T>(query: T): T {
  // The Supabase query builder returns itself from each filter call, so we can
  // chain freely. We type as `any` internally to avoid leaking the complex
  // PostgrestFilterBuilder generics into every call site.
  const q = query as any;
  return q
    .eq("status", PUBLIC_PROPERTY_STATUS)
    .eq("is_public", true)
    .eq("is_banned", false)
    .eq("is_frozen", false) as T;
}

/**
 * Client-side predicate for already-fetched property rows
 * (e.g. when filtering an in-memory list in the admin panel).
 */
export function isPubliclyVisibleProperty(p: {
  status?: string | null;
  is_public?: boolean | null;
  is_banned?: boolean | null;
  is_frozen?: boolean | null;
}): boolean {
  return (
    p.status === PUBLIC_PROPERTY_STATUS &&
    p.is_public === true &&
    p.is_banned !== true &&
    p.is_frozen !== true
  );
}
