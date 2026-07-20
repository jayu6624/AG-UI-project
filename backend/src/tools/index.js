/**
 * MOCK TOOLS
 * ----------
 * For the POC these return deterministic fake data instead of hitting a
 * real DB/API. Swap the body of each function for a real call later —
 * the agent-facing contract (name, args, return shape) stays the same.
 */

const PLACEHOLDER_IMG = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/300`;

function hotel_search({ city = "Ahmedabad", limit = 3 }) {
  const hotels = [
    { name: "🏰 The Grand Palace", price: 4000, rating: 4.5 },
    { name: "🌊 Riverside Inn", price: 5200, rating: 4.3 },
    { name: "🏙️ City Comfort Suites", price: 3200, rating: 4.0 },
    { name: "🌺 Heritage Boutique Hotel", price: 6100, rating: 4.7 },
  ].slice(0, limit);

  return hotels.map((h, i) => ({
    id: `hotel_${i + 1}`,
    name: `${h.name} - ${city}`,
    price: h.price,
    rating: h.rating,
    image: PLACEHOLDER_IMG(`${city}-hotel-${i}`),
  }));
}

function sales_data({ months = 6 }) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const labels = [];
  const data = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthNames[d.getMonth()]);
    data.push(Math.round(20000 + Math.random() * 60000));
  }
  return { labels, data };
}

function product_search({ maxPrice = 5000, limit = 4 }) {
  const catalog = [
    { name: "🎧 Wireless Earbuds", price: 1999 },
    { name: "⌚ Smart Watch", price: 3499 },
    { name: "🔊 Bluetooth Speaker", price: 1499 },
    { name: "⌨️ Mechanical Keyboard", price: 4999 },
    { name: "📹 4K Webcam", price: 3999 },
    { name: "🖱️ Gaming Mouse", price: 1299 },
  ];
  return catalog
    .filter((p) => p.price <= maxPrice)
    .slice(0, limit)
    .map((p, i) => ({
      id: `product_${i + 1}`,
      name: p.name,
      price: p.price,
      image: PLACEHOLDER_IMG(`product-${p.name}`),
    }));
}

function orders_list({ limit = 5 }) {
  const statuses = ["✅ Delivered", "🚚 Shipped", "⏳ Processing", "❌ Cancelled"];
  const rows = [];
  for (let i = 1; i <= limit; i++) {
    rows.push({
      id: `ORD-${1000 + i}`,
      date: new Date(Date.now() - i * 86400000 * 3).toISOString().slice(0, 10),
      amount: Math.round(500 + Math.random() * 4500),
      status: statuses[i % statuses.length],
    });
  }
  return rows;
}

function create_customer({ name, email, phone }) {
  // In a real system this would write to a DB. Here we just echo back.
  return { id: `cust_${Date.now()}`, name, email, phone, created: true };
}

export const TOOLS = { hotel_search, sales_data, product_search, orders_list, create_customer };

/**
 * Tool definitions in OpenAI/Groq function-calling format.
 * The LLM sees these and decides whether to call one before answering.
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "hotel_search",
      description: "Search for hotels in a given city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City to search hotels in" },
          limit: { type: "integer", description: "Max number of hotels to return" },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sales_data",
      description: "Get monthly sales performance figures for the last N months.",
      parameters: {
        type: "object",
        properties: {
          months: { type: "integer", description: "Number of months of history to return" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "product_search",
      description: "Search products, optionally filtered by max price.",
      parameters: {
        type: "object",
        properties: {
          maxPrice: { type: "integer", description: "Maximum price filter" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "orders_list",
      description: "Get the current user's most recent orders.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Create a new customer record. Only call this once the user has actually submitted a form with name/email/phone; if they merely asked to create a customer, respond with a 'form' UI block instead of calling this tool.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
        },
        required: ["name", "email"],
      },
    },
  },
];
