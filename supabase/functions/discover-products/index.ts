import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category/trending page sources
const SOURCES = [
  {
    platform: "amazon",
    name: "Amazon Best Sellers Electronics",
    url: "https://www.amazon.in/gp/bestsellers/electronics/",
  },
  {
    platform: "amazon",
    name: "Amazon Deals",
    url: "https://www.amazon.in/deals",
  },
  {
    platform: "flipkart",
    name: "Flipkart Deals",
    url: "https://www.flipkart.com/offers-store",
  },
];

function generateAffiliateUrl(url: string, platform: string): string {
  try {
    const u = new URL(url);
    if (platform === "amazon") {
      u.searchParams.set("tag", "dealhunter-21");
    } else if (platform === "flipkart") {
      u.searchParams.set("affid", "dealhunterai");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function extractAmazonProducts(html: string, baseUrl: string): Array<{
  name: string;
  url: string;
  image_url: string | null;
  current_price: number | null;
}> {
  const products: Array<{
    name: string;
    url: string;
    image_url: string | null;
    current_price: number | null;
  }> = [];

  // Extract product links with names - Amazon grid items
  const itemPattern = /<a[^>]*href="(\/[^"]*\/dp\/[A-Z0-9]{10}[^"]*)"[^>]*>[\s\S]*?<span[^>]*>([^<]{5,100})<\/span>/gi;
  let match;
  const seen = new Set<string>();

  while ((match = itemPattern.exec(html)) !== null && products.length < 20) {
    const relativeUrl = match[1];
    const name = match[2].trim().replace(/&amp;/g, "&").replace(/&#39;/g, "'");

    // Extract ASIN for dedup
    const asinMatch = relativeUrl.match(/\/dp\/([A-Z0-9]{10})/);
    if (!asinMatch || seen.has(asinMatch[1])) continue;
    seen.add(asinMatch[1]);

    const productUrl = `https://www.amazon.in/dp/${asinMatch[1]}`;

    // Try to find price near this product
    const priceMatch = html.substring(match.index, match.index + 2000).match(/₹\s*([0-9,]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : null;

    // Try to find image
    const imgMatch = html.substring(Math.max(0, match.index - 1000), match.index + 1000)
      .match(/src="(https:\/\/[^"]*images-amazon\.com[^"]*\.jpg)"/);

    products.push({
      name,
      url: productUrl,
      image_url: imgMatch ? imgMatch[1] : null,
      current_price: price && price > 0 ? price : null,
    });
  }

  return products;
}

function extractFlipkartProducts(html: string): Array<{
  name: string;
  url: string;
  image_url: string | null;
  current_price: number | null;
}> {
  const products: Array<{
    name: string;
    url: string;
    image_url: string | null;
    current_price: number | null;
  }> = [];

  // Flipkart product cards
  const itemPattern = /<a[^>]*href="(\/[^"]*)"[^>]*>[\s\S]*?<div[^>]*>([^<]{5,100})<\/div>[\s\S]*?₹([0-9,]+)/gi;
  let match;
  const seen = new Set<string>();

  while ((match = itemPattern.exec(html)) !== null && products.length < 20) {
    const relativeUrl = match[1];
    const name = match[2].trim().replace(/&amp;/g, "&");

    if (seen.has(relativeUrl)) continue;
    seen.add(relativeUrl);

    const productUrl = `https://www.flipkart.com${relativeUrl}`;
    const price = parseFloat(match[3].replace(/,/g, ""));

    const imgMatch = html.substring(Math.max(0, match.index - 500), match.index + 500)
      .match(/src="(https:\/\/[^"]*flipkart[^"]*\.jpg)"/i);

    products.push({
      name,
      url: productUrl,
      image_url: imgMatch ? imgMatch[1] : null,
      current_price: price > 0 ? price : null,
    });
  }

  return products;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: any[] = [];

    for (const source of SOURCES) {
      try {
        const response = await fetch(source.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
          },
        });

        if (!response.ok) {
          results.push({ source: source.name, status: "fetch_failed", code: response.status });
          continue;
        }

        const html = await response.text();
        let extracted: Array<{
          name: string;
          url: string;
          image_url: string | null;
          current_price: number | null;
        }> = [];

        if (source.platform === "amazon") {
          extracted = extractAmazonProducts(html, source.url);
        } else {
          extracted = extractFlipkartProducts(html);
        }

        let added = 0;
        for (const product of extracted) {
          // Check for duplicates by URL pattern
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("url", product.url)
            .maybeSingle();

          if (existing) continue;

          const affiliateUrl = generateAffiliateUrl(product.url, source.platform);

          const { error } = await supabase.from("products").insert({
            name: product.name,
            url: product.url,
            platform: source.platform,
            affiliate_link: affiliateUrl,
            image_url: product.image_url,
            current_price: product.current_price,
            is_tracking: true,
          });

          if (!error) {
            added++;
            // Also add initial price history if we have a price
            if (product.current_price) {
              // Need to get the ID of the just-inserted product
              const { data: inserted } = await supabase
                .from("products")
                .select("id")
                .eq("url", product.url)
                .single();

              if (inserted) {
                await supabase.from("price_history").insert({
                  product_id: inserted.id,
                  price: product.current_price,
                });
              }
            }
          }
        }

        results.push({ source: source.name, extracted: extracted.length, added });
      } catch (err) {
        results.push({ source: source.name, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
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
