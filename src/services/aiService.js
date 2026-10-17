const OpenAI = require('openai');
const { SYSTEM_KNOWLEDGE } = require('./aiKnowledge');
const { AI_TOOLS } = require('./aiToolDefinitions');
const {
  getSalesMetrics,
  getProfitMetrics,
  getInventoryStatus,
  getStockMovements,
  getCustomerDebts,
  getExpensesSummary,
  getSuppliersSummary,
  getBusinessOverview,
  prepareAddProduct,
  prepareAdjustStock,
  prepareCustomerPayment,
  prepareExpense,
  prepareUpdateProduct,
  preparePurchase,
  searchProductsDetail,
  searchCustomerDetail,
  searchSupplierDetail,
  getSystemSettingsData,
  getCategoriesList,
  searchSaleInvoices,
} = require('./aiDataService');

// ----------------------------------------------------------------
// OpenAI client + model helpers
// ----------------------------------------------------------------
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key' || apiKey.trim() === '') {
    return null;
  }
  return new OpenAI({ apiKey, timeout: 5000, maxRetries: 0 });
}

function getModelName() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

// ----------------------------------------------------------------
// System prompt builder
// ----------------------------------------------------------------
function buildSystemPrompt(user) {
  return `You are the intelligent, professional AI Assistant for "JILE Electronics Management System" (a retail and wholesale electronics management platform).

Current User Context:
- Name: ${user.name}
- Email: ${user.email}
- Role: ${user.role} (${user.role === 'admin' ? 'Administrator - Full Access' : 'Staff - Standard Access, restricted from user management and profit reports'})
- Today's Date: ${new Date().toISOString().split('T')[0]}

Core Capabilities:
1. Answer ANY user question accurately, including system modules, products, sales, profit, purchases, inventory, customers, debts, suppliers, expenses, reports, settings, and general electronics/technology/science questions.
2. Answer business data questions using actual database tools. NEVER invent figures or claim access to data that was not retrieved.
3. Guide users step by step in Somali or English when they ask how to perform operations across all 17 system modules.
4. Stage business actions (creating products, updating prices, stock adjustments, customer debt payments, expense entries, purchase orders) safely using the "propose_*" tools. NEVER execute a write immediately. Always present the preview and request explicit user confirmation.
5. When information is missing for an action or query, ask a clear follow-up question instead of guessing.

Language Instructions:
- Support both Somali (Af-Soomaali) and English fluently, including informal wording, short messages, and spelling mistakes.
- If the user writes in Somali, respond in natural, professional Somali.
- If the user writes in English, respond in professional English.

Financial & Business Rules:
- Revenue = actual sales total after discounts.
- Cost of Goods Sold (COGS) = cost attributable to products sold.
- Gross Profit = revenue minus cost of goods sold.
- Net Profit = gross profit minus operating expenses.
- Never treat revenue as profit.
- Customer debt = outstanding balance owed by customers.
- If user role is 'staff' and asks about profit, politely explain that profit reports are restricted to Administrator accounts.

Formatting:
- Always answer the user's ACTUAL question directly. NEVER dump an unasked welcome message or dashboard.
- Use clean Markdown formatting with bullet points and bold numbers.
- Currency is in USD ($).`;
}

// ----------------------------------------------------------------
// Tool dispatcher
// ----------------------------------------------------------------
async function executeTool(toolName, args, user) {
  switch (toolName) {
    case 'get_sales_metrics':
      return await getSalesMetrics(args);
    case 'get_profit_metrics':
      return await getProfitMetrics({ ...args, userRole: user.role });
    case 'get_inventory_status':
      return await getInventoryStatus(args);
    case 'get_stock_movements':
      return await getStockMovements(args);
    case 'get_customer_debts':
      return await getCustomerDebts(args);
    case 'get_expenses_summary':
      return await getExpensesSummary(args);
    case 'get_suppliers_summary':
      return await getSuppliersSummary(args);
    case 'get_business_overview':
      return await getBusinessOverview({ userRole: user.role });
    case 'search_products_detail':
      return await searchProductsDetail(args);
    case 'search_customer_detail':
      return await searchCustomerDetail(args);
    case 'search_supplier_detail':
      return await searchSupplierDetail(args);
    case 'get_system_settings':
      return await getSystemSettingsData();
    case 'get_categories_list':
      return await getCategoriesList();
    case 'search_sale_invoices':
      return await searchSaleInvoices(args);
    case 'get_system_help': {
      const moduleKey = args.module || 'general';
      const mod = SYSTEM_KNOWLEDGE.modules[moduleKey] || SYSTEM_KNOWLEDGE.general;
      return { module: moduleKey, info: mod, faq: SYSTEM_KNOWLEDGE.faq };
    }
    case 'propose_add_product':
      return await prepareAddProduct(args, user);
    case 'propose_adjust_stock':
      return await prepareAdjustStock(args, user);
    case 'propose_customer_payment':
      return await prepareCustomerPayment(args, user);
    case 'propose_record_expense':
      return await prepareExpense(args, user);
    case 'propose_update_product':
      return await prepareUpdateProduct(args, user);
    case 'propose_record_purchase':
      return await preparePurchase(args, user);
    default:
      return { error: `Tool ${toolName} not found` };
  }
}

// ----------------------------------------------------------------
// Period detector: extract a time period from message + conversation
// ----------------------------------------------------------------
function detectPeriod(query, conversationHistory = []) {
  const q = (query || '').toLowerCase();

  // Current message period indicators
  if (/yesterday|shalay|shaly/i.test(q)) return 'yesterday';
  if (/last.?week|todobaadkii.?hore|toddobaadkii.?hore/i.test(q)) return 'last_week';
  if (/last.?month|bishii.?hore/i.test(q)) return 'last_month';
  if (/this.?week|todobaadkan|todobaad|toddobaad/i.test(q)) return 'this_week';
  if (/this.?month|bishan|bisha/i.test(q)) return 'this_month';
  if (/this.?year|sanadkan|sanad/i.test(q)) return 'this_year';
  if (/today|maanta|manta/i.test(q)) return 'today';

  // Multi-turn follow-up handling ("What about yesterday?", "and last week?")
  if (/what about|what.?about|ka waran|ka warran|iyo|immisa|sidee/i.test(q) && conversationHistory.length > 0) {
    if (/yesterday|shalay/i.test(q)) return 'yesterday';
    if (/last.?week|todobaadkii.?hore/i.test(q)) return 'last_week';
    if (/last.?month|bishii.?hore/i.test(q)) return 'last_month';
    if (/week|todobaad/i.test(q)) return 'this_week';
    if (/month|bishan/i.test(q)) return 'this_month';
    if (/year|sanad/i.test(q)) return 'this_year';

    // Infer from recent assistant response
    const recentBot = [...conversationHistory].reverse().find((m) => m.role === 'assistant');
    if (recentBot) {
      const prev = (recentBot.content || '').toLowerCase();
      if (/yesterday|shalay/i.test(prev)) return 'yesterday';
      if (/this week|todobaadkan/i.test(prev)) return 'this_week';
      if (/this month|bishan/i.test(prev)) return 'this_month';
    }
  }

  return 'today';
}

