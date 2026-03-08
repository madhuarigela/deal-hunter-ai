import { useParams, useNavigate } from "react-router-dom";
import { useProduct, usePriceHistory, useDeals } from "@/hooks/use-deals";
import { PriceChart } from "@/components/PriceChart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id);
  const { data: deals } = useDeals();

  const productDeals = deals?.filter((d) => d.product_id === id) || [];

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!product) return <p className="text-muted-foreground">Product not found.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/products")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
      </Button>

      <Card className="p-6 gradient-deal">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold">{product.name}</h1>
              <Badge variant="secondary" className="font-mono">{product.platform}</Badge>
              {product.is_tracking && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-green mr-1" />
                  Tracking
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {product.current_price != null && (
                <span className="font-mono text-primary font-bold text-lg">₹{product.current_price.toLocaleString()}</span>
              )}
              {product.original_price != null && (
                <span className="font-mono line-through">₹{product.original_price.toLocaleString()}</span>
              )}
            </div>
            {(product as any).affiliate_link && (
              <p className="text-xs text-accent mt-2">Affiliate link configured</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Added {new Date(product.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open(product.url, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Visit
          </Button>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Price History
        </h2>
        <PriceChart product={product} />
      </section>

      {productDeals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Deals for this Product ({productDeals.length})
          </h2>
          <div className="space-y-2">
            {productDeals.map((d) => (
              <Card key={d.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className="line-through text-muted-foreground">₹{d.old_price.toLocaleString()}</span>
                  <span className="text-primary font-bold">₹{d.new_price.toLocaleString()}</span>
                  <Badge variant="secondary" className="font-mono text-primary">-{d.discount_percent}%</Badge>
                </div>
                <Badge className={
                  d.status === "posted" ? "bg-accent/20 text-accent" :
                  d.status === "approved" ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }>{d.status}</Badge>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
