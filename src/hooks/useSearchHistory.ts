import { supabase } from "@/integrations/supabase/client";

export interface SearchEntry {
  governorate?: string;
  city?: string;
  property_type?: string;
  num_guests?: number;
  check_in?: string;
  check_out?: string;
}

const RECENT_KEY = "samsari_recent_searches";
const MAX_RECENT = 8;

/**
 * Records a search to localStorage (always) + Supabase (if logged in).
 */
export async function recordSearch(entry: SearchEntry) {
  // Local
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: SearchEntry[] = raw ? JSON.parse(raw) : [];
    const dedup = list.filter(
      (e) =>
        !(
          e.governorate === entry.governorate &&
          e.city === entry.city &&
          e.property_type === entry.property_type
        )
    );
    dedup.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(dedup.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota errors
  }

  // Remote (best-effort, only if any meaningful field)
  if (!entry.governorate && !entry.city && !entry.property_type) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;

  await supabase.from("user_search_history").insert({
    user_id: auth.user.id,
    governorate: entry.governorate || null,
    city: entry.city || null,
    property_type: entry.property_type || null,
    num_guests: entry.num_guests || null,
    check_in: entry.check_in || null,
    check_out: entry.check_out || null,
  });
}

export function getRecentSearches(): SearchEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
