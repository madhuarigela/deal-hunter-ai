import { useProducts, useDeals } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { Package, Zap, CheckCircle, Send } from "lucide-react";

export function StatsCards() {
  const { data: products } = useProducts();
  const { data: deals } = useDeals();

  const totalProducts = products?.length || 0;
  const totalDeals = deals?.length || 0;
  const approvedDeals = deals?.filter((d) => d.status === "approved").length || 0;
  const postedDeals = deals?.filter((d) => d.status === "posted").length || 0;

  const stats = [
    { label: "Products Tracked", value: totalProducts, icon: Package, color: "text-primary" },
    { label: "Deals Detected", value: totalDeals, icon: Zap, color: "text-accent" },
    { label: "Approved", value: approvedDeals, icon: CheckCircle, color: "text-primary" },
    { label: "Posted", value: postedDeals, icon: Send, color: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 gradient-deal">
          <div className="flex items-center gap-3">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold font-mono">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
