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
} = require('./aiDataService');

// ----------------------------------------------------------------
// OpenAI client + model helpers
// ----------------------------------------------------------------
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key' || apiKey.trim() === '') {
    return null;
  }
  return new OpenAI({ apiKey });
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
1. Answer questions about all system modules (Dashboard, Products, Categories, Stock Management, Sales & POS, Sales History, Receipts, Purchases, Customers, Customer Debts, Customer Payments, Suppliers, Expenses, Reports, Profit, Users, and Settings).
2. Answer business data questions accurately by calling real database tools. NEVER guess or invent metrics.
3. Guide users step by step in Somali or English when they ask how to perform operations.
4. Stage business actions (creating products, updating prices, stock adjustments, customer debt payments, expense entries, purchase orders) safely using the "propose_*" tools. NEVER execute a write immediately. Always present the preview and tell the user they can click "Confirm & Execute" in the card.

Language Instructions:
- Support both Somali (Af-Soomaali) and English fluently.
- If the user asks in Somali (e.g., "Immisa ayaan iibiyay maanta?", "Sidee alaab cusub ugu daraa?", "Yaa lacag igu leh?"), respond in clear, natural Somali.
- If the user asks in English, respond in professional English.
- If the user mixes languages, respond appropriately.

Financial & Business Rules:
- Revenue = actual sales total after discounts.
- Cost of Goods Sold (COGS) = cost attributable to products sold.
- Gross Profit = revenue minus cost of goods sold.
- Net Profit = gross profit minus operating expenses.
- Never treat revenue as profit.
- Customer debt = outstanding balance owed by customers.
- If the user is role 'staff' and asks about profit, explain politely that profit metrics are restricted to Admin users.

Formatting:
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
  // Look at current message first
  if (/yesterday|shalay/i.test(query)) return 'yesterday';
  if (/last.?week|todobaadkii.?hore/i.test(query)) return 'last_week';
  if (/last.?month|bishii.?hore/i.test(query)) return 'last_month';
  if (/this.?week|todobaadkan|todobaad/i.test(query)) return 'this_week';
  if (/this.?month|bishan|bisha/i.test(query)) return 'this_month';
  if (/this.?year|sanadkan|sanad/i.test(query)) return 'this_year';
  if (/today|maanta/i.test(query)) return 'today';

  // "What about yesterday/last week?" follow-up handling
  if (/what about|what.?about|immisa|iyo/i.test(query) && conversationHistory.length > 0) {
    const recentBot = [...conversationHistory]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!recentBot) return 'today';

    // Check what the previous answer was about
    const prevContent = (recentBot.content || '').toLowerCase();
    if (/today/i.test(prevContent)) {
      if (/yesterday/i.test(query) || /shalay/i.test(query)) return 'yesterday';
      if (/week/i.test(query) || /todobaad/i.test(query)) return 'this_week';
      if (/month/i.test(query) || /bishan/i.test(query)) return 'this_month';
    }
    if (/yesterday/i.test(prevContent)) {
      if (/week/i.test(query)) return 'this_week';
    }
  }

  return 'today';
}

