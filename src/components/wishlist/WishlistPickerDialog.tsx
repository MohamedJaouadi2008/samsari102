import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, Plus, FolderHeart, Loader2 } from "lucide-react";
import { useWishlists } from "@/hooks/useWishlists";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WishlistPickerDialogProps {
  propertyId: string;
  trigger?: React.ReactNode;
}

const WishlistPickerDialog = ({ propertyId, trigger }: WishlistPickerDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    collections,
    addToCollection,
    removeFromCollection,
    createCollection,
    collectionsForProperty,
    isInAnyCollection,
  } = useWishlists();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const isSaved = isInAnyCollection(propertyId);
  const selected = collectionsForProperty(propertyId);

  const handleToggle = async (collectionId: string, checked: boolean) => {
    setWorking(collectionId);
    try {
      if (checked) {
        await addToCollection(collectionId, propertyId);
      } else {
        await removeFromCollection(collectionId, propertyId);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const col = await createCollection(newName.trim());
      await addToCollection(col.id, propertyId);
      setNewName("");
      toast({ title: "Created", description: `Added to "${col.name}"` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toast({ title: "Sign in to save properties", variant: "destructive" });
        }}
      >
        <Heart className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {trigger || (
          <Button variant="ghost" size="icon" aria-label="Save to wishlist">
            <Heart className={cn("h-4 w-4", isSaved ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderHeart className="h-5 w-5 text-primary" />
            Save to wishlist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {collections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No wishlists yet. Create your first one below.
            </p>
          )}
          {collections.map((c) => {
            const checked = selected.has(c.id);
            return (
              <label
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={checked}
                    disabled={working === c.id}
                    onCheckedChange={(v) => handleToggle(c.id, v === true)}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.item_count} {c.item_count === 1 ? "property" : "properties"}
                      {c.is_public && " • Public"}
                    </p>
                  </div>
                </div>
                {working === c.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </label>
            );
          })}
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">Create new wishlist</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Summer 2026"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={80}
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || creating} size="icon">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WishlistPickerDialog;
