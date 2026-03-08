import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProducts, useAddDeal } from "@/hooks/use-deals";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export function AddDealDialog() {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const { data: products } = useProducts();
  const addDeal = useAddDeal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const old_p = Number(oldPrice);
    const new_p = Number(newPrice);
    const discount = Math.round(((old_p - new_p) / old_p) * 100);
    try {
      await addDeal.mutateAsync({
        product_id: productId,
        old_price: old_p,
        new_price: new_p,
        discount_percent: discount,
      });
      toast.success("Deal added");
      setOpen(false);
      setOldPrice("");
      setNewPrice("");
    } catch {
      toast.error("Failed to add deal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Zap className="h-4 w-4 mr-1" /> Add Deal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Old price" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} required />
            <Input type="number" placeholder="New price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required />
          </div>
          {oldPrice && newPrice && Number(oldPrice) > Number(newPrice) && (
            <p className="text-sm text-primary font-mono">
              {Math.round(((Number(oldPrice) - Number(newPrice)) / Number(oldPrice)) * 100)}% off
            </p>
          )}
          <Button type="submit" className="w-full" disabled={addDeal.isPending}>
            {addDeal.isPending ? "Adding..." : "Add Deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
