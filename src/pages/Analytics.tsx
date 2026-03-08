import { useProducts, useDeals, useAllComparisons } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Analytics() {
  const { data: products } = useProducts();
  const { data: deals } = useDeals();

  const platformCounts = (products || []).reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const platformData = Object.entries(platformCounts).map(([name, value]) => ({ name, value }));

  const statusCounts = (deals || []).reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Deals per day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });

  const dealsPerDay = last7Days.map((day) => ({
    day: day.slice(5),
    deals: (deals || []).filter((d) => d.detected_at.startsWith(day)).length,
  }));

  const avgDiscount = deals?.length
    ? Math.round((deals.reduce((s, d) => s + d.discount_percent, 0) / deals.length))
    : 0;

  const avgAiScore = deals?.length
    ? Math.round((deals.reduce((s, d) => s + ((d as any).ai_score || 0), 0) / deals.length))
    : 0;

  const autoPosted = (deals || []).filter(d => d.status === "posted" && (d as any).ai_score >= 80).length;
  const fakeRejected = (deals || []).filter(d => d.status === "rejected" && (d as any).ai_score === 0).length;

  const COLORS = ["hsl(145,80%,42%)", "hsl(38,92%,55%)", "hsl(0,72%,55%)", "hsl(220,14%,40%)"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold font-mono">{products?.length || 0}</p>
        </Card>
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Total Deals</p>
          <p className="text-2xl font-bold font-mono">{deals?.length || 0}</p>
        </Card>
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Avg Discount</p>
          <p className="text-2xl font-bold font-mono text-primary">{avgDiscount}%</p>
        </Card>
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Avg AI Score</p>
          <p className="text-2xl font-bold font-mono text-accent">{avgAiScore}/100</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Auto-Posted</p>
          <p className="text-2xl font-bold font-mono text-primary">{autoPosted}</p>
        </Card>
        <Card className="p-4 gradient-deal">
          <p className="text-xs text-muted-foreground">Fake Discounts Rejected</p>
          <p className="text-2xl font-bold font-mono text-destructive">{fakeRejected}</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Deals per Day (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dealsPerDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220,18%,10%)",
                  border: "1px solid hsl(220,14%,18%)",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="deals" fill="hsl(145,80%,42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Products by Platform</h3>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {platformData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No data</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Deals by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220,18%,10%)",
                    border: "1px solid hsl(220,14%,18%)",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(38,92%,55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No data</p>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Products Discovered per Platform</h3>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={platformData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215,12%,52%)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220,18%,10%)",
                    border: "1px solid hsl(220,14%,18%)",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {platformData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No data</p>
          )}
        </Card>
      </div>
    </div>
  );
}