// ----------------------------------------------------------------
// Intelligent Local NLU Fallback Engine
// Activates when OPENAI_API_KEY is missing/invalid/over-quota.
// ----------------------------------------------------------------
async function fallbackLocalEngine(userMessage, conversationHistory = [], user) {
  const query = userMessage.toLowerCase().trim();

  const isSomali =
    /maanta|shalay|fadlan|alaab|faa.?iido|iib(iyay|isa)?|dayn|lacag|kharash|shaqaale|sidee|qayb|keena|kayd|soo.?iib|warbixin|todobaad|bishan/i.test(
      query
    );

  let responseText = '';
  let actionProposal = null;
  const period = detectPeriod(query, conversationHistory);

  // ---- 1. PROFIT ----
  if (/profit|faa.?iido|faaiido|margin|net.?profit|gross.?profit|faa.?iidada/i.test(query)) {
    if (user.role !== 'admin') {
      return {
        reply: isSomali
          ? "⚠️ **Ogeysiis Ogolaansho:** Ma lihid ogolaansho aad ku eegto xogta faa'iidada (Profit Report). Kaliya maamulaha nidaamka (Admin) ayaa loo oggol yahay."
          : "⚠️ **Permission Denied:** Profit reports are restricted to Administrator accounts only. Please contact your Admin.",
        actionProposal: null,
      };
    }

    const profit = await getProfitMetrics({ period, userRole: user.role });
    if (!profit.authorized) {
      return { reply: profit.error, actionProposal: null };
    }

    responseText = isSomali
      ? `📊 **Xisaabinta Faa'iidada — ${profit.period}:**
- **Wadarta Iibka (Revenue):** $${profit.totalRevenue.toFixed(2)}
- **Qiimaha Alaabtu ku soo gashay (COGS):** $${profit.costOfGoodsSold.toFixed(2)}
- **Faa'iidada Guud (Gross Profit):** $${profit.grossProfit.toFixed(2)}
- **Kharashaadka Dukaanka (Expenses):** $${profit.totalExpenses.toFixed(2)}
- **Faa'iidada Dhabta ah (Net Profit):** $${profit.netProfit.toFixed(2)}
- **Heerka Faa'iidada (Profit Margin):** ${profit.netProfitMarginPercent}%

*Faa'iidada waxaa laga helay: Faa'iidada Guud - Kharashaadka Dukaanka.*`
      : `📊 **Profit Breakdown — ${profit.period}:**
- **Total Revenue:** $${profit.totalRevenue.toFixed(2)}
- **Cost of Goods Sold (COGS):** $${profit.costOfGoodsSold.toFixed(2)}
- **Gross Profit:** $${profit.grossProfit.toFixed(2)}
- **Operating Expenses:** $${profit.totalExpenses.toFixed(2)}
- **Net Profit:** $${profit.netProfit.toFixed(2)}
- **Net Profit Margin:** ${profit.netProfitMarginPercent}%

*Net Profit = Gross Profit minus all recorded operating expenses for this period.*`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 2. SALES / REVENUE ----
  if (/\bsale|iib|revenue|lacagta iibka|\bsold\b|immisa ayaan|how much did i sell|best.?sell|alaabta.*iibka.*badan/i.test(query)) {
    const sales = await getSalesMetrics({ period });
    const topList = sales.topProducts.length
      ? sales.topProducts
          .map((p) => `  • **${p.productName}** — ${p.quantity} pcs / $${p.revenue.toFixed(2)}`)
          .join('\n')
      : (isSomali ? '  • Alaab ma laha la iibsan' : '  • No items sold in this period');

    responseText = isSomali
      ? `🛒 **Warbixinta Iibka — ${sales.period}:**
- **Wadarta Guud ee Iibka:** $${sales.totalRevenue.toFixed(2)}
- **Tirada Rasiidhada:** ${sales.salesCount}
- **Lacagta Caddaanka ah ee la qabtay:** $${sales.totalPaid.toFixed(2)}
- **Daynta Cusub ee ku dhalatay:** $${sales.totalDebt.toFixed(2)}
- **Qiimo Dhimista la bixiyay:** $${sales.totalDiscount.toFixed(2)}

🔥 **Alaabta ugu Iibka Badan:**
${topList}`
      : `🛒 **Sales Summary — ${sales.period}:**
- **Total Revenue:** $${sales.totalRevenue.toFixed(2)}
- **Number of Transactions:** ${sales.salesCount}
- **Amount Collected (Cash):** $${sales.totalPaid.toFixed(2)}
- **New Debts Created:** $${sales.totalDebt.toFixed(2)}
- **Discounts Given:** $${sales.totalDiscount.toFixed(2)}

🔥 **Top Selling Products:**
${topList}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 3. PURCHASES / SOO IIBSIGA ----
  if (/purchase|soo.?iibsi|shipment|restoc|supplier.*order|order.*supplier/i.test(query)) {
    const { Purchase } = require('../models');
    const { startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } = require('../utils/dateRange');
    const { roundMoney } = require('../utils/money');

    const now = new Date();
    let from, to, label;
    if (period === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); from = startOfDay(y); to = endOfDay(y); label = 'Yesterday'; }
    else if (period === 'this_week') { from = startOfWeek(now); to = endOfDay(now); label = 'This Week'; }
    else if (period === 'this_month') { from = startOfMonth(now); to = endOfDay(now); label = 'This Month'; }
    else if (period === 'this_year') { from = startOfYear(now); to = endOfDay(now); label = 'This Year'; }
    else { from = startOfDay(now); to = endOfDay(now); label = 'Today'; }

    const purchases = await Purchase.find({ date: { $gte: from, $lte: to } })
      .populate('supplier', 'name company')
      .sort({ date: -1 })
      .limit(8);

    const total = roundMoney(purchases.reduce((s, p) => s + p.total, 0));
    const paid = roundMoney(purchases.reduce((s, p) => s + p.paid, 0));
    const remaining = roundMoney(purchases.reduce((s, p) => s + p.remaining, 0));

    const purchaseList = purchases.length
      ? purchases.map((p) =>
          `  • **${p.invoiceNumber}** — ${p.supplier?.name || 'Unknown'} — $${p.total.toFixed(2)} [${p.paymentStatus}]`
        ).join('\n')
      : (isSomali ? '  • Ma jiro soo iibsasho muddadan' : '  • No purchases recorded in this period');

    responseText = isSomali
      ? `🛒 **Warbixinta Soo Iibsashada — ${label}:**
- **Wadarta Soo Iibsashada:** $${total.toFixed(2)}
- **Lacagta la bixiyay Shirkadaha:** $${paid.toFixed(2)}
- **Haraaga Daynta Shirkadaha:** $${remaining.toFixed(2)}
- **Tirada Dalabada:** ${purchases.length}

📋 **Dalabada Ugu Dambeeyay:**
${purchaseList}`
      : `📦 **Purchase Summary — ${label}:**
- **Total Purchases Value:** $${total.toFixed(2)}
- **Amount Paid to Suppliers:** $${paid.toFixed(2)}
- **Remaining Balance Due:** $${remaining.toFixed(2)}
- **Number of Orders:** ${purchases.length}

📋 **Recent Purchase Orders:**
${purchaseList}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 4. SUPPLIERS ----
  if (/supplier|shirkad|vendor|amaah.*shirkad|supplier.*balance|supplier.*debt/i.test(query)) {
    const suppData = await getSuppliersSummary({ limit: 10 });
    const suppList = suppData.suppliers.length
      ? suppData.suppliers.map((s) =>
          `  • **${s.name}** (${s.company || '-'}) — Due: **$${s.amountDue.toFixed(2)}** / Paid: $${s.amountPaid.toFixed(2)}`
        ).join('\n')
      : (isSomali ? '  • Ma jiro shirkad diiwaangashan' : '  • No suppliers found');

    responseText = isSomali
      ? `🏭 **Warbixinta Shirkadaha Alaabta (Suppliers):**
- **Wadarta Shirkadaha:** ${suppData.totalSuppliers}
- **Wadarta Daynta lagu leeyahay Shirkadaha:** $${suppData.totalAmountDueToSuppliers.toFixed(2)}

📋 **Liiska Shirkadaha:**
${suppList}

*Waxaad lacag-bixin uga diiwaangelin kartaa qaybta "Suppliers" ama i weydii inaan kuu diyaariyo.*`
      : `🏭 **Suppliers Overview:**
- **Total Suppliers:** ${suppData.totalSuppliers}
- **Total Amount Due to Suppliers:** $${suppData.totalAmountDueToSuppliers.toFixed(2)}

📋 **Supplier Accounts:**
${suppList}

*You can record supplier payments from the Suppliers section or ask me to prepare a payment.*`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 5. INVENTORY / STOCK ----
  if (/\bstock\b|kayd|inventory|out.?of.?stock|low.?stock|dhamatay|yaratahay|product.*quantit/i.test(query)) {
    let filter = 'all';
    if (/out.?of.?stock|dhamatay|zero/i.test(query)) filter = 'out_of_stock';
    else if (/low.?stock|yaratahay|warning|almost/i.test(query)) filter = 'low_stock';

    const inv = await getInventoryStatus({ filter, limit: 15 });
    const prodList = inv.products.length
      ? inv.products.map((p) =>
          `  • **${p.name}** (${p.sku}) — Stock: **${p.currentStock}** | Min: ${p.minStock} | $${p.sellingPrice} [${p.status}]`
        ).join('\n')
      : (isSomali ? '  • Ma jiro alaab ku haboon shaandhaynta' : '  • No matching products');

    responseText = isSomali
      ? `📦 **Xogta Kaydka & Alaabta:**
- **Wadarta Noocyada:** ${inv.totalProducts}
- **Alaabta Dhamatay (0 kayd):** ${inv.outOfStockCount}
- **Alaabta Digniinta (Low Stock):** ${inv.lowStockCount}
- **Qiimaha Guud ee Kaydka:** $${inv.totalInventoryValue.toFixed(2)}

📋 **Liiska Alaabta:**
${prodList}`
      : `📦 **Inventory Status:**
- **Total Active Products:** ${inv.totalProducts}
- **Out of Stock:** ${inv.outOfStockCount}
- **Low Stock Warnings:** ${inv.lowStockCount}
- **Total Inventory Value:** $${inv.totalInventoryValue.toFixed(2)}

📋 **Products:**
${prodList}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 6. STOCK MOVEMENTS ----
  if (/stock.?move|movement|dhaqdhaqaaq|stock.?histor|stock.?log|in.*out.*stock/i.test(query)) {
    const periodMap = { today: 'today', yesterday: 'today', this_week: 'this_week', this_month: 'this_month', this_year: 'this_year' };
    const smPeriod = periodMap[period] || 'this_week';
    const movements = await getStockMovements({ period: smPeriod, limit: 15 });

    const mvList = movements.movements.length
      ? movements.movements.map((m) =>
          `  • [${m.type.toUpperCase()}] **${m.productName}** — ${m.quantity} units | ${m.reason} | Ref: ${m.referenceNumber || '-'}`
        ).join('\n')
      : (isSomali ? '  • Ma jiro dhaqdhaqaaq muddadan' : '  • No stock movements recorded');

    responseText = isSomali
      ? `🔄 **Dhaqdhaqaaqa Kaydka — ${movements.period}:**
- **Tirada Dhaqdhaqaaqa:** ${movements.count}

📋 **Liiska Dhaqdhaqaaqa:**
${mvList}`
      : `🔄 **Stock Movements — ${movements.period}:**
- **Total Movements:** ${movements.count}

📋 **Movement Log:**
${mvList}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 7. CUSTOMER DEBTS ----
  if (/\bdebt|dayn|lacag.?igu.?leh|debtors|who.?owes?|unpaid.?customer|outstanding/i.test(query)) {
    const debts = await getCustomerDebts({ limit: 10 });
    const debtorList = debts.debtors.length
      ? debts.debtors.map((d) =>
          `  • **${d.name}** (${d.phone || 'No phone'}) — **$${d.totalDebt.toFixed(2)}** [${d.debtStatus}]`
        ).join('\n')
      : (isSomali ? '  • Ma jiraan macaamiil dayn lagu leeyahay' : '  • No customers with outstanding debt');

    responseText = isSomali
      ? `💳 **Xisaabta Daymaha Macaamiisha:**
- **Tirada Macaamiisha Daynta lagu leeyahay:** ${debts.totalDebtorsCount}
- **Wadarta Daynta Dibadda ku maqan:** $${debts.totalOutstandingDebt.toFixed(2)}

👤 **Macaamiisha Daynta leh:**
${debtorList}

💡 Lacag-bixin diiwaangeli: "Customers" → "Customer Payments" ama i weydii.`
      : `💳 **Customer Debts Overview:**
- **Total Debtors:** ${debts.totalDebtorsCount} customers
- **Total Outstanding Balance:** $${debts.totalOutstandingDebt.toFixed(2)}

👤 **Debtors List:**
${debtorList}

💡 Record repayments via "Customers" → "Customer Payments" or ask me to prepare one.`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 8. EXPENSES ----
  if (/expense|kharash|expenses|biil|cost.*operation|running.*cost/i.test(query)) {
    const exp = await getExpensesSummary({ period });
    const catBreakdown = Object.entries(exp.breakdownByCategory)
      .map(([cat, amt]) => `  • ${cat}: **$${amt.toFixed(2)}**`)
      .join('\n') || (isSomali ? '  • Ma jiro kharash qayb ahaan' : '  • No category breakdown');

    responseText = isSomali
      ? `💸 **Kharashaadka — ${exp.period}:**
- **Wadarta Kharashka:** $${exp.totalAmount.toFixed(2)}
- **Tirada Diiwaanka:** ${exp.expensesCount}

📁 **Qayb ahaan:**
${catBreakdown}`
      : `💸 **Business Expenses — ${exp.period}:**
- **Total Amount:** $${exp.totalAmount.toFixed(2)}
- **Records Count:** ${exp.expensesCount}

📁 **By Category:**
${catBreakdown}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 9. WEEKLY / MONTHLY REPORT ----
  if (/report|warbixin|summary|overview|business.*review|review.*business/i.test(query)) {
    const reportPeriod = /month|bishan/i.test(query) ? 'this_month'
      : /year|sanad/i.test(query) ? 'this_year'
      : /week|todobaad/i.test(query) ? 'this_week'
      : 'today';

    const [sales, expenses, debts, inv] = await Promise.all([
      getSalesMetrics({ period: reportPeriod }),
      getExpensesSummary({ period: reportPeriod }),
      getCustomerDebts({ limit: 5 }),
      getInventoryStatus({ filter: 'all', limit: 3 }),
    ]);

    const periodLabel = sales.period;

    responseText = isSomali
      ? `📊 **Warbixinta Ganacsiga — ${periodLabel}**

**💰 IIBKA:**
- Wadarta Guud: **$${sales.totalRevenue.toFixed(2)}** (${sales.salesCount} rasiidh)
- Lacagta la qabtay: $${sales.totalPaid.toFixed(2)}
- Daynta cusub: $${sales.totalDebt.toFixed(2)}

**💸 KHARASHAADKA:**
- Wadarta: **$${expenses.totalAmount.toFixed(2)}** (${expenses.expensesCount} diiwaano)

**💳 DAYMAHA:**
- Macaamiil dayn leh: ${debts.totalDebtorsCount}
- Wadarta Daynta: $${debts.totalOutstandingDebt.toFixed(2)}

**📦 KAYDKA:**
- Alaab noocyadiisu: ${inv.totalProducts}
- Dhamatay: ${inv.outOfStockCount} | Digniinta: ${inv.lowStockCount}
- Qiimaha Kaydka: $${inv.totalInventoryValue.toFixed(2)}`
      : `📊 **Business Performance Report — ${periodLabel}**

**💰 SALES:**
- Total Revenue: **$${sales.totalRevenue.toFixed(2)}** (${sales.salesCount} transactions)
- Cash Collected: $${sales.totalPaid.toFixed(2)}
- Debts Created: $${sales.totalDebt.toFixed(2)}

**💸 EXPENSES:**
- Total: **$${expenses.totalAmount.toFixed(2)}** (${expenses.expensesCount} records)

**💳 CUSTOMER DEBTS:**
- Active Debtors: ${debts.totalDebtorsCount}
- Outstanding Balance: $${debts.totalOutstandingDebt.toFixed(2)}

**📦 INVENTORY:**
- Product Catalog: ${inv.totalProducts} items
- Out of Stock: ${inv.outOfStockCount} | Low Stock: ${inv.lowStockCount}
- Inventory Value: $${inv.totalInventoryValue.toFixed(2)}`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 10. HOW-TO GUIDES ----
  if (/how.?to|sidee|how.?do.?i|explain.*how|guide|habka|qaabka|tallaabooyinka/i.test(query)) {
    if (/add.*product|product.*add|alaab.*cusub|cusub.*alaab|new.*product/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.products.howTo;
      responseText = isSomali
        ? `📝 **Tallaabooyinka lagu daro Alaab Cusub:**\n\n` + g.so.join('\n\n')
        : `📝 **How to Add a New Product:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
    if (/sale|iib\b|new.?sale|iib.?cusub/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.sales.howTo;
      responseText = isSomali
        ? `🛒 **Tallaabooyinka Iib Cusub la sameeyo:**\n\n` + g.so.join('\n\n')
        : `🛒 **How to Create a New Sale:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
    if (/debt.?pay|payment|bixinta.?dayn|macaamiil.?lacag/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.customerPayments.howTo;
      responseText = isSomali
        ? `💳 **Tallaabooyinka Bixinta Daynta:**\n\n` + g.so.join('\n\n')
        : `💳 **How to Record Customer Debt Payment:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
    if (/adjust|stock.*adjust|hagaajin|damaged|jabtay|lost|lumo/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.stock.howToAdjust;
      responseText = isSomali
        ? `🔄 **Tallaabooyinka Hagaajinta Kaydka:**\n\n` + g.so.join('\n\n')
        : `🔄 **How to Adjust Product Stock:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
    if (/expense|kharash/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.expenses.howTo;
      responseText = isSomali
        ? `💸 **Tallaabooyinka Diiwaangelinta Kharashka:**\n\n` + g.so.join('\n\n')
        : `💸 **How to Record an Expense:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
    if (/purchase|soo.?iibsi/i.test(query)) {
      const g = SYSTEM_KNOWLEDGE.modules.purchases.howTo;
      responseText = isSomali
        ? `📦 **Tallaabooyinka Soo Iibsashada (New Purchase):**\n\n` + g.so.join('\n\n')
        : `📦 **How to Record a Purchase:**\n\n` + g.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }

    // Generic system guide
    responseText = isSomali
      ? `🔮 **Nidaamka JILE Electronics wuxuu leeyahay qaybahan:**

1. **Dashboard** — Guudmar ganacsi iyo xogta maanta
2. **Products** — Maamulka alaabta & SKUs
3. **Categories** — Qaybaha alaabta
4. **Stock Management** — Kaydka & dhaqdhaqaaqa
5. **Sales (POS)** — Iibka cusub & taariikhda
6. **Purchases** — Soo iibsashada alaabta cusub
7. **Customers** — Macaamiisha & daymaha
8. **Suppliers** — Shirkadaha alaabta
9. **Expenses** — Kharashaadka dukaanka
10. **Reports** — Warbixinada maaliyadeed
11. **Users** — Maamulka shaqaalaha (Admin kaliya)
12. **Settings** — Habaynta nidaamka

I weydii tallaabooyinka qaybta aad doonayso!`
      : `🔮 **JILE Electronics System Modules:**

1. **Dashboard** — Live business overview
2. **Products** — Full inventory catalog management
3. **Categories** — Product groupings
4. **Stock Management** — Inbound/outbound tracking & adjustments
5. **Sales (POS)** — Record sales, apply discounts, manage debt
6. **Purchases** — Restock from suppliers
7. **Customers** — Profiles, debts, payment history
8. **Suppliers** — Vendor accounts and balances
9. **Expenses** — Record operating costs
10. **Reports** — Financial and business analytics
11. **Users** — Staff account management (Admin only)
12. **Settings** — System configuration

Ask me step-by-step instructions for any module!`;
    return { reply: responseText, actionProposal: null };
  }

  // ---- 11. GENERAL BUSINESS OVERVIEW (default) ----
  const overview = await getBusinessOverview({ userRole: user.role });

  responseText = isSomali
    ? `👋 **Ku soo dhowow Kaaliyaha Garaadka ee JILE Electronics!**

📊 **Xogta Guud ee Maanta:**
- 🛒 **Iibka Maanta:** $${overview.todayRevenue.toFixed(2)} (${overview.todaySalesCount} rasiidh)
- 💸 **Kharashka Maanta:** $${overview.todayExpenses.toFixed(2)}
- 📦 **Noocyada Alaabta:** ${overview.totalProductsCount}
- ⚠️ **Alaabta Digniinta ku jirta:** ${overview.lowStockAlertCount}
- 💳 **Wadarta Daynta Macaamiisha:** $${overview.totalCustomerDebt.toFixed(2)}
- 🏭 **Daynta Shirkadaha:** $${overview.totalSupplierDebt.toFixed(2)}
- 🏦 **Qiimaha Kaydka:** $${overview.inventoryValuation.toFixed(2)}

💡 **Waxa aad i weydiin kartaa:**
• "Immisa ayaan iibiyay maanta?"
• "Yaa lacag igu leh?"
• "Waa kuwee alaabta dhamatay?"
• "Sidee alaab cusub ugu daraa?"`
    : `👋 **Welcome to JILE Electronics AI Assistant!**

📊 **Live Business Dashboard — Today:**
- 🛒 **Sales Revenue:** $${overview.todayRevenue.toFixed(2)} (${overview.todaySalesCount} orders)
- 💸 **Expenses:** $${overview.todayExpenses.toFixed(2)}
- 📦 **Products in Catalog:** ${overview.totalProductsCount}
- ⚠️ **Low Stock Alerts:** ${overview.lowStockAlertCount}
- 💳 **Total Customer Debt:** $${overview.totalCustomerDebt.toFixed(2)}
- 🏭 **Supplier Balances Due:** $${overview.totalSupplierDebt.toFixed(2)}
- 🏦 **Inventory Valuation:** $${overview.inventoryValuation.toFixed(2)}

💡 **Try asking:**
• "How much did I sell this month?"
• "Which products are out of stock?"
• "Show me this week's profit"
• "Who owes money to the store?"`;

  return { reply: responseText, actionProposal: null };
}

// ----------------------------------------------------------------
// Main Chat Processing Function
// ----------------------------------------------------------------
async function processChatMessage({ messages = [], user, ip = '' }) {
  const openai = getOpenAIClient();
  const model = getModelName();

  const userMessages = messages.filter((m) => m && m.content);
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

  // No OpenAI key configured → use local engine directly
  if (!openai) {
    const result = await fallbackLocalEngine(lastUserMessage, messages, user);
    return {
      message: result.reply,
      actionProposal: result.actionProposal,
      provider: 'local-intelligent-engine',
      model: 'JILE-Business-NLU',
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(user);
    const chatConversation = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-12),
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
          try { fnArgs = JSON.parse(toolCall.function.arguments || '{}'); } catch (e) { fnArgs = {}; }

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
    const isBillingError = (apiError?.message || '').toLowerCase().includes('billing')
      || (apiError?.message || '').toLowerCase().includes('no credits');

    // Log quota/billing errors without spamming console with full stacks
    if (isQuotaError || isBillingError) {
      console.warn('[AI] OpenAI quota/billing limit hit — using local intelligent engine.');
    } else {
      console.error('[AI] OpenAI API Error:', apiError.message);
    }

    const result = await fallbackLocalEngine(lastUserMessage, messages, user);

    // Append a billing notice when quota is exhausted
    const billingNotice = isQuotaError || isBillingError
      ? `\n\n---\n> ⚡ *Note: Running on the **built-in intelligent engine** (OpenAI quota exceeded). For GPT-4o powered responses, add billing credits at [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing).*`
      : '';

    return {
      message: result.reply + billingNotice,
      actionProposal: result.actionProposal,
      provider: 'local-intelligent-engine',
      model: 'JILE-Business-NLU',
    };
  }
}

module.exports = {
  processChatMessage,
  buildSystemPrompt,
  executeTool,
  fallbackLocalEngine,
};
