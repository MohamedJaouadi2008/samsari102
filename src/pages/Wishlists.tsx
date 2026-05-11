import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlists, type WishlistCollection } from "@/hooks/useWishlists";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FolderHeart, Plus, Pencil, Trash2, Share2, Globe, Lock, Loader2, Heart } from "lucide-react";

const WishlistsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { collections, loading, createCollection, renameCollection, deleteCollection, togglePublic } = useWishlists();
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const load = async () => {
      const ids = collections.map((c) => c.cover_property_id).filter(Boolean) as string[];
      if (ids.length === 0) return;
      const { data } = await supabase.from("properties").select("id, photos").in("id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p) => {
        const photos = (p.photos as any) || [];
        const exterior = Array.isArray(photos) ? photos.find((ph: any) => ph?.type === "exterior") : null;
        const url = exterior?.url || photos[0]?.url;
        if (url) map[p.id] = url;
      });
      setCovers(map);
    };
    load();
  }, [collections]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createCollection(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      setCreateOpen(false);
      toast({ title: t('wishlists.created') });
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyShareLink = (c: WishlistCollection) => {
    const url = `${window.location.origin}/wishlists/shared/${c.share_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: t('wishlists.link_copied'), description: c.is_public ? t('wishlists.link_public_desc') : t('wishlists.link_private_desc') });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FolderHeart className="h-7 w-7 text-primary" />
              {t('wishlists.my_wishlists')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('wishlists.subtitle')}
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> {t('wishlists.new')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('wishlists.create_title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder={t('wishlists.name_placeholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
                <Textarea
                  placeholder={t('wishlists.desc_placeholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('wishlists.create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : collections.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">{t('wishlists.empty')}</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> {t('wishlists.create_first')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                cover={c.cover_property_id ? covers[c.cover_property_id] : undefined}
                onRename={renameCollection}
                onDelete={async (id) => {
                  await deleteCollection(id);
                  toast({ title: t('wishlists.deleted') });
                }}
                onTogglePublic={togglePublic}
                onCopyShare={copyShareLink}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

const CollectionCard = ({
  collection,
  cover,
  onRename,
  onDelete,
  onTogglePublic,
  onCopyShare,
}: {
  collection: WishlistCollection;
  cover?: string;
  onRename: (id: string, name: string, description?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePublic: (id: string, isPublic: boolean) => Promise<void>;
  onCopyShare: (c: WishlistCollection) => void;
}) => {
  const { t } = useLanguage();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [saving, setSaving] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition group">
      <Link to={`/wishlists/${collection.id}`} className="block">
        <div
          className="h-44 bg-muted bg-cover bg-center"
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          {!cover && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <FolderHeart className="h-10 w-10 opacity-40" />
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/wishlists/${collection.id}`} className="min-w-0 flex-1">
            <h3 className="font-semibold truncate group-hover:text-primary transition">{collection.name}</h3>
            {collection.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{collection.description}</p>
            )}
          </Link>
          <Badge variant={collection.is_public ? "default" : "secondary"} className="shrink-0">
            {collection.is_public ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
            {collection.is_public ? t('wishlists.public') : t('wishlists.private')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {collection.item_count} {collection.item_count === 1 ? t('wishlists.property_one') : t('wishlists.property_other')}
        </p>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={collection.is_public}
              onCheckedChange={(v) => onTogglePublic(collection.id, v)}
              aria-label={t('wishlists.toggle_public')}
            />
            <span className="text-xs text-muted-foreground">{t('wishlists.public')}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onCopyShare(collection)} aria-label={t('wishlists.share')}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('wishlists.rename')}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('wishlists.edit_title')}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
                  <Button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onRename(collection.id, name.trim(), description.trim() || undefined);
                        setEditOpen(false);
                      } finally { setSaving(false); }
                    }}
                    disabled={!name.trim() || saving}
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('common.delete')}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('wishlists.delete_title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{collection.name}” {t('wishlists.delete_desc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(collection.id)}>{t('common.delete')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WishlistsPage;