// ----------------------------------------------------------------
// Language detector (Somali vs English)
// ----------------------------------------------------------------
function detectIsSomali(text) {
  const q = (text || '').toLowerCase();
  return /\basc\b|\bsalaam\b|assalamu|sideed|iska warran|subax|galab|maanta|manta|shalay|shaly|fadlan|alaab|alab|alaabta|qalab|qalabka|faa.?iido|faaiido|faiido|iib|ib\b|iibiyay|iibiyey|iibisay|iibsaday|dayn|deyn|daymaha|deemaha|lacag|kharash|qarash|kharashaad|shaqaale|sidee|sida\b|keena|kayd|kaydka|soo.?iib|dalab|warbixin|todobaad|bishan|sanadkan|dukaan|macaamiil|shirkad|rasiidh|tallaabo|maxaa|waa maxay|kumaad|caasimad/i.test(
    q
  );
}

// ----------------------------------------------------------------
// General Knowledge & Math Solver
// ----------------------------------------------------------------
function evaluateMathExpression(query) {
  // Check for simple percentage calculations: "15% of 800" or "15% ee 800"
  const pctMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|ee)\s*(\d+(?:\.\d+)?)/i);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const total = parseFloat(pctMatch[2]);
    const result = (pct / 100) * total;
    return `${pct}% of ${total} = **${result.toFixed(2)}**`;
  }

  // Check for basic arithmetic: e.g. "what is 250 * 4" or "calculate 500 - 120"
  const mathMatch = query.match(/(?:what is|calculate|xisaabi|waa immisa|intee weeye)?\s*\(?(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\)?/i);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '*') res = a * b;
    else if (op === '/') res = b !== 0 ? a / b : 'Cannot divide by zero';

    const formatted = typeof res === 'number' ? res.toFixed(2).replace(/\.00$/, '') : res;
    return `🧮 **Calculation:**\n${a} ${op} ${b} = **${formatted}**`;
  }

  return null;
}

function matchGeneralKnowledge(query, isSomali) {
  const q = query.toLowerCase();

  // 1. Math calculation
  const mathResult = evaluateMathExpression(query);
  if (mathResult) {
    return { reply: mathResult, actionProposal: null };
  }

  // 2. Knowledge encyclopedia matching
  const entries = SYSTEM_KNOWLEDGE.generalKnowledge || [];
  for (const entry of entries) {
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) {
        return {
          reply: isSomali ? entry.so : entry.en,
          actionProposal: null,
        };
      }
    }
  }

  // 3. Additional world & tech facts
  if (/transistor|microcontroller|cpu|gpu|processor/i.test(q)) {
    return {
      reply: isSomali
        ? "💻 **Microprocessors & CPU:**\nCPU-ga (Central Processing Unit) waa maskaxda qalabka elektaroonigga ah, kaas oo fuliya awaamiirta barnaamijyada. Waxa uu ka kooban yahay malaayiin transistor yar-yar oo xakameeya socodka xogta."
        : "💻 **CPU & Microprocessors:**\nThe CPU (Central Processing Unit) is the electronic circuitry that executes instructions comprising computer software. Modern CPUs contain billions of microscopic transistors fabricated on silicon semiconductor chips.",
      actionProposal: null,
    };
  }

  if (/ac.*dc|dc.*ac|alternating current|direct current|korontada tooska/i.test(q)) {
    return {
      reply: isSomali
        ? "⚡ **Farqiga AC iyo DC:**\n- **DC (Direct Current):** Korontada tooska ah oo hal dhinac u socota (waxaa laga helaa baytariyada iyo cadceedda/solar).\n- **AC (Alternating Current):** Korontada wareegta ee jihadeedu isbeddesho (waa korontada guryaha iyo xafiisyada 220V)."
        : "⚡ **AC vs DC Current:**\n- **DC (Direct Current):** Unidirectional flow of electric charge, produced by batteries, solar panels, and DC power supplies.\n- **AC (Alternating Current):** Electric charge periodically reverses direction, used for high-voltage transmission and standard grid wall outlets (110V/220V).",
      actionProposal: null,
    };
  }

  return null;
}

