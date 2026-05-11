import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, Trash2, Sparkles, Search } from "lucide-react";

type Property = {
  id: string;
  title: string;
  city: string;
  governorate: string;
  price_per_night: number;
};

const COUNT_OPTIONS = [4, 8, 12, 16, 20, 24];

export default function DailyPicksManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [date, setDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [count, setCount] = useState<string>("8");
  const [search, setSearch] = useState("");
  const [allProps, setAllProps] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Load eligible properties
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, title, city, governorate, price_per_night")
        .eq("status", "published")
        .eq("is_public", true)
        .eq("is_banned", false)
        .eq("is_frozen", false)
        .order("created_at", { ascending: false })
        .limit(500);
      setAllProps((data as Property[]) || []);
    })();
  }, []);

  // Load existing override for selected date
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_picks_override")
        .select("id, property_ids, count")
        .eq("pick_date", date)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setCount(String(data.count ?? (data.property_ids as any[])?.length ?? 8));
        setSelected(new Set(((data.property_ids as any[]) || []) as string[]));
      } else {
        setExistingId(null);
        setSelected(new Set());
      }
      setLoading(false);
    })();
  }, [date]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return allProps;
    return allProps.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.city.toLowerCase().includes(s) ||
        p.governorate.toLowerCase().includes(s)
    );
  }, [allProps, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoPick = async () => {
    const target = parseInt(count, 10) || 8;
    // pick top-N most recent eligible props as a starting point
    const ids = allProps.slice(0, target).map((p) => p.id);
    setSelected(new Set(ids));
    toast({ title: "Auto-picked", description: `${ids.length} properties selected. Review then save.` });
  };

  const save = async () => {
    if (selected.size === 0) {
      toast({ title: "No properties selected", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      pick_date: date,
      property_ids: Array.from(selected),
      count: parseInt(count, 10) || selected.size,
      set_by: user?.id,
      set_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("admin_picks_override")
      .upsert(payload, { onConflict: "pick_date" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `Picks for ${date} saved (${selected.size} properties).` });
    }
  };

  const clearOverride = async () => {
    if (!existingId) return;
    setSaving(true);
    const { error } = await supabase.from("admin_picks_override").delete().eq("id", existingId);
    setSaving(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cleared", description: "Auto-pick will resume for this date." });
      setExistingId(null);
      setSelected(new Set());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Daily Picks Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Pick date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Count</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNT_OPTIONS.map((c) => (
                  <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={autoPick} className="flex-1">
              <Sparkles className="w-4 h-4 mr-2" /> Auto-pick
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {existingId ? (
              <Badge variant="secondary">Override active</Badge>
            ) : (
              <Badge variant="outline">No override · auto picks will run</Badge>
            )}
            <span className="ml-3">{selected.size} selected</span>
          </div>
          <div className="flex gap-2">
            {existingId && (
              <Button variant="destructive" size="sm" onClick={clearOverride} disabled={saving}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear override
              </Button>
            )}
            <Button onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, city, governorate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[420px] border rounded-md p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.city}, {p.governorate} · {p.price_per_night} TND
                    </div>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No properties match.
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
