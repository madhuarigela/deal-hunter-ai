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

    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("is_tracking", true);

    if (fetchErr) throw fetchErr;

    const results: any[] = [];

    for (const product of products || []) {
      try {
        const response = await fetch(product.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-IN,en;q=0.9",
          },
        });

        if (!response.ok) {
          results.push({ product: product.name, status: "fetch_failed", code: response.status });
          continue;
        }

        const html = await response.text();
        let extractedPrice: number | null = null;

        if (product.platform === "amazon") {
          // Multiple Amazon price selectors
          const patterns = [
            /class="a-price-whole"[^>]*>([0-9,]+)/,
            /id="priceblock_dealprice"[^>]*>₹\s*([0-9,]+)/,
            /id="priceblock_ourprice"[^>]*>₹\s*([0-9,]+)/,
            /"priceToPay"[^}]*"value":"([0-9.]+)"/,
          ];
          for (const pattern of patterns) {
            const m = html.match(pattern);
            if (m) {
              extractedPrice = parseFloat(m[1].replace(/,/g, ""));
              break;
            }
          }
        } else if (product.platform === "flipkart") {
          const patterns = [
            /class="_30jeq3[^"]*"[^>]*>₹([0-9,]+)/,
            /class="_16Jk6d"[^>]*>₹([0-9,]+)/,
          ];
          for (const pattern of patterns) {
            const m = html.match(pattern);
            if (m) {
              extractedPrice = parseFloat(m[1].replace(/,/g, ""));
              break;
            }
          }
        }

        // Fallback generic
        if (!extractedPrice) {
          const generic = html.match(/₹\s*([0-9,]+(?:\.[0-9]+)?)/);
          if (generic) {
            extractedPrice = parseFloat(generic[1].replace(/,/g, ""));
          }
        }

        if (extractedPrice && extractedPrice > 0) {
          // Store price history
          await supabase.from("price_history").insert({
            product_id: product.id,
            price: extractedPrice,
          });

          // Update product
          await supabase
            .from("products")
            .update({
              current_price: extractedPrice,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", product.id);

          results.push({ product: product.name, status: "updated", price: extractedPrice });
        } else {
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
