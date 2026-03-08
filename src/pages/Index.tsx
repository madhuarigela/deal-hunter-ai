import { StatsCards } from "@/components/StatsCards";
import { DealList } from "@/components/DealList";
import { AddDealDialog } from "@/components/AddDealDialog";

const Index = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <AddDealDialog />
      </div>

      <StatsCards />

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recent Deals
        </h2>
        <DealList />
      </section>
    </div>
  );
};

export default Index;
