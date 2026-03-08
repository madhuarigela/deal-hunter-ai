import { useState } from "react";
import { useProducts, useDeleteProduct, useUpdateProduct } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ExternalLink, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AddProductDialog } from "@/components/AddProductDialog";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 20;

const PLATFORMS = ["all", "amazon", "flipkart", "croma", "reliance", "myntra", "ajio", "other"] as const;

function platformBadgeClass(platform: string) {
  switch (platform) {
    case "amazon": return "bg-[hsl(38,92%,55%)]/20 text-[hsl(38,92%,55%)] border-[hsl(38,92%,55%)]/30";
    case "flipkart": return "bg-[hsl(210,80%,55%)]/20 text-[hsl(210,80%,55%)] border-[hsl(210,80%,55%)]/30";
    case "croma": return "bg-primary/20 text-primary border-primary/30";
    case "reliance": return "bg-[hsl(0,72%,55%)]/20 text-[hsl(0,72%,55%)] border-[hsl(0,72%,55%)]/30";
    case "myntra": return "bg-[hsl(330,70%,55%)]/20 text-[hsl(330,70%,55%)] border-[hsl(330,70%,55%)]/30";
    case "ajio": return "bg-[hsl(270,60%,55%)]/20 text-[hsl(270,60%,55%)] border-[hsl(270,60%,55%)]/30";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const filtered = platformFilter === "all"
    ? products
    : products?.filter((p) => p.platform === platformFilter);

  const totalPages = Math.ceil((filtered?.length || 0) / PAGE_SIZE);
  const paginated = filtered?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || [];

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleToggleTracking = async (id: string, current: boolean) => {
    try {
      await updateProduct.mutateAsync({ id, is_tracking: !current });
      toast.success(!current ? "Tracking enabled" : "Tracking disabled");
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{filtered?.length || 0} products {platformFilter !== "all" ? `(${platformFilter})` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs capitalize">{p === "all" ? "All Platforms" : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddProductDialog />
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading products...</p>}
      {!isLoading && !filtered?.length && (
        <p className="text-muted-foreground text-sm">No products found. Add one or run the discovery worker.</p>
      )}

      <div className="grid gap-3">
        {paginated.map((p) => (
          <Card key={p.id} className="p-4 gradient-deal">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium truncate text-sm">{p.name}</h3>
                    <Badge variant="outline" className={`text-xs font-mono shrink-0 capitalize ${platformBadgeClass(p.platform)}`}>
                      {p.platform}
                    </Badge>
                    {(p as any).category && (
                      <Badge variant="secondary" className="text-xs shrink-0">{(p as any).category}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {p.current_price != null && (
                      <span className="font-mono text-primary font-semibold">₹{p.current_price.toLocaleString()}</span>
                    )}
                    {(p as any).affiliate_link && (
                      <span className="text-xs text-accent">Affiliate ✓</span>
                    )}
                    {(p as any).last_checked_at && (
                      <span className="text-xs">Checked {new Date((p as any).last_checked_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Track</span>
                  <Switch
                    checked={p.is_tracking}
                    onCheckedChange={() => handleToggleTracking(p.id, p.is_tracking)}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/products/${p.id}`)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(p.url, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
