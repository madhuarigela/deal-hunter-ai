import { useState } from "react";
import { StatsCards } from "@/components/StatsCards";
import { ProductList } from "@/components/ProductList";
import { DealList } from "@/components/DealList";
import { PriceChart } from "@/components/PriceChart";
import { AddProductDialog } from "@/components/AddProductDialog";
import { AddDealDialog } from "@/components/AddDealDialog";
import type { Product } from "@/hooks/use-deals";
import { Zap } from "lucide-react";

const Index = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center glow-green">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">DealHunter AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <AddProductDialog />
            <AddDealDialog />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <StatsCards />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Products */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Tracked Products
            </h2>
            <ProductList onSelect={setSelectedProduct} />
          </section>

          {/* Deals */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Detected Deals
            </h2>
            <DealList />
          </section>
        </div>

        {/* Price Chart */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Price History
          </h2>
          <PriceChart product={selectedProduct} />
        </section>
      </main>
    </div>
  );
};

export default Index;
