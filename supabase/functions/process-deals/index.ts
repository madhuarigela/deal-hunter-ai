import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calculateAiScore(
  discountPercent: number,
  currentPrice: number,
  avgPrice30d: number,
  lowestPrice30d: number
): number {
  const discountScore = Math.min(discountPercent, 100) * 0.4;

  const avgDiff = avgPrice30d > 0 ? ((avgPrice30d - currentPrice) / avgPrice30d) * 100 : 0;
  const avgScore = Math.min(Math.max(avgDiff, 0), 100) * 0.3;

  const historicLowBonus = currentPrice < lowestPrice30d ? 30 : 0;

  return Math.round(Math.min(Math.max(discountScore + avgScore + historicLowBonus, 0), 100));
}

function generateTelegramMessage(
  productName: string,
  oldPrice: number,
  newPrice: number,
  discountPercent: number,
  affiliateLink: string
): string {
  return `🔥 *HOT DEAL*

📦 *${productName}*

~~₹${oldPrice?.toLocaleString()}~~ → *₹${newPrice?.toLocaleString()}*

💰 *${discountPercent}% OFF*

👉 [Buy Now](${affiliateLink})`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending deals
    const { data: deals, error: dealsErr } = await supabase
      .from("deals")
      .select("*, products(*)")
      .eq("status", "pending")
      .is("ai_processed_at", null);

    if (dealsErr) throw dealsErr;
    if (!deals?.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending deals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const results: any[] = [];

    for (const deal of deals) {
      const product = deal.products;
      if (!product) continue;

      const currentPrice = deal.new_price;

      // Get 30-day price history
      const { data: history } = await supabase
        .from("price_history")
        .select("price")
        .eq("product_id", deal.product_id)
        .gte("recorded_at", thirtyDaysAgo);

      const prices = (history || []).map((h: any) => h.price);
      const avgPrice30d = prices.length > 0
        ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length
        : deal.old_price;
      const lowestPrice30d = prices.length > 0 ? Math.min(...prices) : deal.old_price;

      // FAKE DISCOUNT FILTER: reject if current price > 90% of avg
      if (currentPrice > avgPrice30d * 0.9) {
        await supabase.from("deals").update({
          status: "rejected",
          ai_score: 0,
          ai_processed_at: new Date().toISOString(),
          telegram_message: null,
        }).eq("id", deal.id);

        results.push({ product: product.name, action: "rejected_fake", ai_score: 0 });
        continue;
      }

      const discountPercent = deal.discount_percent;
      const aiScore = calculateAiScore(discountPercent, currentPrice, avgPrice30d, lowestPrice30d);

      const affiliateLink = product.affiliate_link || product.url;
      const telegramMessage = generateTelegramMessage(
        product.name,
        deal.old_price,
        deal.new_price,
        discountPercent,
        affiliateLink
      );

      let newStatus: string;
      if (aiScore >= 80) {
        newStatus = "approved";
      } else if (aiScore >= 60) {
        newStatus = "pending"; // keep for admin review
      } else {
        newStatus = "rejected";
      }

      await supabase.from("deals").update({
        ai_score: aiScore,
        telegram_message: telegramMessage,
        ai_processed_at: new Date().toISOString(),
        status: newStatus,
      }).eq("id", deal.id);

      // Auto-post high-scoring deals
      if (aiScore >= 80) {
        try {
          const postResponse = await fetch(`${supabaseUrl}/functions/v1/post-to-telegram`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              telegramMessage,
              productName: product.name,
              oldPrice: deal.old_price,
              newPrice: deal.new_price,
              discountPercent,
              buyLink: affiliateLink,
              imageUrl: product.image_url,
            }),
          });

          if (postResponse.ok) {
            await supabase.from("deals").update({
              status: "posted",
              posted_at: new Date().toISOString(),
            }).eq("id", deal.id);
            newStatus = "posted";
          }
        } catch (e) {
          console.error("Auto-post failed for deal", deal.id, e);
        }
      }

      results.push({ product: product.name, action: newStatus, ai_score: aiScore });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
