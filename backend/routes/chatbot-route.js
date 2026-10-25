
const express = require("express");

const router = express.Router();

// ==========================================
// JCN CHATBOT CONFIGURATION
// ==========================================

const DELIVERY_FEE = 80;
const MAX_MESSAGE_LENGTH = 600;

const SYSTEM_PROMPT = `
You are JCN AI Assistant, the customer service
chatbot of JCN Apparel Printing Services.

Your purpose:
- Help customers browse products.
- Explain clothing customization.
- Assist with sizes and colors.
- Explain checkout and payment methods.
- Explain delivery and order tracking.

JCN Information:
- Products may include T-shirts, hoodies,
  sweatshirts, and polo shirts.
- Customers can create personalized designs.
- Delivery fee is PHP 80.
- Payment methods include COD and PayPal.
- Orders can be checked in the Orders page.
- Customization is available in the customer portal.

Rules:
- Be friendly, helpful, and professional.
- Respond in Filipino when customers use Filipino.
- Respond in English when customers use English.
- Never invent product prices, stock, order statuses,
  delivery dates, or discounts.
- Do not claim access to customer orders or accounts.
- If account-specific data is needed, direct the
  customer to the appropriate portal page.
- Keep responses concise.
`;

// ==========================================
// FAQ RESPONSE
// ==========================================

function getFAQResponse(message) {
  const q = message.toLowerCase().trim();

  if (
    /\b(hello|hi|hey|good morning|good evening)\b/.test(q) ||
    /^(kumusta|kamusta|magandang araw)/.test(q)
  ) {
    return "Hello! Welcome to JCN Apparel Printing Services. How can I help you today?";
  }

  if (/track|tracking|nasaan|order status|where.*order/.test(q)) {
    return "To check your order status, open the Orders page in your JCN customer dashboard. You can view the latest available status and tracking details there.";
  }

  if (/custom|design|print|logo|upload/.test(q)) {
    return "You can create your own apparel design! Open Customization from your dashboard, choose your apparel, select a color, and add your text or artwork.";
  }

  if (/size|sizing|sukat|fit|measurement/.test(q)) {
    return "Available sizes depend on the product. Open a product to check its size options and measurements before ordering.";
  }

  if (/product|shirt|hoodie|polo|sweatshirt|item|available/.test(q)) {
    return "JCN Apparel offers customizable clothing such as T-shirts, hoodies, sweatshirts, and polo shirts. Visit Shop Products to see the current selection, prices, and availability.";
  }

  if (/payment|paypal|cod|bayad|pay/.test(q)) {
    return "JCN Apparel supports Cash on Delivery (COD) and PayPal, subject to the payment options available at checkout.";
  }

  if (/deliver|shipping|courier|fee|magkano.*shipping/.test(q)) {
    return `The standard delivery fee is ₱${DELIVERY_FEE}. Your checkout page will show the applicable delivery charge and total.`;
  }

  if (/cart|checkout|buy|purchase|bumili/.test(q)) {
    return "Choose a product, select the size, color, and quantity, then add it to your cart or use Buy Now. Review your details at checkout before placing your order.";
  }

  if (/discount|sale|promo|announcement/.test(q)) {
    return "You can check Shop Products for active product discounts and Notifications for announcements. Promotions depend on what is currently available.";
  }

  if (/thank|salamat/.test(q)) {
    return "You're welcome! Thank you for choosing JCN Apparel Printing Services.";
  }

  return "I'm here to help with JCN products, customization, sizes, payments, delivery, and orders. What would you like to know?";
}

// ==========================================
// OPTIONAL OPENAI CONNECTION
// ==========================================

async function getAIResponse(message, history) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required for AI requests.");
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-10)
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 600)
        }))
    : [];

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            ...safeHistory,
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 250
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `OpenAI request failed: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return data.choices?.[0]?.message?.content?.trim() || null;

  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "JCN AI Assistant",
    status: "online",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

// ==========================================
// CHATBOT MESSAGE API
// ==========================================

router.post("/", async (req, res) => {
  try {
    const message = req.body?.message;
    const history = req.body?.history;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message."
      });
    }

    const cleanMessage = message.trim();

    if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Message is too long."
      });
    }

    let reply = null;
    let mode = "faq";

    if (process.env.OPENAI_API_KEY) {
      try {
        reply = await getAIResponse(
          cleanMessage,
          history
        );

        if (reply) {
          mode = "ai";
        }
      } catch (aiError) {
        console.error(
          "JCN AI request failed:",
          aiError.message
        );
      }
    }

    if (!reply) {
      reply = getFAQResponse(cleanMessage);
    }

    return res.json({
      success: true,
      reply,
      mode
    });

  } catch (error) {
    console.error(
      "JCN CHATBOT ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Chatbot service is unavailable."
    });
  }
});

module.exports = router;
