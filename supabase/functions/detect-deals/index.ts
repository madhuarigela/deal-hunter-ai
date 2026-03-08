import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calculateDealScore(
  discountPercent: number,
  currentPrice: number,
  avgPrice30d: number,
  lowestPrice30d: number
): number {
  // Weight: 40% discount, 30% vs average, 30% vs historical low
  const discountScore = Math.min(discountPercent / 50 * 100, 100) * 0.4;

  const avgDiff = avgPrice30d > 0 ? ((avgPrice30d - currentPrice) / avgPrice30d) * 100 : 0;
  const avgScore = Math.min(Math.max(avgDiff, 0) / 40 * 100, 100) * 0.3;

  const lowDiff = lowestPrice30d > 0 ? ((lowestPrice30d - currentPrice) / lowestPrice30d) * 100 : 0;
  // If current price is below historical low, give high score
  const lowScore = lowDiff > 0 ? 100 * 0.3 : Math.max(0, (1 - (currentPrice - lowestPrice30d) / lowestPrice30d) * 100) * 0.3;

  return Math.round(Math.min(discountScore + avgScore + Math.max(lowScore, 0), 100));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all products with recent price changes
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("is_tracking", true);

    if (prodErr) throw prodErr;

    const results: any[] = [];

    for (const product of products || []) {
      if (!product.current_price || product.current_price <= 0) continue;

      // Get price history for last 30 days
      const { data: history } = await supabase
        .from("price_history")
        .select("price, recorded_at")
        .eq("product_id", product.id)
        .gte("recorded_at", thirtyDaysAgo)
        .order("recorded_at", { ascending: true });

      if (!history || history.length < 2) continue;

      const prices = history.map((h: any) => h.price);
      const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const lowestPrice = Math.min(...prices);
      const previousPrice = prices[prices.length - 2];
      const currentPrice = product.current_price;

      // Check if a deal should be created
      const discountPercent = previousPrice > 0
        ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
        : 0;

      const isBelowHistoricLow = currentPrice < lowestPrice;
      const isSignificantDrop = discountPercent >= 25;

      if (!isSignificantDrop && !isBelowHistoricLow) continue;

      // Check if we already have a recent pending/approved deal for this product
      const { data: existingDeal } = await supabase
        .from("deals")
        .select("id")
        .eq("product_id", product.id)
        .in("status", ["pending", "approved"])
        .gte("detected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingDeal) continue;

      const effectiveDiscount = Math.max(discountPercent, 
        Math.round(((avgPrice - currentPrice) / avgPrice) * 100));

      const dealScore = calculateDealScore(
        effectiveDiscount,
        currentPrice,
        avgPrice,
        lowestPrice
      );

      const { error: insertErr } = await supabase.from("deals").insert({
        product_id: product.id,
        old_price: previousPrice,
        new_price: currentPrice,
        discount_percent: effectiveDiscount,
        deal_score: dealScore,
        status: "pending",
      });

      if (!insertErr) {
        results.push({
          product: product.name,
          discount: `${effectiveDiscount}%`,
          score: dealScore,
          reason: isBelowHistoricLow ? "below_historic_low" : "significant_drop",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, dealsCreated: results.length, results }), {
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
