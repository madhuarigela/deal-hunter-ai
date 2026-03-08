import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KNOWN_BRANDS = [
  "apple", "samsung", "sony", "oneplus", "boat", "jbl", "lg", "mi", "xiaomi",
  "realme", "oppo", "vivo", "motorola", "nokia", "google", "asus", "acer",
  "hp", "dell", "lenovo", "msi", "nothing", "marshall", "bose", "sennheiser",
  "skullcandy", "noise", "fire-boltt", "amazfit", "garmin", "fitbit",
  "whirlpool", "haier", "voltas", "daikin", "godrej", "ifb", "bosch",
  "philips", "bajaj", "havells", "crompton", "orient", "usha",
  "nike", "adidas", "puma", "reebok", "levis", "wrangler", "allen solly",
  "van heusen", "peter england", "raymond", "us polo", "tommy hilfiger",
  "calvin klein", "h&m", "zara", "mango", "forever 21",
];

function extractBrand(name: string): string {
  const lower = name.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand)) {
      return brand.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  // Fallback: first word
  return name.split(/\s+/)[0] || "Unknown";
}

function extractModel(name: string, brand: string): string {
  // Remove brand from name and extract model
  let cleaned = name.replace(new RegExp(brand, "gi"), "").trim();

  // Common model patterns
  const modelPatterns = [
    // iPhone 15 Pro Max, Galaxy S24 Ultra, etc.
    /([A-Za-z]+\s*\d+[\w\s]*(?:Pro|Max|Ultra|Plus|Lite|Mini|SE|FE)?)/i,
    // WH-1000XM5, WF-1000XM5
    /([A-Z]{2,}-?\d{3,}[A-Z]*\d*)/i,
    // Model with just alphanumeric
    /^([A-Za-z0-9][\w\s-]{2,30})/,
  ];

  for (const pattern of modelPatterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1].trim();
  }

  // Fallback: first few meaningful words
  return cleaned.split(/[,(]/)[0].trim().slice(0, 50) || "Unknown";
}

function extractVariant(name: string): string | null {
  const variants: string[] = [];

  // Storage variants
  const storageMatch = name.match(/(\d+)\s*(GB|TB)/i);
  if (storageMatch) variants.push(`${storageMatch[1]}${storageMatch[2].toUpperCase()}`);

  // RAM
  const ramMatch = name.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch) variants.push(`${ramMatch[1]}GB RAM`);

  // Color
  const colorPatterns = /\b(Black|White|Blue|Red|Green|Gold|Silver|Purple|Pink|Grey|Gray|Yellow|Orange|Cream|Beige|Brown|Navy|Midnight|Starlight|Space\s*Gr[ae]y|Phantom|Titanium|Lavender|Coral|Mint)\b/i;
  const colorMatch = name.match(colorPatterns);
  if (colorMatch) variants.push(colorMatch[1]);

  // Size
  const sizeMatch = name.match(/\b(XS|S|M|L|XL|XXL|2XL|3XL|\d+\s*inch|\d+\s*cm)\b/i);
  if (sizeMatch) variants.push(sizeMatch[1]);

  return variants.length > 0 ? variants.join(", ") : null;
}

function generateNormalizedName(brand: string, model: string, variant: string | null): string {
  let name = `${brand} ${model}`;
  if (variant) name += ` ${variant}`;
  return name.replace(/\s+/g, " ").trim();
}

function similarityScore(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let common = 0;
  for (const w of setA) if (setB.has(w)) common++;
  return common / Math.max(setA.size, setB.size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get products without a master_product_id
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, platform")
      .is("master_product_id", null)
      .limit(200);

    if (prodErr) throw prodErr;
    if (!products?.length) {
      return new Response(JSON.stringify({ success: true, normalized: 0, message: "No products to normalize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing master products
    const { data: masterProducts } = await supabase
      .from("products_master")
      .select("*");

    const masters = masterProducts || [];
    const results: any[] = [];

    for (const product of products) {
      const brand = extractBrand(product.name);
      const model = extractModel(product.name, brand);
      const variant = extractVariant(product.name);
      const normalizedName = generateNormalizedName(brand, model, variant);

      // Try to find existing master product
      let masterId: string | null = null;

      for (const master of masters) {
        // Match by normalized name similarity
        const score = similarityScore(normalizedName, master.normalized_name);
        if (score >= 0.7) {
          masterId = master.id;
          break;
        }
        // Also check brand + model match
        if (
          master.brand.toLowerCase() === brand.toLowerCase() &&
          similarityScore(model.toLowerCase(), master.model.toLowerCase()) >= 0.8
        ) {
          masterId = master.id;
          break;
        }
      }

      if (!masterId) {
        // Create new master product
        const { data: newMaster, error: insertErr } = await supabase
          .from("products_master")
          .insert({ brand, model, variant, normalized_name: normalizedName })
          .select("id")
          .single();

        if (insertErr) {
          console.error("Failed to create master:", insertErr);
          continue;
        }
        masterId = newMaster.id;
        masters.push({ id: masterId, brand, model, variant, normalized_name: normalizedName });
      }

      // Link product to master
      await supabase.from("products").update({ master_product_id: masterId }).eq("id", product.id);

      results.push({ product: product.name, normalized: normalizedName, masterId });
    }

    return new Response(JSON.stringify({ success: true, normalized: results.length, results }), {
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
