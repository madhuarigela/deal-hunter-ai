import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateAffiliateLink(url: string, platform: string): string {
  try {
    const u = new URL(url);
    if (platform === "amazon") u.searchParams.set("tag", "yourtag-21");
    else if (platform === "flipkart") u.searchParams.set("affid", "yourid");
    return u.toString();
  } catch {
    return url;
  }
}

function generateCrossStoreMessage(
  normalizedName: string,
  allPrices: { store: string; price: number; link: string }[],
  cheapestStore: string,
  cheapestPrice: number,
  maxPrice: number
): string {
  const priceLines = allPrices
    .sort((a, b) => a.price - b.price)
    .map(p => `${p.store === cheapestStore ? "🔥" : "  "} ${p.store}: ₹${p.price.toLocaleString()}`)
    .join("\n");

  const savings = maxPrice - cheapestPrice;
  const cheapestEntry = allPrices.find(p => p.store === cheapestStore);

  return `🔥 *BEST PRICE ALERT*

📦 *${normalizedName}*

${priceLines}

🔥 *Cheapest on ${cheapestStore}*
💰 Save ₹${savings.toLocaleString()} compared to other stores

👉 [Buy Now](${cheapestEntry?.link || ""})`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all master products that have multiple store listings
    const { data: masters, error: masterErr } = await supabase
      .from("products_master")
      .select("id, normalized_name, brand, model");

    if (masterErr) throw masterErr;
    if (!masters?.length) {
      return new Response(JSON.stringify({ success: true, compared: 0, message: "No master products" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    let dealsCreated = 0;

    for (const master of masters) {
      // Get all listings for this master product
      const { data: listings } = await supabase
        .from("products")
        .select("id, platform, current_price, url, affiliate_link, name, image_url")
        .eq("master_product_id", master.id)
        .not("current_price", "is", null);

      if (!listings || listings.length < 2) continue;

      // Build price map
      const allPrices = listings
        .filter(l => l.current_price && l.current_price > 0)
        .map(l => ({
          store: l.platform,
          price: l.current_price!,
          link: l.affiliate_link || generateAffiliateLink(l.url, l.platform),
          productId: l.id,
          imageUrl: l.image_url,
        }));

      if (allPrices.length < 2) continue;

      allPrices.sort((a, b) => a.price - b.price);
      const cheapest = allPrices[0];
      const mostExpensive = allPrices[allPrices.length - 1];
      const priceDiff = mostExpensive.price - cheapest.price;
      const priceDiffPercent = (priceDiff / mostExpensive.price) * 100;

      // Store comparison result
      await supabase.from("price_comparisons").insert({
        master_product_id: master.id,
        cheapest_store: cheapest.store,
        cheapest_price: cheapest.price,
        price_difference: priceDiff,
        all_prices: allPrices.map(p => ({ store: p.store, price: p.price })),
      });

      results.push({
        product: master.normalized_name,
        cheapest: cheapest.store,
        cheapestPrice: cheapest.price,
        priceDiff,
        stores: allPrices.length,
      });

      // Generate cross-store deal if price difference >= 8%
      if (priceDiffPercent >= 8) {
        // Check for existing recent cross-store deal
        const { data: existingDeal } = await supabase
          .from("deals")
          .select("id")
          .eq("product_id", cheapest.productId)
          .in("status", ["pending", "approved", "posted"])
          .gte("detected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingDeal) continue;

        const telegramMessage = generateCrossStoreMessage(
          master.normalized_name,
          allPrices.map(p => ({ store: p.store, price: p.price, link: p.link })),
          cheapest.store,
          cheapest.price,
          mostExpensive.price
        );

        // Calculate AI score with cross-store bonus
        const discountScore = Math.min(priceDiffPercent, 100) * 0.4;
        const crossStoreBonus = 20; // bonus for being cheapest across stores
        const aiScore = Math.round(Math.min(discountScore + crossStoreBonus + 30, 100));

        let status = "pending";
        if (aiScore >= 85) status = "approved";
        else if (aiScore < 60) status = "rejected";

        const { error: dealErr } = await supabase.from("deals").insert({
          product_id: cheapest.productId,
          old_price: mostExpensive.price,
          new_price: cheapest.price,
          discount_percent: Math.round(priceDiffPercent),
          deal_score: aiScore,
          ai_score: aiScore,
          status,
          telegram_message: telegramMessage,
          ai_processed_at: new Date().toISOString(),
        });

        if (!dealErr) {
          dealsCreated++;

          // Auto-post if score >= 85
          if (aiScore >= 85) {
            try {
              const postResponse = await fetch(`${supabaseUrl}/functions/v1/post-to-telegram`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  telegramMessage,
                  productName: master.normalized_name,
                  oldPrice: mostExpensive.price,
                  newPrice: cheapest.price,
                  discountPercent: Math.round(priceDiffPercent),
                  buyLink: cheapest.link,
                  imageUrl: cheapest.imageUrl,
                }),
              });

              if (postResponse.ok) {
                await supabase.from("deals")
                  .update({ status: "posted", posted_at: new Date().toISOString() })
                  .eq("product_id", cheapest.productId)
                  .eq("status", "approved")
                  .order("detected_at", { ascending: false })
                  .limit(1);
              }
            } catch (e) {
              console.error("Auto-post failed:", e);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      compared: results.length,
      dealsCreated,
      results,
    }), {
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
