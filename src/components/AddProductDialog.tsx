import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAddProduct } from "@/hooks/use-deals";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddProductDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<string>("amazon");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const addProduct = useAddProduct();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addProduct.mutateAsync({
        name,
        url,
        platform,
        affiliate_link: affiliateLink || null,
        current_price: currentPrice ? Number(currentPrice) : null,
        original_price: originalPrice ? Number(originalPrice) : null,
      } as any);
      toast.success("Product added successfully");
      setOpen(false);
      setName("");
      setUrl("");
      setAffiliateLink("");
      setCurrentPrice("");
      setOriginalPrice("");
    } catch {
      toast.error("Failed to add product");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product to Track</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Product URL" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <Input placeholder="Affiliate link (optional)" value={affiliateLink} onChange={(e) => setAffiliateLink(e.target.value)} />
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="flipkart">Flipkart</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Current price" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
            <Input type="number" placeholder="Original price" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={addProduct.isPending}>
            {addProduct.isPending ? "Adding..." : "Add Product"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
