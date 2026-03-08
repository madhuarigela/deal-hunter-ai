import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramMessage, productName, oldPrice, newPrice, discountPercent, buyLink, imageUrl } = await req.json();

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      return new Response(
        JSON.stringify({ error: "Telegram bot not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use pre-generated message if available, otherwise build one
    const message = telegramMessage || `🔥 *Deal Alert!*

📦 *${productName}*

~~₹${oldPrice?.toLocaleString()}~~ → *₹${newPrice?.toLocaleString()}*
💰 *${discountPercent}% OFF*

🛒 [Buy Now](${buyLink})`;

    // If we have an image, send photo with caption; otherwise send text
    let response;
    if (imageUrl) {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: message,
          parse_mode: "Markdown",
        }),
      });
    } else {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Telegram API error:", data);
      return new Response(
        JSON.stringify({ error: "Telegram API error", details: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
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
