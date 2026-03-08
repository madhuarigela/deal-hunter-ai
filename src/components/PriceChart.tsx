import { usePriceHistory, type Product } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export function PriceChart({ product }: { product: Product | null }) {
  const { data: history } = usePriceHistory(product?.id || null);

  if (!product) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Select a product to view price history</p>
      </Card>
    );
  }

  if (!history?.length) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">No price history for {product.name}</p>
      </Card>
    );
  }

  const chartData = history.map((h) => ({
    date: format(new Date(h.recorded_at), "MMM dd"),
    price: h.price,
  }));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3">{product.name} — Price History</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 12% 52%)" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(215 12% 52%)" }} />
          <Tooltip
            contentStyle={{
              background: "hsl(220 18% 10%)",
              border: "1px solid hsl(220 14% 18%)",
              borderRadius: "6px",
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="price" stroke="hsl(145 80% 42%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
