import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/useCurrency";
import { ArrowLeft, FolderHeart, MapPin, Trash2, Share2, Globe, Lock, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Item {
  id: string;
  property_id: string;
  notes: string | null;
  added_at: string;
  property: any;
}

const WishlistDetail = ({ shared = false }: { shared?: boolean }) => {
  const { id, token } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = !shared && user && collection && collection.user_id === user.id;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = supabase.from("wishlist_collections").select("*");
        const { data: col, error } = shared
          ? await query.eq("share_token", token!).maybeSingle()
          : await query.eq("id", id!).maybeSingle();
        if (error) throw error;
        if (!col) { setLoading(false); return; }
        if (shared && !col.is_public && (!user || user.id !== col.user_id)) {
          setCollection(null); setLoading(false); return;
        }
        setCollection(col);

        const { data: its } = await supabase
          .from("wishlist_items")
          .select("id, property_id, notes, added_at")
          .eq("collection_id", col.id)
          .order("added_at", { ascending: false });

        const propIds = (its || []).map((i) => i.property_id);
        if (propIds.length === 0) { setItems([]); setLoading(false); return; }
        const { data: props } = await supabase
          .from("properties")
          .select("id, title, city, governorate, photos, price_per_night, short_code, currency, bedrooms, bathrooms, max_guests")
          .in("id", propIds);
        const propMap = new Map((props || []).map((p) => [p.id, p]));
        setItems(
          (its || []).map((i) => ({ ...i, property: propMap.get(i.property_id) })).filter((i) => i.property)
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token, shared, user]);

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", itemId);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: "destructive" }); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const togglePublic = async (v: boolean) => {
    const { error } = await supabase.from("wishlist_collections").update({ is_public: v }).eq("id", collection.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: "destructive" }); return; }
    setCollection({ ...collection, is_public: v });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/wishlists/shared/${collection.share_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: t('wishlists.link_copied') });
  };

  const getCover = (p: any) => {
    const photos = p.photos || [];
    const exterior = Array.isArray(photos) ? photos.find((ph: any) => ph?.type === "exterior") : null;
    return exterior?.url || photos[0]?.url || "/placeholder.svg";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-2">{t('wishlists.not_found')}</h1>
          <p className="text-muted-foreground mb-4">{t('wishlists.not_found_desc')}</p>
          <Button onClick={() => navigate("/")}>{t('wishlists.go_home')}</Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(isOwner ? "/wishlists" : "/")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
        </Button>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FolderHeart className="h-7 w-7 text-primary" />
              {collection.name}
            </h1>
            {collection.description && <p className="text-muted-foreground mt-1">{collection.description}</p>}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={collection.is_public ? "default" : "secondary"}>
                {collection.is_public ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                {collection.is_public ? t('wishlists.public') : t('wishlists.private')}
              </Badge>
              <span className="text-sm text-muted-foreground">{items.length} {t('wishlists.properties_count')}</span>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={collection.is_public} onCheckedChange={togglePublic} />
                <span className="text-sm">{t('wishlists.public')}</span>
              </div>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Share2 className="h-4 w-4 mr-2" /> {t('wishlists.share_link')}
              </Button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              {t('wishlists.detail_empty')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((it) => (
              <Card key={it.id} className="overflow-hidden group hover:shadow-lg transition">
                <Link to={`/p/${it.property.short_code || it.property.id}`}>
                  <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${getCover(it.property)})` }} />
                </Link>
                <CardContent className="p-4 space-y-2">
                  <Link to={`/p/${it.property.short_code || it.property.id}`}>
                    <h3 className="font-semibold truncate hover:text-primary transition">{it.property.title}</h3>
                  </Link>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {it.property.city}, {it.property.governorate}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-primary">
                      {formatPrice(it.property.price_per_night)}
                      <span className="text-xs font-normal text-muted-foreground"> {t('wishlists.per_night')}</span>
                    </span>
                    {isOwner && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} aria-label={t('wishlists.remove')}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default WishlistDetail;
