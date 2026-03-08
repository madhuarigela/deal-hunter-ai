import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all actively tracked products
    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("is_tracking", true);

    if (fetchErr) throw fetchErr;

    const results: any[] = [];

    for (const product of products || []) {
      try {
        // Attempt to fetch the product page
        const response = await fetch(product.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          results.push({ product: product.name, status: "fetch_failed", code: response.status });
          continue;
        }

        const html = await response.text();
        let extractedPrice: number | null = null;

        // Try to extract price based on platform
        if (product.platform === "amazon") {
          // Look for Amazon price patterns
          const priceMatch = html.match(/class="a-price-whole"[^>]*>([0-9,]+)/);
          if (priceMatch) {
            extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
          }
        } else if (product.platform === "flipkart") {
          // Look for Flipkart price patterns
          const priceMatch = html.match(/class="_30jeq3[^"]*"[^>]*>₹([0-9,]+)/);
          if (priceMatch) {
            extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
          }
        }

        // Fallback: try generic price pattern
        if (!extractedPrice) {
          const genericMatch = html.match(/₹\s*([0-9,]+(?:\.[0-9]+)?)/);
          if (genericMatch) {
            extractedPrice = parseFloat(genericMatch[1].replace(/,/g, ""));
          }
        }

        if (extractedPrice && extractedPrice > 0) {
          const oldPrice = product.current_price;

          // Store in price_history
          await supabase.from("price_history").insert({
            product_id: product.id,
            price: extractedPrice,
          });

          // Update product current_price and last_checked_at
          await supabase
            .from("products")
            .update({
              current_price: extractedPrice,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", product.id);

          // Detect price drop > 20%
          if (oldPrice && oldPrice > 0) {
            const dropPercent = Math.round(((oldPrice - extractedPrice) / oldPrice) * 100);
            if (dropPercent >= 20) {
              await supabase.from("deals").insert({
                product_id: product.id,
                old_price: oldPrice,
                new_price: extractedPrice,
                discount_percent: dropPercent,
                status: "pending",
              });
              results.push({ product: product.name, status: "deal_detected", drop: `${dropPercent}%` });
            } else {
              results.push({ product: product.name, status: "price_updated", price: extractedPrice });
            }
          } else {
            results.push({ product: product.name, status: "price_set", price: extractedPrice });
          }
        } else {
          // Update last_checked_at even if price not found
          await supabase
            .from("products")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", product.id);

          results.push({ product: product.name, status: "price_not_found" });
        }
      } catch (err) {
        results.push({ product: product.name, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, checked: results.length, results }), {
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
