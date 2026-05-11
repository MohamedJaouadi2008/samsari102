import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Trash2, Bookmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  currentFilters: Record<string, any>;
}

const SavedSearchesPanel = ({ currentFilters }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { searches, createSearch, toggleAlerts, deleteSearch } = useSavedSearches();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const handleSave = async () => {
    if (!name.trim()) return;
    const ok = await createSearch(name.trim(), currentFilters, alertsEnabled);
    if (ok) {
      setName("");
      setOpen(false);
    }
  };

  const applySearch = (filters: Record<string, any>) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        params.set(k, Array.isArray(v) ? v.join(",") : String(v));
      }
    });
    navigate(`/search?${params.toString()}`);
  };

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" /> Save this search
      </Button>

      {searches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {searches.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm"
            >
              <button
                onClick={() => applySearch(s.filters)}
                className="flex items-center gap-1 hover:text-primary"
                title="Apply this search"
              >
                <Bookmark className="w-3 h-3" />
                {s.name}
              </button>
              <button
                onClick={() => toggleAlerts(s.id, !s.alerts_enabled)}
                title={s.alerts_enabled ? "Disable alerts" : "Enable alerts"}
                className="ml-1 hover:text-primary"
              >
                {s.alerts_enabled ? (
                  <Bell className="w-3 h-3" />
                ) : (
                  <BellOff className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => deleteSearch(s.id)}
                title="Delete"
                className="hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>
              Get instant in-app & email alerts when new properties match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Djerba villas under 300 TND"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable alerts</p>
                <p className="text-xs text-muted-foreground">
                  Email + in-app notifications on new matches
                </p>
              </div>
              <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedSearchesPanel;
