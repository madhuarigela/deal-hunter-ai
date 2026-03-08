import { DealList } from "@/components/DealList";
import { AddDealDialog } from "@/components/AddDealDialog";

export default function Deals() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deals</h1>
        <AddDealDialog />
      </div>
      <DealList />
    </div>
  );
}
