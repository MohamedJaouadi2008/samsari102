import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RefreshCw, Copy, Calendar, Link as LinkIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarSyncProps {
  propertyId: string;
}

interface Feed {
  id: string;
  property_id: string;
  host_id: string;
  feed_url: string;
  feed_name: string | null;
  provider: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  events_imported: number | null;
  export_token: string;
}

const PROVIDERS = [
  { value: "airbnb", label: "Airbnb" },
  { value: "booking", label: "Booking.com" },
  { value: "vrbo", label: "Vrbo" },
  { value: "other", label: "Other (.ics)" },
];

const CalendarSync = ({ propertyId }: CalendarSyncProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState("airbnb");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const supabaseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("property_calendar_feeds")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: t('cal.load_fail'), description: error.message, variant: "destructive" });
    } else {
      setFeeds((data ?? []) as Feed[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const addFeed = async () => {
    if (!newUrl.trim()) {
      toast({ title: t('cal.feed_required'), variant: "destructive" });
      return;
    }
    setAdding(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: t('cal.not_auth'), variant: "destructive" });
      setAdding(false);
      return;
    }
    const { error } = await supabase.from("property_calendar_feeds").insert({
      property_id: propertyId,
      host_id: userData.user.id,
      feed_url: newUrl.trim(),
      feed_name: newName.trim() || null,
      provider: newProvider,
      enabled: true,
    });
    setAdding(false);
    if (error) {
      toast({ title: t('cal.add_fail'), description: error.message, variant: "destructive" });
      return;
    }
    setNewUrl("");
    setNewName("");
    toast({ title: t('cal.added_ok'), description: t('cal.added_ok_desc') });
    load();
  };

  const syncFeed = async (feedId: string) => {
    setSyncing(feedId);
    const { data, error } = await supabase.functions.invoke("ical-import", {
      body: { feed_id: feedId },
    });
    setSyncing(null);
    if (error) {
      toast({ title: t('cal.sync_failed'), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t('cal.sync_complete'), description: t('cal.sync_complete_desc') });
    load();
  };

  const toggleFeed = async (feed: Feed) => {
    const { error } = await supabase
      .from("property_calendar_feeds")
      .update({ enabled: !feed.enabled })
      .eq("id", feed.id);
    if (error) {
      toast({ title: t('cal.update_fail'), description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const deleteFeed = async (feedId: string) => {
    if (!confirm(t('cal.delete_confirm'))) return;
    await supabase.from("external_blocked_dates").delete().eq("feed_id", feedId);
    const { error } = await supabase.from("property_calendar_feeds").delete().eq("id", feedId);
    if (error) {
      toast({ title: t('cal.delete_fail'), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t('cal.deleted') });
    load();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('cal.copied', { label }) });
  };

  const exportToken = feeds[0]?.export_token;
  const propertyExportUrl = exportToken
    ? `${supabaseUrl}/functions/v1/ical-export?property_id=${propertyId}&token=${exportToken}`
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('cal.import_title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('cal.import_desc')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cal-provider">{t('cal.provider')}</Label>
              <Select value={newProvider} onValueChange={setNewProvider}>
                <SelectTrigger id="cal-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cal-name">{t('cal.name_optional')}</Label>
              <Input
                id="cal-name"
                placeholder={t('cal.name_ph')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="cal-url">{t('cal.url_label')}</Label>
            <Input
              id="cal-url"
              placeholder={t('cal.url_ph')}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <Button onClick={addFeed} disabled={adding}>
            {adding ? t('cal.adding') : t('cal.add')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('cal.connected')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('cal.loading')}</p>
          ) : feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('cal.none_connected')}</p>
          ) : (
            <div className="space-y-3">
              {feeds.map((feed) => (
                <div key={feed.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {feed.feed_name || PROVIDERS.find((p) => p.value === feed.provider)?.label}
                        </span>
                        <Badge variant={feed.enabled ? "default" : "secondary"}>
                          {feed.enabled ? t('cal.enabled') : t('cal.disabled')}
                        </Badge>
                        {feed.last_sync_status === "success" && (
                          <Badge variant="outline" className="text-green-600">
                            {t('cal.synced')}
                          </Badge>
                        )}
                        {feed.last_sync_status === "error" && (
                          <Badge variant="destructive">{t('cal.sync_error')}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">{feed.feed_url}</p>
                      {feed.last_synced_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('cal.last_synced', { date: new Date(feed.last_synced_at).toLocaleString(), count: feed.events_imported ?? 0 })}
                        </p>
                      )}
                      {feed.last_sync_error && (
                        <p className="text-xs text-destructive mt-1">{feed.last_sync_error}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncFeed(feed.id)}
                        disabled={syncing === feed.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing === feed.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleFeed(feed)}>
                        {feed.enabled ? t('cal.disable') : t('cal.enable')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteFeed(feed.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            {t('cal.export_title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('cal.export_desc')}
          </p>
        </CardHeader>
        <CardContent>
          {propertyExportUrl ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={propertyExportUrl} className="font-mono text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(propertyExportUrl, t('cal.export_url'))}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('cal.export_empty')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarSync;
