import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Clock, Building2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { tunisianCities, getAllGovernorates } from "@/components/TunisianCities";
import { supabase } from "@/integrations/supabase/client";
import { getRecentSearches, type SearchEntry } from "@/hooks/useSearchHistory";
import { cn } from "@/lib/utils";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";

export interface AutocompleteSelection {
  type: "governorate" | "city" | "property" | "recent";
  governorate?: string;
  city?: string;
  propertyId?: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (sel: AutocompleteSelection) => void;
  placeholder?: string;
  id?: string;
}

interface PropertySuggestion {
  id: string;
  title: string;
  city: string;
  governorate: string;
}

const SearchAutocomplete = ({ value, onChange, onSelect, placeholder, id }: Props) => {
  const [open, setOpen] = useState(false);
  const [propertyMatches, setPropertyMatches] = useState<PropertySuggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // All locations (governorate + city pairs)
  const allLocations = useMemo(() => {
    const list: { governorate: string; city?: string; label: string }[] = [];
    getAllGovernorates().forEach((g) => list.push({ governorate: g, label: g }));
    tunisianCities.forEach((g) => {
      g.cities.forEach((c) => list.push({ governorate: g.governorate, city: c, label: `${c}, ${g.governorate}` }));
    });
    return list;
  }, []);

  const recentSearches = useMemo<SearchEntry[]>(() => getRecentSearches(), [open]);

  const locationMatches = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return allLocations
      .filter((l) => l.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [value, allLocations]);

  // Debounced property title search
  useEffect(() => {
    if (!value.trim() || value.trim().length < 2) {
      setPropertyMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await applyPublicPropertyFilter(
        supabase
          .from("properties")
          .select("id, title, city, governorate")
          .ilike("title", `%${value.trim()}%`)
      ).limit(4);
      setPropertyMatches(data || []);
    }, 250);
    return () => clearTimeout(handle);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showRecent = open && !value.trim() && recentSearches.length > 0;
  const showResults = open && value.trim().length > 0 && (locationMatches.length > 0 || propertyMatches.length > 0);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || "Search city, region or property"}
          className="h-11 pl-9 bg-muted/40 border-border/50 hover:border-primary/30 transition-colors"
          autoComplete="off"
        />
      </div>

      {(showRecent || showResults) && (
        <div className="absolute z-50 mt-1.5 w-full bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {showRecent && (
            <div className="p-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Recent searches
              </div>
              {recentSearches.slice(0, 5).map((r, i) => {
                const label = r.city ? `${r.city}, ${r.governorate}` : r.governorate || "Search";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onSelect({
                        type: "recent",
                        governorate: r.governorate,
                        city: r.city,
                        label,
                      });
                      onChange(label);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {showResults && locationMatches.length > 0 && (
            <div className="p-1 border-t border-border first:border-t-0">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Locations
              </div>
              {locationMatches.map((l, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSelect({
                      type: l.city ? "city" : "governorate",
                      governorate: l.governorate,
                      city: l.city,
                      label: l.label,
                    });
                    onChange(l.label);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{l.label}</span>
                </button>
              ))}
            </div>
          )}

          {showResults && propertyMatches.length > 0 && (
            <div className="p-1 border-t border-border">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Properties
              </div>
              {propertyMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      type: "property",
                      propertyId: p.id,
                      label: p.title,
                    });
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left"
                >
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.city}, {p.governorate}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
