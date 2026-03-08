import { useProducts, useDeleteProduct, useUpdateProduct } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { AddProductDialog } from "@/components/AddProductDialog";
import { useNavigate } from "react-router-dom";

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const navigate = useNavigate();

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
        <h1 className="text-2xl font-bold">Products</h1>
        <AddProductDialog />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading products...</p>}
      {!isLoading && !products?.length && (
        <p className="text-muted-foreground text-sm">No products tracked yet. Add one to get started.</p>
      )}

      <div className="grid gap-3">
        {products?.map((p) => (
          <Card key={p.id} className="p-4 gradient-deal">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{p.name}</h3>
                  <Badge variant="secondary" className="text-xs font-mono shrink-0">
                    {p.platform}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {p.current_price != null && (
                    <span className="font-mono text-primary font-semibold">₹{p.current_price.toLocaleString()}</span>
                  )}
                  {p.original_price != null && (
                    <span className="font-mono line-through">₹{p.original_price.toLocaleString()}</span>
                  )}
                  {(p as any).affiliate_link && (
                    <span className="text-xs text-accent">Has affiliate link</span>
                  )}
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
    </div>
  );
}
