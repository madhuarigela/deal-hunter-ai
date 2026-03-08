import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscoveredProduct {
  name: string;
  url: string;
  image_url?: string;
  current_price?: number;
  platform: string;
  category?: string;
  source_page: string;
}

const STORE_SOURCES = [
  // Amazon
  { url: "https://www.amazon.in/gp/bestsellers/electronics", platform: "amazon", category: "electronics", label: "Amazon Electronics Best Sellers" },
  { url: "https://www.amazon.in/gp/bestsellers/computers", platform: "amazon", category: "laptops", label: "Amazon Computers Best Sellers" },
  { url: "https://www.amazon.in/gp/bestsellers/electronics/1389401031", platform: "amazon", category: "mobiles", label: "Amazon Mobiles Best Sellers" },
  { url: "https://www.amazon.in/deals", platform: "amazon", category: "electronics", label: "Amazon Deals" },
  // Flipkart
  { url: "https://www.flipkart.com/offers/electronics", platform: "flipkart", category: "electronics", label: "Flipkart Electronics Offers" },
  { url: "https://www.flipkart.com/mobile-phones-store", platform: "flipkart", category: "mobiles", label: "Flipkart Mobile Store" },
  { url: "https://www.flipkart.com/offers/fashion", platform: "flipkart", category: "fashion", label: "Flipkart Fashion Offers" },
  // Croma
  { url: "https://www.croma.com/deals-offers", platform: "croma", category: "electronics", label: "Croma Deals" },
  { url: "https://www.croma.com/headphones-earphones/bc/bvj", platform: "croma", category: "headphones", label: "Croma Headphones" },
  // Reliance Digital
  { url: "https://www.reliancedigital.in/offers", platform: "reliance", category: "electronics", label: "Reliance Digital Offers" },
  { url: "https://www.reliancedigital.in/laptops/c/S101210", platform: "reliance", category: "laptops", label: "Reliance Laptops" },
  // Myntra
  { url: "https://www.myntra.com/deals", platform: "myntra", category: "fashion", label: "Myntra Deals" },
  { url: "https://www.myntra.com/trending", platform: "myntra", category: "fashion", label: "Myntra Trending" },
  // Ajio
  { url: "https://www.ajio.com/offers", platform: "ajio", category: "fashion", label: "Ajio Offers" },
  { url: "https://www.ajio.com/trending", platform: "ajio", category: "fashion", label: "Ajio Trending" },
];

const MAX_PER_STORE = 30;

function detectPlatform(url: string): string {
  if (url.includes("amazon.in") || url.includes("amazon.com")) return "amazon";
  if (url.includes("flipkart.com")) return "flipkart";
  if (url.includes("croma.com")) return "croma";
  if (url.includes("reliancedigital.in")) return "reliance";
  if (url.includes("myntra.com")) return "myntra";
  if (url.includes("ajio.com")) return "ajio";
  return "other";
}

function generateAffiliateLink(url: string, platform: string): string {
  try {
    const u = new URL(url);
    switch (platform) {
      case "amazon":
        u.searchParams.set("tag", "yourtag-21");
        break;
      case "flipkart":
        u.searchParams.set("affid", "yourid");
        break;
      // Other stores: keep original URL
    }
    return u.toString();
  } catch {
    return url;
  }
}