// ----------------------------------------------------------------
// System How-To Guidance Matcher (All 17 modules)
// ----------------------------------------------------------------
function matchSystemHowTo(query, isSomali) {
  const q = query.toLowerCase();
  const isHowToQuery = /how.?to|sidee|sida\b|how.?do.?i|where.?can.?i|where.?do.?i|explain.*how|guide|habka|qaabka|tallaabo/i.test(q);

  if (!isHowToQuery) return null;

  const modules = SYSTEM_KNOWLEDGE.modules;

  // Products
  if (/add.*product|product.*add|alaab.*cusub|cusub.*alaab|new.*product|create.*product/i.test(q)) {
    const h = modules.products.howTo;
    return {
      reply: (isSomali ? "📦 **Tallaabooyinka lagu daro Alaab Cusub:**\n\n" + h.so.join("\n\n") : "📦 **How to Add a New Product:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Categories
  if (/categor|qayb|group/i.test(q)) {
    const h = modules.categories.howTo;
    return {
      reply: (isSomali ? "📁 **Tallaabooyinka Qaybaha Alaabta (Categories):**\n\n" + h.so.join("\n\n") : "📁 **How to Manage Categories:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Stock Adjustment
  if (/adjust|hagaajin|damaged|jabtay|lost|luntay|recount|stock.*manage/i.test(q)) {
    const h = modules.stock.howTo;
    return {
      reply: (isSomali ? "🔄 **Tallaabooyinka Hagaajinta Kaydka (Stock Adjustment):**\n\n" + h.so.join("\n\n") : "🔄 **How to Adjust Product Stock:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Sales / POS
  if (/sale|pos\b|iib\b|new.?sale|iib.?cusub|create.*sale/i.test(q)) {
    const h = modules.sales.howTo;
    return {
      reply: (isSomali ? "🛒 **Tallaabooyinka Iib Cusub lagu sameeyo (POS):**\n\n" + h.so.join("\n\n") : "🛒 **How to Create a New Sale in POS:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Sales History & Voiding
  if (/history|past.*sale|void|taariikh|reprint|daabac.*rasiidh/i.test(q)) {
    const h = modules.salesHistory.howTo;
    return {
      reply: (isSomali ? "📜 **Tallaabooyinka Taariikhda Iibka & Dib u daabacaadda:**\n\n" + h.so.join("\n\n") : "📜 **How to View Sales History & Reprint Receipts:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Receipts
  if (/receipt|rasiidh|invoice|thermal|print/i.test(q)) {
    const h = modules.receipts.howTo;
    return {
      reply: (isSomali ? "🧾 **Tallaabooyinka Daabacaadda Rasiidhada:**\n\n" + h.so.join("\n\n") : "🧾 **How to Print Receipts & Invoices:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Purchases
  if (/purchase|soo.?iib|supplier.*order|restock/i.test(q)) {
    const h = modules.purchases.howTo;
    return {
      reply: (isSomali ? "📦 **Tallaabooyinka Soo Iibsiga Alaabta (New Purchase):**\n\n" + h.so.join("\n\n") : "📦 **How to Record a Purchase from Supplier:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Customers
  if (/add.*customer|new.*customer|macaamiil.*cusub/i.test(q)) {
    const h = modules.customers.howTo;
    return {
      reply: (isSomali ? "👤 **Tallaabooyinka Diiwaangelinta Macaamiil Cusub:**\n\n" + h.so.join("\n\n") : "👤 **How to Add a Customer Profile:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Customer Debts & Debt Ledger
  if (/debt.*ledger|view.*debt|eeg.*dayn|daymaha/i.test(q)) {
    const h = modules.customerDebts.howTo;
    return {
      reply: (isSomali ? "💳 **Sida loo eego Daymaha Macaamiisha:**\n\n" + h.so.join("\n\n") : "💳 **How to View and Manage Customer Debts:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Customer Debt Payments
  if (/debt.*pay|payment|bixinta.?dayn|macaamiil.*lacag/i.test(q)) {
    const h = modules.customerPayments.howTo;
    return {
      reply: (isSomali ? "💳 **Tallaabooyinka Bixinta Daynta Macaamiilka:**\n\n" + h.so.join("\n\n") : "💳 **How to Record Customer Debt Payment:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Suppliers
  if (/supplier|shirkad|vendor/i.test(q)) {
    const h = modules.suppliers.howTo;
    return {
      reply: (isSomali ? "🏭 **Tallaabooyinka Maamulka Shirkadaha Alaabta (Suppliers):**\n\n" + h.so.join("\n\n") : "🏭 **How to Manage Suppliers and Supplier Payments:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Expenses
  if (/expense|kharash|qarash|biil/i.test(q)) {
    const h = modules.expenses.howTo;
    return {
      reply: (isSomali ? "💸 **Tallaabooyinka Diiwaangelinta Kharashka:**\n\n" + h.so.join("\n\n") : "💸 **How to Record an Operating Expense:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Reports
  if (/report|warbixin|export|pdf|excel/i.test(q)) {
    const h = modules.reports.howTo;
    return {
      reply: (isSomali ? "📊 **Tallaabooyinka Soo Saaridda Warbixinada:**\n\n" + h.so.join("\n\n") : "📊 **How to Generate and Export Business Reports:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Profit Report
  if (/profit|faa.?iido/i.test(q)) {
    const h = modules.profitReport.howTo;
    return {
      reply: (isSomali ? "📈 **Sida loo eego Warbixinta Faa'iidada (Admin kaliya):**\n\n" + h.so.join("\n\n") : "📈 **How to Access Profit & Margins (Admin Only):**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Users
  if (/user|shaqaale|password|furaha/i.test(q)) {
    const h = modules.users.howTo;
    return {
      reply: (isSomali ? "👥 **Tallaabooyinka Maamulka Shaqaalaha & Furaha (Admin kaliya):**\n\n" + h.so.join("\n\n") : "👥 **How to Manage Users & Staff Logins (Admin Only):**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Settings
  if (/setting|habayn|store.*name|logo/i.test(q)) {
    const h = modules.settings.howTo;
    return {
      reply: (isSomali ? "⚙️ **Tallaabooyinka Habaynta Nidaamka (Settings):**\n\n" + h.so.join("\n\n") : "⚙️ **How to Configure Store Settings & Receipt Branding:**\n\n" + h.en.join("\n\n")),
      actionProposal: null,
    };
  }

  // Overall system overview guide
  return {
    reply: isSomali
      ? `🔮 **Nidaamka JILE Electronics wuxuu ka kooban yahay qaybahan:**\n\n` +
        `1. **Dashboard** — Xogta maanta & jaantusyada koboca\n` +
        `2. **Products** — Maamulka alaabta, qiimaha, iyo SKU\n` +
        `3. **Categories** — Qaybaha alaabta\n` +
        `4. **Stock Management** — Kaydka & hagaajinta\n` +
        `5. **Sales (POS)** — Iibka cusub, qiimo-dhimista, daynta\n` +
        `6. **Sales History** — Rasiidhadii hore & dib u daabacaad\n` +
        `7. **Receipts** — Daabacaadda rasiidhada thermal & A4\n` +
        `8. **Purchases** — Soo iibsashada qalabka cusub ee shirkadaha\n` +
        `9. **Customers** — Macaamiisha & macluumaadkooda\n` +
        `10. **Customer Debts** — Liiska daymaha dibadda ku maqan\n` +
        `11. **Customer Payments** — Bixinta daymaha macaamiisha (FIFO)\n` +
        `12. **Suppliers** — Shirkadaha alaabta laga keeno & xisaabtooda\n` +
        `13. **Expenses** — Kharashaadka dukaanka (Kirada, Korontada, Mushaarka)\n` +
        `14. **Reports** — Warbixinada maaliyadeed (PDF/Excel)\n` +
        `15. **Profit Report** — Faa'iidada dhabta ah (Admin kaliya)\n` +
        `16. **Users** — Maamulka shaqaalaha (Admin kaliya)\n` +
        `17. **Settings** — Magaca dukaanka, taleefanka, astaanta\n\n` +
        `*Fadlan i weydii tallaabooyinka qaybta aad doonayso inaad barato!*`
      : `🔮 **JILE Electronics System Modules:**\n\n` +
        `1. **Dashboard** — Live business KPI overview & sales trends\n` +
        `2. **Products** — Product catalog, pricing, SKUs, min stock\n` +
        `3. **Categories** — Group products by type\n` +
        `4. **Stock Management** — Movement audit trail & stock adjustments\n` +
        `5. **Sales (POS)** — Fast checkout, line discounts, walk-in or credit sales\n` +
        `6. **Sales History** — Past invoices, filters, receipt reprints\n` +
        `7. **Receipts** — Formatted thermal (80mm) and standard A4 receipts\n` +
        `8. **Purchases** — Supplier restocking & tracking balances due\n` +
        `9. **Customers** — Profiles, contact details, total purchases\n` +
        `10. **Customer Debts** — Outstanding receivables and debtor list\n` +
        `11. **Customer Payments** — Repayment recording with automated FIFO allocation\n` +
        `12. **Suppliers** — Vendor accounts and balances\n` +
        `13. **Expenses** — Operating costs (Rent, Electricity, Salary, etc.)\n` +
        `14. **Reports** — Financial analytics with PDF/Excel export\n` +
        `15. **Profit Report** — Gross & net profit margins per sale (Admin only)\n` +
        `16. **Users** — Employee accounts & access control (Admin only)\n` +
        `17. **Settings** — Store details, currency, logo, and receipt prefix\n\n` +
        `*Ask me step-by-step instructions for any module!*`,
    actionProposal: null,
  };
}

// ----------------------------------------------------------------
// Action Staging & Confirmation Handler
// ----------------------------------------------------------------
async function handleActionStaging(query, isSomali, user) {
  const q = query.toLowerCase();

  // 1. Add Product
  if (/add.*product|create.*product|diiwaangeli.*alaab|ku dar.*alaab/i.test(q)) {
    // Check if required parameters are present in query: name, price
    const priceMatch = q.match(/(?:price|selling price|qiimaha)\s*(?:is|:|\=)?\s*\$?(\d+(?:\.\d+)?)/i);
    const nameMatch = q.match(/(?:product|name|magaca)\s*(?:is|:|\=)?\s*["']?([^,"'\$\n]+?)["']?(?:\s*(?:price|sku|category|$))/i);

    if (!priceMatch || !nameMatch) {
      return {
        reply: isSomali
          ? "📝 **Ku darista Alaab Cusub:**\nFadlan i sii faahfaahinta alaabta si aan kuugu diyaariyo kaarka ogolaanshaha:\n- **Magaca Alaabta:** (tusaale 'Samsung Galaxy S24')\n- **Qiimaha Iibka:** (tusaale $800)\n- **Qiimaha Soo Iibsiga:** (tusaale $650)\n- **Qaybta (Category):** (tusaale 'Smartphones')"
          : "📝 **Add New Product Request:**\nPlease provide the required product details so I can stage the confirmation card for you:\n- **Product Name** (e.g., 'Samsung Galaxy S24')\n- **Selling Price** (e.g., $800)\n- **Purchase/Cost Price** (e.g., $650)\n- **Category** (e.g., 'Smartphones')",
        actionProposal: null,
      };
    }

    const name = nameMatch[1].trim();
    const sellingPrice = parseFloat(priceMatch[1]);
    const purchasePrice = sellingPrice * 0.8; // estimation if omitted
    const sku = `SKU-${Date.now().toString().slice(-6)}`;

    const proposal = await prepareAddProduct(
      {
        name,
        sellingPrice,
        purchasePrice,
        sku,
        category: 'Electronics',
        minStock: 5,
        initialStock: 0,
      },
      user
    );

    return {
      reply: isSomali
        ? `📋 **Waxaan kuu diyaariyay diiwaangelinta alaabta "${name}":**\n` +
          `- **Qiimaha Iibka:** $${sellingPrice.toFixed(2)}\n` +
          `- **SKU:** ${sku}\n\n` +
          `⚠️ **Fadlan xaqiiji:** Guji badhanka **"Confirm & Execute"** ee kaarka hoose si loo kaydiyo.`
        : `📋 **I have prepared the proposal to add "${name}":**\n` +
          `- **Selling Price:** $${sellingPrice.toFixed(2)}\n` +
          `- **SKU:** ${sku}\n\n` +
          `⚠️ **Please confirm:** Review the preview card below and click **"Confirm & Execute"** to save this product to inventory.`,
      actionProposal: proposal,
    };
  }

  // 2. Record Expense
  if (/record.*expense|add.*expense|qor.*kharash|diiwaangeli.*kharash/i.test(q)) {
    const amountMatch = q.match(/\$?(\d+(?:\.\d+)?)/);
    const catMatch = q.match(/rent|electricity|transport|salary|internet|koronto|kiro|mushaar|gaadiid/i);

    if (!amountMatch) {
      return {
        reply: isSomali
          ? "💸 **Diiwaangelinta Kharashka:**\nFadlan sheeg cadadka lacagta iyo nooca kharashka (tusaale: 'Diiwaangeli $50 kharashka korontada')."
          : "💸 **Record Business Expense:**\nPlease specify the amount and category of the expense (e.g., 'Record $50 electricity expense').",
        actionProposal: null,
      };
    }

    const amount = parseFloat(amountMatch[1]);
    let category = 'Other';
    if (/electricity|koronto/i.test(q)) category = 'Electricity';
    else if (/rent|kiro/i.test(q)) category = 'Rent';
    else if (/salary|mushaar/i.test(q)) category = 'Salary';
    else if (/transport|gaadiid/i.test(q)) category = 'Transport';
    else if (/internet/i.test(q)) category = 'Internet';

    const proposal = await prepareExpense(
      {
        name: `${category} Bill`,
        category,
        amount,
        description: 'AI-assisted expense entry',
      },
      user
    );

    return {
      reply: isSomali
        ? `📋 **Waxaan kuu diyaariyay diiwaangelinta kharashka:**\n` +
          `- **Qaybta:** ${category}\n` +
          `- **Cadadka:** $${amount.toFixed(2)}\n\n` +
          `⚠️ **Fadlan xaqiiji:** Guji badhanka **"Confirm & Execute"** si aad u xaqiijiso kharashkan.`
        : `📋 **I have prepared the expense entry:**\n` +
          `- **Category:** ${category}\n` +
          `- **Amount:** $${amount.toFixed(2)}\n\n` +
          `⚠️ **Please confirm:** Review the card below and click **"Confirm & Execute"** to deduct this expense from store calculations.`,
      actionProposal: proposal,
    };
  }

  // 3. Customer Debt Payment
  if (/record.*payment|customer.*payment|lacag.*qabo|bixi.*dayn/i.test(q)) {
    const amountMatch = q.match(/\$?(\d+(?:\.\d+)?)/);
    if (!amountMatch) {
      return {
        reply: isSomali
          ? "💳 **Bixinta Daynta:**\nFadlan sheeg magaca macaamiilka iyo cadadka lacagta la bixinayo (tusaale: 'Diiwaangeli $100 oo uu bixiyay Maxamed')."
          : "💳 **Record Debt Repayment:**\nPlease specify the customer's name and payment amount (e.g., 'Record $100 payment from Ali').",
        actionProposal: null,
      };
    }
  }

  return null;
}

// ----------------------------------------------------------------
// Specific Business Entity Lookup Matcher
// ----------------------------------------------------------------
async function matchEntityLookup(query, isSomali) {
  const q = query.toLowerCase().trim();

  // 1. Specific Product Stock/Price Inquiry: "Do we have iPhone?", "price of Dell laptop", "check stock of..."
  const prodMatch = q.match(/(?:do we have|price of|cost of|check stock of|how much is|search product|ma haysaan|waa imisa|qiimaha|immisa xabbo|alaabta)\s+["']?([^?\.,!]+)["']?/i);
  if (prodMatch && !/sale|sales|today|yesterday|week|month|profit|debt|expense|purchase|supplier|customer|user|setting|report/i.test(prodMatch[1].trim())) {
    const searchTerm = prodMatch[1].replace(/^(a|an|the|this|that|in stock|available)\s+/i, '').trim();
    if (searchTerm.length >= 2) {
      const result = await searchProductsDetail({ query: searchTerm, limit: 6 });
      if (result.count > 0) {
        const items = result.products
          .map(
            (p) =>
              `  • **${p.name}** (SKU: \`${p.sku}\`) — Stock: **${p.currentStock} pcs** [${p.status}] | Price: **$${p.sellingPrice.toFixed(2)}** | Category: ${p.category}`
          )
          .join('\n');

        return {
          reply: isSomali
            ? `📦 **Alaabta ku habboon baaritaankaaga ("${searchTerm}"):**\n${items}\n\n*Haddii aad rabto inaad iibiso ama kaydka wax ka beddesho, i weydii!*`
            : `📦 **Products matching "${searchTerm}":**\n${items}\n\n*Let me know if you would like to adjust stock levels or stage a price change.*`,
          actionProposal: null,
        };
      } else {
        return {
          reply: isSomali
            ? `🔍 **Ma helin wax alaab ah oo magaceeda ama SKU-geeda uu yahay "${searchTerm}".**\nFadlan hubi higgaadda ama tag qaybta "Products" si aad ugu darto alaab cusub.`
            : `🔍 **No products found matching "${searchTerm}".**\nPlease check the spelling or go to "Products" -> "Add Product" to add it to inventory.`,
          actionProposal: null,
        };
      }
    }
  }

  // 2. Specific Customer Debt Lookup: "Does Mohamed owe money?", "debt for Ali", "how much does Ahmed owe?"
  const custMatch = q.match(/(?:debt of|does|how much does|unpaid balance for|daynta|immisa ayaa lagu leeyahay)\s+([a-zA-Z0-9\s]+?)(?:\s+owe|\s+have|\?|$)/i);
  if (custMatch && !/customer|we|i|store|dukaan/i.test(custMatch[1].trim())) {
    const custName = custMatch[1].trim();
    if (custName.length >= 2) {
      const result = await searchCustomerDetail({ query: custName, limit: 3 });
      if (result.count > 0) {
        const debtors = result.customers
          .map(
            (c) =>
              `  • **${c.name}** (${c.phone}) — Outstanding Debt: **$${c.totalDebt.toFixed(2)}** | Total Purchases: $${c.totalPurchases.toFixed(2)} [Status: ${c.debtStatus}]`
          )
          .join('\n');

        return {
          reply: isSomali
            ? `👤 **Xogta Macaamiilka ("${custName}"):**\n${debtors}`
            : `👤 **Customer Debt Lookup for "${custName}":**\n${debtors}`,
          actionProposal: null,
        };
      }
    }
  }

  // 3. System Settings Inquiry
  if (/store.*name|store.*phone|store.*address|currency.*symbol|system.*setting|cinwaanka.*dukaanka|magaca.*dukaanka/i.test(q)) {
    const s = await getSystemSettingsData();
    return {
      reply: isSomali
        ? `⚙️ **Macluumaadka Nidaamka & Dukaanka (Settings):**\n` +
          `- **Magaca Dukaanka:** ${s.storeName}\n` +
          `- **Taleefanka:** ${s.phone || 'Lama galin'}\n` +
          `- **Email-ka:** ${s.email || 'Lama galin'}\n` +
          `- **Cinwaanka:** ${s.address || 'Mogadishu, Somalia'}\n` +
          `- **Calaamadda Lacagta:** ${s.currency}\n` +
          `- **Rasiidhada Prefix:** ${s.invoicePrefix}`
        : `⚙️ **Store & System Configuration:**\n` +
          `- **Store Name:** ${s.storeName}\n` +
          `- **Phone:** ${s.phone || 'Not set'}\n` +
          `- **Email:** ${s.email || 'Not set'}\n` +
          `- **Address:** ${s.address || 'Mogadishu, Somalia'}\n` +
          `- **Currency:** ${s.currency}\n` +
          `- **Invoice Prefix:** ${s.invoicePrefix}`,
      actionProposal: null,
    };
  }

  // 4. Categories list inquiry
  if (/list.*categor|show.*categor|qaybaha.*alaabta|noocyada.*alaabta/i.test(q)) {
    const cats = await getCategoriesList();
    const list = cats.categories.length
      ? cats.categories.map((c) => `  • **${c.name}** (${c.productCount} products)`).join('\n')
      : (isSomali ? '  • Qayb ma diiwaangashana' : '  • No categories registered');

    return {
      reply: isSomali
        ? `📁 **Qaybaha Alaabta Dukaanka (${cats.count}):**\n${list}`
        : `📁 **Product Categories (${cats.count}):**\n${list}`,
      actionProposal: null,
    };
  }

  return null;
}

// ----------------------------------------------------------------
// Intelligent Local NLU Fallback Engine
// Activates when cloud APIs are missing, invalid, or over quota.
// ----------------------------------------------------------------
async function fallbackLocalEngine(userMessage, conversationHistory = [], user) {
  const query = (userMessage || '').trim();
  const q = query.toLowerCase();
  const isSomali = detectIsSomali(query);
  const period = detectPeriod(query, conversationHistory);

  // 1. GREETINGS & ASSISTANT IDENTITY
  if (/^(hi|hello|hey|asc|salaam|assalamu|subax|galab|good morning|good afternoon|good evening|who are you|kumaad|maxaad qaban)/i.test(q) && q.length < 40) {
    return {
      reply: isSomali
        ? `👋 **Asc! Ku soo dhowow Kaaliyaha Garaadka ee JILE Electronics!**\n\n` +
          `Waxaan ahay kaaliyaha dukaankaaga ee ku xiran xogta tooska ah ee MongoDB. Waxaan diyaar u ahay inaan kaaga jawaabo su'aal kasta oo ku saabsan:\n` +
          `• 🛒 **Iibka & Rasiidhada** (tusaale, "Immisa ayaan iibiyay maanta?")\n` +
          `• 📦 **Alaabta & Kaydka** (tusaale, "Do we have iPhone?" ama "Alaabta dhamatay")\n` +
          `• 💳 **Daymaha Macaamiisha** (tusaale, "Yaa lacag igu leh?")\n` +
          `• 📈 **Faa'iidada Dhabta ah** (Admin kaliya: "Faa'iidada bishan")\n` +
          `• ⚙️ **Sida loo isticmaalo nidaamka** (tusaale, "Sidee iib cusub loo sameeyaa?")\n` +
          `• ⚡ **Aqoonta guud & Qalabka elektaroonigga** (tusaale, "Waa maxay Ohm's law?")\n\n` +
          `Sideen kuu caawin karaa maanta?`
        : `👋 **Hello! Welcome to JILE Electronics AI Assistant!**\n\n` +
          `I am your intelligent shop management assistant connected directly to live MongoDB data. I can help you with:\n` +
          `• 🛒 **Sales & Receipts** (e.g., "How much did I sell today?")\n` +
          `• 📦 **Inventory & Products** (e.g., "Do we have iPhone 15?" or "Low stock items")\n` +
          `• 💳 **Customer Debts** (e.g., "Who owes money to the store?")\n` +
          `• 📈 **Profit & Margins** (Admin only: "Show me this month's profit")\n` +
          `• ⚙️ **Step-by-step System Guides** (e.g., "How do I create a new sale in POS?")\n` +
          `• ⚡ **General Electronics & Knowledge** (e.g., "What is Ohm's law?")\n\n` +
          `How can I assist you right now?`,
      actionProposal: null,
    };
  }

  // 2. GENERAL KNOWLEDGE & MATH EVALUATION
  const gkResult = matchGeneralKnowledge(query, isSomali);
  if (gkResult) return gkResult;

  // 3. SYSTEM HOW-TO GUIDES (All 17 modules)
  const howToResult = matchSystemHowTo(query, isSomali);
  if (howToResult) return howToResult;

  // 4. ACTION PROPOSALS & MUTATIONS (Create, Update, Adjust with confirmation)
  const actionResult = await handleActionStaging(query, isSomali, user);
  if (actionResult) return actionResult;

  // 5. SPECIFIC ENTITY LOOKUPS (Specific product, customer debt, supplier, invoice, settings, categories)
  const entityResult = await matchEntityLookup(query, isSomali);
  if (entityResult) return entityResult;

  // 6. BUSINESS DATA QUERIES (Using actual MongoDB metrics)

  // ---- (a) PROFIT METRICS ----
  if (/profit|faa.?iido|faaiido|faiido|margin|net.?profit|gross.?profit/i.test(q)) {
    if (user.role !== 'admin') {
      return {
        reply: isSomali
          ? "⚠️ **Ogeysiis Ogolaansho:** Kuma lihid ogolaansho inaad aragto xogta faa'iidada (Profit Report). Kaliya maamulaha nidaamka (Admin) ayaa loo oggol yahay."
          : "⚠️ **Permission Denied:** Profit reports are restricted to Administrator accounts only. Please contact your store administrator.",
        actionProposal: null,
      };
    }

    const profit = await getProfitMetrics({ period, userRole: user.role });
    if (!profit.authorized) {
      return { reply: profit.error, actionProposal: null };
    }

    const reply = isSomali
      ? `📊 **Xisaabinta Faa'iidada — ${profit.period}:**\n` +
        `- **Wadarta Iibka (Revenue):** $${profit.totalRevenue.toFixed(2)}\n` +
        `- **Qiimaha Alaabtu ku soo gashay (COGS):** $${profit.costOfGoodsSold.toFixed(2)}\n` +
        `- **Faa'iidada Guud (Gross Profit):** $${profit.grossProfit.toFixed(2)}\n` +
        `- **Kharashaadka Dukaanka (Expenses):** $${profit.totalExpenses.toFixed(2)}\n` +
        `- **Faa'iidada Dhabta ah (Net Profit):** $${profit.netProfit.toFixed(2)}\n` +
        `- **Heerka Faa'iidada (Net Margin):** ${profit.netProfitMarginPercent}%\n\n` +
        `*Net Profit = Gross Profit minus all operating expenses for this period.*`
      : `📊 **Profit Breakdown — ${profit.period}:**\n` +
        `- **Total Revenue:** $${profit.totalRevenue.toFixed(2)}\n` +
        `- **Cost of Goods Sold (COGS):** $${profit.costOfGoodsSold.toFixed(2)}\n` +
        `- **Gross Profit:** $${profit.grossProfit.toFixed(2)}\n` +
        `- **Operating Expenses:** $${profit.totalExpenses.toFixed(2)}\n` +
        `- **Net Profit:** $${profit.netProfit.toFixed(2)}\n` +
        `- **Net Profit Margin:** ${profit.netProfitMarginPercent}%\n\n` +
        `*Net Profit = Gross Profit minus all operating expenses for this period.*`;

    return { reply, actionProposal: null };
  }

  // ---- (b) SALES / REVENUE ----
  if (/\bsale|iib|revenue|lacagta iibka|\bsold\b|immisa ayaan|how much did i sell|best.?sell|alaabta.*iibka/i.test(q)) {
    const sales = await getSalesMetrics({ period });
    const topList = sales.topProducts.length
      ? sales.topProducts.map((p) => `  • **${p.productName}** — ${p.quantity} pcs / $${p.revenue.toFixed(2)}`).join('\n')
      : (isSomali ? '  • Wax iib ah lama diiwaangelin muddadan' : '  • No items sold in this period');

    const reply = isSomali
      ? `🛒 **Warbixinta Iibka — ${sales.period}:**\n` +
        `- **Wadarta Guud ee Iibka:** $${sales.totalRevenue.toFixed(2)}\n` +
        `- **Tirada Rasiidhada:** ${sales.salesCount}\n` +
        `- **Lacagta Caddaanka ah ee la qabtay:** $${sales.totalPaid.toFixed(2)}\n` +
        `- **Daynta Cusub ee dhalatay:** $${sales.totalDebt.toFixed(2)}\n` +
        `- **Qiimo Dhimista la bixiyay:** $${sales.totalDiscount.toFixed(2)}\n\n` +
        `🔥 **Alaabta ugu Iibka Badan:**\n${topList}`
      : `🛒 **Sales Summary — ${sales.period}:**\n` +
        `- **Total Revenue:** $${sales.totalRevenue.toFixed(2)}\n` +
        `- **Number of Transactions:** ${sales.salesCount}\n` +
        `- **Amount Collected (Cash):** $${sales.totalPaid.toFixed(2)}\n` +
        `- **New Debts Created:** $${sales.totalDebt.toFixed(2)}\n` +
        `- **Discounts Given:** $${sales.totalDiscount.toFixed(2)}\n\n` +
        `🔥 **Top Selling Products:**\n${topList}`;

    return { reply, actionProposal: null };
  }

  // ---- (c) PURCHASES / RESTOCKING ----
  if (/purchase|soo.?iibsi|soo.?iibsasho|dalab.*shirkad|restoc|shipment/i.test(q)) {
    const { Purchase } = require('../models');
    const { startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } = require('../utils/dateRange');
    const { roundMoney } = require('../utils/money');

    const now = new Date();
    let from, to, label;
    if (period === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      label = 'Yesterday';
    } else if (period === 'this_week') {
      from = startOfWeek(now);
      to = endOfDay(now);
      label = 'This Week';
    } else if (period === 'this_month') {
      from = startOfMonth(now);
      to = endOfDay(now);
      label = 'This Month';
    } else if (period === 'this_year') {
      from = startOfYear(now);
      to = endOfDay(now);
      label = 'This Year';
    } else {
      from = startOfDay(now);
      to = endOfDay(now);
      label = 'Today';
    }

    const purchases = await Purchase.find({ date: { $gte: from, $lte: to } })
      .populate('supplier', 'name company')
      .sort({ date: -1 })
      .limit(8);

    const total = roundMoney(purchases.reduce((s, p) => s + p.total, 0));
    const paid = roundMoney(purchases.reduce((s, p) => s + p.paid, 0));
    const remaining = roundMoney(purchases.reduce((s, p) => s + p.remaining, 0));

    const purchaseList = purchases.length
      ? purchases.map((p) => `  • **${p.invoiceNumber}** — ${p.supplier?.name || 'Unknown'} — $${p.total.toFixed(2)} [${p.paymentStatus}]`).join('\n')
      : (isSomali ? '  • Wax dalab ah lama diiwaangelin muddadan' : '  • No purchases recorded in this period');

    const reply = isSomali
      ? `📦 **Warbixinta Soo Iibsashada — ${label}:**\n` +
        `- **Wadarta Soo Iibsashada:** $${total.toFixed(2)}\n` +
        `- **Lacagta la bixiyay Shirkadaha:** $${paid.toFixed(2)}\n` +
        `- **Haraaga Daynta Shirkadaha:** $${remaining.toFixed(2)}\n` +
        `- **Tirada Dalabada:** ${purchases.length}\n\n` +
        `📋 **Dalabada Ugu Dambeeyay:**\n${purchaseList}`
      : `📦 **Purchase Summary — ${label}:**\n` +
        `- **Total Purchases Value:** $${total.toFixed(2)}\n` +
        `- **Amount Paid to Suppliers:** $${paid.toFixed(2)}\n` +
        `- **Remaining Balance Due:** $${remaining.toFixed(2)}\n` +
        `- **Number of Orders:** ${purchases.length}\n\n` +
        `📋 **Recent Purchase Orders:**\n${purchaseList}`;

    return { reply, actionProposal: null };
  }

  // ---- (d) SUPPLIERS ----
  if (/supplier|shirkad|vendor|amaah.*shirkad|supplier.*balance/i.test(q)) {
    const suppData = await getSuppliersSummary({ limit: 10 });
    const suppList = suppData.suppliers.length
      ? suppData.suppliers.map((s) => `  • **${s.name}** (${s.company || '-'}) — Due: **$${s.amountDue.toFixed(2)}** / Paid: $${s.amountPaid.toFixed(2)}`).join('\n')
      : (isSomali ? '  • Ma jiro shirkad diiwaangashan' : '  • No suppliers found');

    const reply = isSomali
      ? `🏭 **Warbixinta Shirkadaha Alaabta (Suppliers):**\n` +
        `- **Wadarta Shirkadaha:** ${suppData.totalSuppliers}\n` +
        `- **Wadarta Daynta lagu leeyahay Shirkadaha:** $${suppData.totalAmountDueToSuppliers.toFixed(2)}\n\n` +
        `📋 **Liiska Shirkadaha:**\n${suppList}`
      : `🏭 **Suppliers Overview:**\n` +
        `- **Total Suppliers:** ${suppData.totalSuppliers}\n` +
        `- **Total Amount Due to Suppliers:** $${suppData.totalAmountDueToSuppliers.toFixed(2)}\n\n` +
        `📋 **Supplier Accounts:**\n${suppList}`;

    return { reply, actionProposal: null };
  }

  // ---- (e) INVENTORY / STOCK ----
  if (/\bstock\b|stok|kayd|inventory|out.?of.?stock|low.?stock|dhamatay|dhamaatay|yaratahay|yartahay/i.test(q)) {
    let filter = 'all';
    if (/out.?of.?stock|dhamatay|dhamaatay|zero/i.test(q)) filter = 'out_of_stock';
    else if (/low.?stock|yaratahay|yartahay|warning/i.test(q)) filter = 'low_stock';

    const inv = await getInventoryStatus({ filter, limit: 12 });
    const prodList = inv.products.length
      ? inv.products.map((p) => `  • **${p.name}** (\`${p.sku}\`) — Stock: **${p.currentStock} pcs** | Min: ${p.minStock} | $${p.sellingPrice.toFixed(2)} [${p.status}]`).join('\n')
      : (isSomali ? '  • Wax alaab ah kuma jiraan shaandhayntan' : '  • No matching products');

    const reply = isSomali
      ? `📦 **Xogta Kaydka & Alaabta:**\n` +
        `- **Wadarta Noocyada:** ${inv.totalProducts}\n` +
        `- **Alaabta Dhamatay (0 kayd):** ${inv.outOfStockCount}\n` +
        `- **Alaabta Digniinta (Low Stock):** ${inv.lowStockCount}\n` +
        `- **Qiimaha Guud ee Kaydka:** $${inv.totalInventoryValue.toFixed(2)}\n\n` +
        `📋 **Liiska Alaabta:**\n${prodList}`
      : `📦 **Inventory Status:**\n` +
        `- **Total Active Products:** ${inv.totalProducts}\n` +
        `- **Out of Stock:** ${inv.outOfStockCount}\n` +
        `- **Low Stock Warnings:** ${inv.lowStockCount}\n` +
        `- **Total Inventory Value:** $${inv.totalInventoryValue.toFixed(2)}\n\n` +
        `📋 **Products:**\n${prodList}`;

    return { reply, actionProposal: null };
  }

  // ---- (f) STOCK MOVEMENTS ----
  if (/stock.?move|dhaqdhaqaaq|stock.?histor|stock.?log/i.test(q)) {
    const periodMap = { today: 'today', yesterday: 'today', this_week: 'this_week', this_month: 'this_month', this_year: 'this_year' };
    const smPeriod = periodMap[period] || 'this_week';
    const movements = await getStockMovements({ period: smPeriod, limit: 12 });

    const mvList = movements.movements.length
      ? movements.movements.map((m) => `  • [${m.type.toUpperCase()}] **${m.productName}** — ${m.quantity} pcs | Reason: ${m.reason} | Ref: ${m.referenceNumber || '-'}`).join('\n')
      : (isSomali ? '  • Wax dhaqdhaqaaq ah ma jiro' : '  • No stock movements recorded');

    const reply = isSomali
      ? `🔄 **Dhaqdhaqaaqa Kaydka — ${movements.period}:**\n- **Tirada Dhaqdhaqaaqa:** ${movements.count}\n\n📋 **Liiska:**\n${mvList}`
      : `🔄 **Stock Movements — ${movements.period}:**\n- **Total Movements:** ${movements.count}\n\n📋 **Log:**\n${mvList}`;

    return { reply, actionProposal: null };
  }

  // ---- (g) CUSTOMER DEBTS ----
  if (/\bdebt|dayn|deyn|daymaha|deemaha|debtors|who.?owes?|unpaid.*cust|lacag.*maqan/i.test(q)) {
    const debts = await getCustomerDebts({ limit: 10 });
    const debtorList = debts.debtors.length
      ? debts.debtors.map((d) => `  • **${d.name}** (${d.phone || 'No phone'}) — **$${d.totalDebt.toFixed(2)}** [${d.debtStatus}]`).join('\n')
      : (isSomali ? '  • Ma jiraan macaamiil dayn lagu leeyahay' : '  • No customers with outstanding debt');

    const reply = isSomali
      ? `💳 **Xisaabta Daymaha Macaamiisha:**\n` +
        `- **Tirada Macaamiisha Daynta leh:** ${debts.totalDebtorsCount}\n` +
        `- **Wadarta Daynta Dibadda ku maqan:** $${debts.totalOutstandingDebt.toFixed(2)}\n\n` +
        `👤 **Macaamiisha Daynta leh:**\n${debtorList}`
      : `💳 **Customer Debts Overview:**\n` +
        `- **Total Debtors:** ${debts.totalDebtorsCount} customers\n` +
        `- **Total Outstanding Balance:** $${debts.totalOutstandingDebt.toFixed(2)}\n\n` +
        `👤 **Debtors List:**\n${debtorList}`;

    return { reply, actionProposal: null };
  }

  // ---- (h) EXPENSES ----
  if (/expense|kharash|qarash|expenses|biil/i.test(q)) {
    const exp = await getExpensesSummary({ period });
    const catBreakdown = Object.entries(exp.breakdownByCategory)
      .map(([cat, amt]) => `  • ${cat}: **$${amt.toFixed(2)}**`)
      .join('\n') || (isSomali ? '  • Ma jiro kharash qayb ahaan' : '  • No category breakdown');

    const reply = isSomali
      ? `💸 **Kharashaadka — ${exp.period}:**\n` +
        `- **Wadarta Kharashka:** $${exp.totalAmount.toFixed(2)}\n` +
        `- **Tirada Diiwaanka:** ${exp.expensesCount}\n\n` +
        `📁 **Qayb ahaan:**\n${catBreakdown}`
      : `💸 **Business Expenses — ${exp.period}:**\n` +
        `- **Total Amount:** $${exp.totalAmount.toFixed(2)}\n` +
        `- **Records Count:** ${exp.expensesCount}\n\n` +
        `📁 **By Category:**\n${catBreakdown}`;

    return { reply, actionProposal: null };
  }

  // ---- (i) SUMMARY REPORT ----
  if (/report|warbixin|summary|overview|guudmar/i.test(q)) {
    const reportPeriod = /month|bishan/i.test(q) ? 'this_month'
      : /year|sanad/i.test(q) ? 'this_year'
      : /week|todobaad/i.test(q) ? 'this_week'
      : 'today';

    const [sales, expenses, debts, inv] = await Promise.all([
      getSalesMetrics({ period: reportPeriod }),
      getExpensesSummary({ period: reportPeriod }),
      getCustomerDebts({ limit: 5 }),
      getInventoryStatus({ filter: 'all', limit: 3 }),
    ]);

    const reply = isSomali
      ? `📊 **Warbixinta Ganacsiga — ${sales.period}**\n\n` +
        `**💰 IIBKA:**\n` +
        `- Wadarta Guud: **$${sales.totalRevenue.toFixed(2)}** (${sales.salesCount} rasiidh)\n` +
        `- Caddaanka: $${sales.totalPaid.toFixed(2)} | Daynta cusub: $${sales.totalDebt.toFixed(2)}\n\n` +
        `**💸 KHARASHAADKA:**\n` +
        `- Wadarta: **$${expenses.totalAmount.toFixed(2)}** (${expenses.expensesCount} diiwaano)\n\n` +
        `**💳 DAYMAHA:**\n` +
        `- Macaamiil dayn leh: ${debts.totalDebtorsCount} | Wadarta Daynta: $${debts.totalOutstandingDebt.toFixed(2)}\n\n` +
        `**📦 KAYDKA:**\n` +
        `- Noocyada Alaabta: ${inv.totalProducts} | Dhamatay: ${inv.outOfStockCount} | Digniin: ${inv.lowStockCount}`
      : `📊 **Business Performance Report — ${sales.period}**\n\n` +
        `**💰 SALES:**\n` +
        `- Total Revenue: **$${sales.totalRevenue.toFixed(2)}** (${sales.salesCount} orders)\n` +
        `- Cash Collected: $${sales.totalPaid.toFixed(2)} | New Debt: $${sales.totalDebt.toFixed(2)}\n\n` +
        `**💸 EXPENSES:**\n` +
        `- Total: **$${expenses.totalAmount.toFixed(2)}** (${expenses.expensesCount} records)\n\n` +
        `**💳 CUSTOMER DEBTS:**\n` +
        `- Active Debtors: ${debts.totalDebtorsCount} | Balance: $${debts.totalOutstandingDebt.toFixed(2)}\n\n` +
        `**📦 INVENTORY:**\n` +
        `- Catalog: ${inv.totalProducts} items | Out of stock: ${inv.outOfStockCount} | Low stock: ${inv.lowStockCount}`;

    return { reply, actionProposal: null };
  }

  // 7. AMBIGUOUS / UNCLEAR INPUT HANDLING
  // NEVER output a generic welcome dashboard when the user asked a question!
  return {
    reply: isSomali
      ? `❓ **Waan fahmi waayay su'aashaada ("${query}").**\n\n` +
        `Fadlan si faahfaahsan ii weydii. Waxaad i weydiin kartaa:\n` +
        `• **Alaabta & Kaydka:** "Ma haysaan Dell laptop?" ama "Alaabta dhamatay"\n` +
        `• **Iibka & Faa'iidada:** "Immisa ayaan iibiyay maanta?" ama "Faa'iidada bishan"\n` +
        `• **Daymaha:** "Yaa lacag igu leh?" ama "Daynta Maxamed"\n` +
        `• **Tallaabooyinka:** "Sidee iib cusub loo sameeyaa?" ama "Sidee kharash loo qoraa?"\n` +
        `• **Aqoonta Guud:** "Waa maxay Ohm's law?" ama "Waa maxay capacitor?"`
      : `❓ **I want to make sure I answer your question accurately ("${query}").**\n\n` +
        `Could you please clarify what you would like to know? For example:\n` +
        `• **Product stock & price:** "Do we have Dell laptops?" or "Which items are out of stock?"\n` +
        `• **Sales & profit:** "How much did I sell today?" or "Show this month's profit"\n` +
        `• **Debts & customers:** "Who owes money to the store?" or "Check debt for Mohamed"\n` +
        `• **How-to guides:** "How do I create a new sale in POS?" or "How do I add a product?"\n` +
        `• **General knowledge:** "What is Ohm's law?" or "What is a capacitor?"`,
    actionProposal: null,
  };
}

// ----------------------------------------------------------------
// Main Chat Processing Function
// ----------------------------------------------------------------
async function processChatMessage({ messages = [], user, ip = '' }) {
  const openai = getOpenAIClient();
  const model = getModelName();

  // Robust extraction of user message: filter by role === 'user'
  const userMessages = messages.filter(
    (m) => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()
  );

  const lastUserMessage = userMessages.length > 0
    ? userMessages[userMessages.length - 1].content.trim()
    : messages.filter((m) => m && typeof m.content === 'string' && m.content.trim()).pop()?.content?.trim() || '';

  // Clean conversational history: filter out welcome banners and system error cards
  const cleanedHistory = messages
    .filter((m) => {
      if (!m || typeof m.content !== 'string' || !m.content.trim()) return false;
      if (m.role === 'assistant' && (m.content.includes('Welcome to JILE Electronics AI Assistant!') || m.content.includes('Ku soo dhowow Kaaliyaha Garaadka'))) {
        return false;
      }
      if (m.role === 'assistant' && m.content.startsWith('⚠️ **Error:**')) {
        return false;
      }
      return true;
    })
    .slice(-12);

  // If no OpenAI key configured → use the built-in intelligent engine directly
  if (!openai) {
    const result = await fallbackLocalEngine(lastUserMessage, cleanedHistory, user);
    return {
      message: result.reply,
      actionProposal: result.actionProposal,
      provider: 'local-intelligent-engine',
      model: 'JILE-Autonomous-Engine',
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(user);
    const chatConversation = [
      { role: 'system', content: systemPrompt },
      ...cleanedHistory,
    ];

    let currentIteration = 0;
    const maxIterations = 5;
    let actionProposal = null;

    while (currentIteration < maxIterations) {
      currentIteration += 1;

      const completion = await openai.chat.completions.create({
        model,
        messages: chatConversation,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
      });

      const choice = completion.choices[0];
      const responseMessage = choice.message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        chatConversation.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            fnArgs = {};
          }

          let toolOutput;
          try {
            toolOutput = await executeTool(fnName, fnArgs, user);
            if (fnName.startsWith('propose_') && toolOutput.actionId) {
              actionProposal = toolOutput;
            }
          } catch (toolError) {
            toolOutput = { error: toolError.message };
          }

          chatConversation.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolOutput),
          });
        }
      } else {
        return {
          message: responseMessage.content,
          actionProposal,
          provider: 'openai',
          model,
        };
      }
    }

    return {
      message: chatConversation[chatConversation.length - 1]?.content || 'Done.',
      actionProposal,
      provider: 'openai',
      model,
    };
  } catch (apiError) {
    const isQuotaError = apiError?.status === 429 || (apiError?.message || '').includes('credits');
    const isBillingError =
      (apiError?.message || '').toLowerCase().includes('billing') ||
      (apiError?.message || '').toLowerCase().includes('no credits');

    if (isQuotaError || isBillingError) {
      console.warn('[AI] Cloud API quota limit reached — using built-in intelligent engine.');
    } else {
      console.error('[AI] Cloud API Error:', apiError.message);
    }

    // Seamlessly execute the autonomous engine
    const result = await fallbackLocalEngine(lastUserMessage, cleanedHistory, user);

    return {
      message: result.reply,
      actionProposal: result.actionProposal,
      provider: 'local-intelligent-engine',
      model: 'JILE-Autonomous-Engine',
    };
  }
}

module.exports = {
  processChatMessage,
  buildSystemPrompt,
  executeTool,
  fallbackLocalEngine,
  detectPeriod,
  detectIsSomali,
  matchGeneralKnowledge,
  matchSystemHowTo,
};
