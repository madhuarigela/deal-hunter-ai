import { useProducts, useDeleteProduct, type Product } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ProductList({ onSelect }: { onSelect: (p: Product) => void }) {
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading products...</div>;
  if (!products?.length) return <div className="text-muted-foreground text-sm">No products tracked yet. Add one to get started.</div>;

  return (
    <div className="space-y-3">
      {products.map((p) => (
        <Card
          key={p.id}
          className="p-4 cursor-pointer hover:border-primary/50 transition-colors gradient-deal"
          onClick={() => onSelect(p)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm truncate">{p.name}</h3>
                <Badge variant="secondary" className="text-xs font-mono shrink-0">
                  {p.platform}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {p.current_price != null && (
                  <span className="font-mono text-primary font-semibold">₹{p.current_price.toLocaleString()}</span>
                )}
                {p.original_price != null && (
                  <span className="font-mono line-through">₹{p.original_price.toLocaleString()}</span>
                )}
                {p.is_tracking && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-green" />
                    Tracking
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(p.url, "_blank"); }}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