function extractProductsFromHtml(html: string, source: typeof STORE_SOURCES[0]): DiscoveredProduct[] {
  const products: DiscoveredProduct[] = [];

  // Generic extraction patterns for product names, URLs, images, prices
  // Pattern 1: Links with product-like paths
  const linkPattern = /<a[^>]*href=["']([^"']+(?:\/dp\/|\/p\/|\/product\/|\/buy\/)[^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set<string>();

  while ((match = linkPattern.exec(html)) !== null && products.length < MAX_PER_STORE) {
    let productUrl = match[1];
    const linkContent = match[2];

    // Clean name from HTML tags
    const name = linkContent.replace(/<[^>]+>/g, "").trim().slice(0, 200);
    if (!name || name.length < 5) continue;

    // Normalize URL
    if (productUrl.startsWith("/")) {
      const baseUrls: Record<string, string> = {
        amazon: "https://www.amazon.in",
        flipkart: "https://www.flipkart.com",
        croma: "https://www.croma.com",
        reliance: "https://www.reliancedigital.in",
        myntra: "https://www.myntra.com",
        ajio: "https://www.ajio.com",
      };
      productUrl = (baseUrls[source.platform] || "") + productUrl;
    }

    if (seen.has(productUrl)) continue;
    seen.add(productUrl);

    products.push({
      name,
      url: productUrl,
      platform: source.platform,
      category: source.category,
      source_page: source.label,
    });
  }

  // Pattern 2: Generic title + link combos
  const titlePattern = /<(?:h[2-4]|span|div)[^>]*class=["'][^"']*(?:title|name|product)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[2-4]|span|div)>/gi;
  while ((match = titlePattern.exec(html)) !== null && products.length < MAX_PER_STORE) {
    const name = match[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
    if (!name || name.length < 5) continue;

    // Try to find a nearby link
    const nearbyHtml = html.slice(Math.max(0, match.index - 500), match.index + 500);
    const linkMatch = nearbyHtml.match(/href=["']([^"']*(?:\/dp\/|\/p\/|\/product\/|\/buy\/)[^"']*?)["']/i);
    if (!linkMatch) continue;

    let productUrl = linkMatch[1];
    if (productUrl.startsWith("/")) {
      const baseUrls: Record<string, string> = {
        amazon: "https://www.amazon.in",
        flipkart: "https://www.flipkart.com",
        croma: "https://www.croma.com",
        reliance: "https://www.reliancedigital.in",
        myntra: "https://www.myntra.com",
        ajio: "https://www.ajio.com",
      };
      productUrl = (baseUrls[source.platform] || "") + productUrl;
    }

    if (seen.has(productUrl)) continue;
    seen.add(productUrl);

    // Try to extract price from nearby context
    const priceMatch = nearbyHtml.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : undefined;

    // Try to extract image
    const imgMatch = nearbyHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    products.push({
      name,
      url: productUrl,
      image_url: imageUrl,
      current_price: price && price > 0 ? price : undefined,
      platform: source.platform,
      category: source.category,
      source_page: source.label,
    });
  }

  // Extract prices for existing products that don't have them
  for (const p of products) {
    if (p.current_price) continue;
    // Try to find price near product URL in HTML
    const urlIndex = html.indexOf(p.url.replace(/^https?:\/\/[^/]+/, ""));
    if (urlIndex > -1) {
      const context = html.slice(urlIndex, urlIndex + 1000);
      const priceMatch = context.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      if (priceMatch) {
        p.current_price = parseFloat(priceMatch[1].replace(/,/g, ""));
      }
    }
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

    // Get existing product URLs for dedup
    const { data: existingProducts } = await supabase
      .from("products")
      .select("url");
    const existingUrls = new Set((existingProducts || []).map((p: any) => p.url));

    const results: { store: string; discovered: number; added: number }[] = [];
    let totalAdded = 0;

    for (const source of STORE_SOURCES) {
      if (totalAdded >= 180) break;

      try {
        console.log(`Fetching: ${source.label} (${source.url})`);

        const response = await fetch(source.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-IN,en;q=0.9",
          },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch ${source.url}: ${response.status}`);
          results.push({ store: source.label, discovered: 0, added: 0 });
          continue;
        }

        const html = await response.text();
        const discovered = extractProductsFromHtml(html, source);

        let added = 0;
        for (const product of discovered) {
          if (totalAdded >= 180) break;
          if (existingUrls.has(product.url)) continue;

          const affiliateLink = generateAffiliateLink(product.url, product.platform);

          const { error } = await supabase.from("products").insert({
            name: product.name,
            url: product.url,
            platform: product.platform,
            image_url: product.image_url || null,
            current_price: product.current_price || null,
            affiliate_link: affiliateLink,
            category: product.category || null,
            source_page: product.source_page,
            is_tracking: true,
          });

          if (!error) {
            existingUrls.add(product.url);
            added++;
            totalAdded++;

            // Insert initial price history if price exists
            if (product.current_price && product.current_price > 0) {
              // Get the inserted product id
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

        results.push({ store: source.label, discovered: discovered.length, added });
        console.log(`${source.label}: discovered ${discovered.length}, added ${added}`);
      } catch (e) {
        console.error(`Error processing ${source.label}:`, e);
        results.push({ store: source.label, discovered: 0, added: 0 });
      }
    }

    return new Response(JSON.stringify({ success: true, totalAdded, results }), {
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
