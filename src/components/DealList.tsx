import { useDeals, useUpdateDealStatus, usePostToTelegram, type Deal, type Product } from "@/hooks/use-deals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Send, ArrowDown } from "lucide-react";
import { toast } from "sonner";

function statusColor(status: string) {
  switch (status) {
    case "approved": return "bg-primary/20 text-primary border-primary/30";
    case "rejected": return "bg-destructive/20 text-destructive border-destructive/30";
    case "posted": return "bg-accent/20 text-accent border-accent/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function aiScoreColor(score: number | null) {
  if (!score) return "text-muted-foreground border-muted";
  if (score >= 80) return "text-primary border-primary/30 bg-primary/10";
  if (score >= 60) return "text-accent border-accent/30 bg-accent/10";
  return "text-destructive border-destructive/30 bg-destructive/10";
}

export function DealList() {
  const { data: deals, isLoading } = useDeals();
  const updateStatus = useUpdateDealStatus();
  const postToTelegram = usePostToTelegram();

  const handleApprove = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: "approved" });
    toast.success("Deal approved");
  };

  const handleReject = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: "rejected" });
    toast.info("Deal rejected");
  };

  const handlePost = async (deal: Deal & { products: Product }) => {
    try {
      await postToTelegram.mutateAsync(deal);
      await updateStatus.mutateAsync({ id: deal.id, status: "posted" });
      toast.success("Posted to Telegram!");
    } catch {
      toast.error("Failed to post. Check Telegram bot config.");
    }
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading deals...</div>;
  if (!deals?.length) return <div className="text-muted-foreground text-sm">No deals detected yet.</div>;

  return (
    <div className="space-y-3">
      {deals.map((deal) => {
        const dealScore = (deal as any).deal_score || 0;
        return (
          <Card key={deal.id} className="p-4 gradient-deal">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 flex-1 min-w-0">
                {deal.products?.image_url && (
                  <img
                    src={deal.products.image_url}
                    alt={deal.products?.name}
                    className="h-14 w-14 rounded-md object-cover shrink-0 bg-muted"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-medium text-sm truncate">{deal.products?.name || "Unknown"}</h3>
                    <Badge className={`text-xs ${statusColor(deal.status)}`}>{deal.status}</Badge>
                    {dealScore > 0 && (
                      <Badge variant="outline" className={`text-xs font-mono ${scoreColor(dealScore)}`}>
                        Score: {dealScore}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-sm">
                    <span className="text-muted-foreground line-through">₹{deal.old_price.toLocaleString()}</span>
                    <ArrowDown className="h-3 w-3 text-primary" />
                    <span className="text-primary font-bold">₹{deal.new_price.toLocaleString()}</span>
                    <Badge variant="secondary" className="font-mono text-primary">
                      -{deal.discount_percent}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(deal.detected_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {deal.status === "pending" && (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleApprove(deal.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleReject(deal.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {deal.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => handlePost(deal)} disabled={postToTelegram.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Post
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
