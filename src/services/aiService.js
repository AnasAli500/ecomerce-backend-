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

/**
 * Dispatch Tool Call to Data Services
 */
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
      return {
        module: moduleKey,
        info: mod,
        faq: SYSTEM_KNOWLEDGE.faq,
      };
    }

    // Action Proposal Tools
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

/**
 * Fallback AI Engine: Intelligent Local NLU
 * Activates when OPENAI_API_KEY is not configured or OpenAI fails.
 */
async function fallbackLocalEngine(userMessage, conversationHistory, user) {
  const query = userMessage.toLowerCase().trim();
  const isSomali =
    /maanta|shalay|fadlan|alaab|faa'iido|iib|dayn|lacag|kharash|shaqaale|sidee|qayb|keena|kayd|soo iib/i.test(
      query
    );

  let responseText = '';
  let actionProposal = null;

  // 1. Profit queries
  if (
    /profit|faa'iido|faaiido|margin|net profit|gross profit/i.test(query)
  ) {
    if (user.role !== 'admin') {
      return {
        reply: isSomali
          ? "⚠️ **Ogeysiis Ogolaansho:** Ma lihid ogolaansho aad ku eegto xogta faa'iidada (Profit Report). Kaliya maamulaha nidaamka (Admin) ayaa loo oggol yahay inuu arko xisaabtan sirta ah."
          : "⚠️ **Permission Denied:** You do not have permission to view profit reports. Only Administrators can view confidential profit calculations.",
        actionProposal: null,
      };
    }

    let period = 'today';
    if (/month|bishan|bishii/i.test(query)) period = 'this_month';
    else if (/week|todobaad/i.test(query)) period = 'this_week';
    else if (/year|sanad/i.test(query)) period = 'this_year';
    else if (/yesterday|shalay/i.test(query)) period = 'yesterday';

    const profit = await getProfitMetrics({ period, userRole: user.role });

    if (isSomali) {
      responseText = `📊 **Xisaabinta Faa'iidada (${profit.period}):**
- **Wadarta Iibka (Revenue):** $${profit.totalRevenue.toFixed(2)}
- **Qiimaha Alaabtu ku soo gashay (COGS):** $${profit.costOfGoodsSold.toFixed(2)}
- **Faa'iidada Guud (Gross Profit):** $${profit.grossProfit.toFixed(2)}
- **Kharashaadka Dukaanka (Expenses):** $${profit.totalExpenses.toFixed(2)}
- **Faa'iidada Dhabta ah (Net Profit):** $${profit.netProfit.toFixed(2)}
- **Heerka Faa'iidada (Profit Margin):** ${profit.netProfitMarginPercent}%

*Faa'iidada dhabta ah waxaa laga helay marka faa'iidada guud laga jaray dhammaan kharashaadka la diiwaangeliyay.*`;
    } else {
      responseText = `📊 **Profit Breakdown (${profit.period}):**
- **Total Revenue:** $${profit.totalRevenue.toFixed(2)}
- **Cost of Goods Sold (COGS):** $${profit.costOfGoodsSold.toFixed(2)}
- **Gross Profit:** $${profit.grossProfit.toFixed(2)}
- **Operating Expenses:** $${profit.totalExpenses.toFixed(2)}
- **Net Profit:** $${profit.netProfit.toFixed(2)}
- **Net Margin:** ${profit.netProfitMarginPercent}%

*Calculated accurately by matching sales line items to product cost snapshots and deducting operating expenses.*`;
    }
    return { reply: responseText, actionProposal: null };
  }

  // 2. Sales queries
  if (
    /sale|iib|how much did i sell|immisa ayaan|revenue|lacagta iibka|sold/i.test(query)
  ) {
    let period = 'today';
    if (/yesterday|shalay/i.test(query)) period = 'yesterday';
    else if (/week|todobaad/i.test(query)) period = 'this_week';
    else if (/month|bishan/i.test(query)) period = 'this_month';
    else if (/year|sanad/i.test(query)) period = 'this_year';

    const sales = await getSalesMetrics({ period });

    const topList = sales.topProducts.length
      ? sales.topProducts
          .map((p) => `  • **${p.productName}** (${p.quantity} pcs - $${p.revenue.toFixed(2)})`)
          .join('\n')
      : '  • No items recorded';

    if (isSomali) {
      responseText = `🛒 **Warbixinta Iibka (${sales.period}):**
- **Wadarta Guud ee Iibka (Revenue):** $${sales.totalRevenue.toFixed(2)}
- **Tirada Rasiidhada (Orders):** ${sales.salesCount}
- **Lacagta Caddaanka ah ee la qabtay (Paid):** $${sales.totalPaid.toFixed(2)}
- **Daynta Cusub ee ku dhalatay (Debt):** $${sales.totalDebt.toFixed(2)}
- **Qiimo Dhimista la bixiyay (Discount):** $${sales.totalDiscount.toFixed(2)}

🔥 **Alaabta ugu iibka badan muddadan:**
${topList}`;
    } else {
      responseText = `🛒 **Sales Summary (${sales.period}):**
- **Total Revenue:** $${sales.totalRevenue.toFixed(2)}
- **Number of Transactions:** ${sales.salesCount}
- **Cash Collected (Paid):** $${sales.totalPaid.toFixed(2)}
- **Customer Debts Created:** $${sales.totalDebt.toFixed(2)}
- **Discounts Given:** $${sales.totalDiscount.toFixed(2)}

🔥 **Top Selling Products:**
${topList}`;
    }
    return { reply: responseText, actionProposal: null };
  }

  // 3. Stock / Inventory / Out of stock / Low stock
  if (
    /stock|kayd|inventory|out of stock|low stock|dhamatay|yaratahay/i.test(query)
  ) {
    let filter = 'all';
    if (/out of stock|dhamatay/i.test(query)) filter = 'out_of_stock';
    else if (/low stock|yaratahay|warning/i.test(query)) filter = 'low_stock';

    const inv = await getInventoryStatus({ filter, limit: 10 });
    const prodList = inv.products.length
      ? inv.products
          .map((p) => `  • **${p.name}** (SKU: ${p.sku}) — Stock: **${p.currentStock}** (Min: ${p.minStock}) [${p.status}]`)
          .join('\n')
      : '  • No matching products found';

    if (isSomali) {
      responseText = `📦 **Xogta Kaydka & Alaabta:**
- **Wadarta Noocyada Alaabta:** ${inv.totalProducts}
- **Alaabta Dhamatay (Out of stock):** ${inv.outOfStockCount}
- **Alaabta Digniinta ku jirta (Low stock):** ${inv.lowStockCount}
- **Qiimaha Guud ee Kaydka (Inventory Value):** $${inv.totalInventoryValue.toFixed(2)}

📋 **Liiska Alaabta:**
${prodList}`;
    } else {
      responseText = `📦 **Inventory Status Overview:**
- **Total Active Products:** ${inv.totalProducts}
- **Out of Stock Items:** ${inv.outOfStockCount}
- **Low Stock Warnings:** ${inv.lowStockCount}
- **Total Inventory Valuation:** $${inv.totalInventoryValue.toFixed(2)}

📋 **Product Details:**
${prodList}`;
    }
    return { reply: responseText, actionProposal: null };
  }

  // 4. Customer Debts / Yaa lacag igu leh
  if (
    /debt|dayn|lacag igu leh|debts|debtors|who owes|unpaid/i.test(query)
  ) {
    const debts = await getCustomerDebts({ limit: 10 });
    const debtorList = debts.debtors.length
      ? debts.debtors
          .map((d) => `  • **${d.name}** (${d.phone}) — Daynta ku taalla: **$${d.totalDebt.toFixed(2)}**`)
          .join('\n')
      : '  • Ma jiraan macaamiil dayn lagu leeyahay';

    if (isSomali) {
      responseText = `💳 **Xisaabta Daymaha Macaamiisha:**
- **Tirada Dadka Daynta lagu leeyahay:** ${debts.totalDebtorsCount} macaamiil
- **Wadarta Daynta Guud ee Dibadda ku maqan:** $${debts.totalOutstandingDebt.toFixed(2)}

👤 **Macaamiisha ugu daynta badan:**
${debtorList}

*Waxaad lacag-bixin uga diiwaangelin kartaa qaybta "Customers" -> "Customer Payments".*`;
    } else {
      responseText = `💳 **Outstanding Customer Debts:**
- **Total Debtors:** ${debts.totalDebtorsCount} customers
- **Total Outstanding Balance:** $${debts.totalOutstandingDebt.toFixed(2)}

👤 **Top Debtors:**
${debtorList}

*To record debt repayment, navigate to "Customers" -> "Customer Payments" or ask me to prepare a payment record.*`;
    }
    return { reply: responseText, actionProposal: null };
  }

  // 5. Expenses
  if (
    /expense|kharash|expenses|biil/i.test(query)
  ) {
    const exp = await getExpensesSummary({ period: 'today' });
    const catBreakdown = Object.entries(exp.breakdownByCategory)
      .map(([cat, amt]) => `  • ${cat}: $${amt.toFixed(2)}`)
      .join('\n') || '  • No category breakdown';

    if (isSomali) {
      responseText = `💸 **Kharashaadka Maanta la diiwaangeliyay:**
- **Wadarta Kharashka:** $${exp.totalAmount.toFixed(2)}
- **Tirada Jeer ee la qoray:** ${exp.expensesCount}

📁 **Kharashka Qayb ahaan:**
${catBreakdown}`;
    } else {
      responseText = `💸 **Today's Business Expenses:**
- **Total Expenses:** $${exp.totalAmount.toFixed(2)}
- **Count:** ${exp.expensesCount} records

📁 **By Category:**
${catBreakdown}`;
    }
    return { reply: responseText, actionProposal: null };
  }

  // 6. How to / Sidee / Guide questions
  if (
    /how to|sidee|how do i|halkee|explain|habka|qaabka/i.test(query)
  ) {
    if (/add.*product|alaab.*daraa|product.*cusub/i.test(query)) {
      const pGuide = SYSTEM_KNOWLEDGE.modules.products.howTo;
      responseText = isSomali
        ? `📝 **Tallaabooyinka lagu daro Alaab Cusub (Products):**\n\n` + pGuide.so.join('\n\n')
        : `📝 **How to Add a New Product:**\n\n` + pGuide.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }

    if (/sale|iib/i.test(query)) {
      const sGuide = SYSTEM_KNOWLEDGE.modules.sales.howTo;
      responseText = isSomali
        ? `🛒 **Tallaabooyinka Iib Cusub la sameeyo (New Sale):**\n\n` + sGuide.so.join('\n\n')
        : `🛒 **How to Create a New Sale:**\n\n` + sGuide.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }

    if (/debt|payment|bixinta daynta/i.test(query)) {
      const payGuide = SYSTEM_KNOWLEDGE.modules.customerPayments.howTo;
      responseText = isSomali
        ? `💳 **Tallaabooyinka lagu Diiwaangeliyo Bixinta Daynta:**\n\n` + payGuide.so.join('\n\n')
        : `💳 **How to Record Customer Debt Payment:**\n\n` + payGuide.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }

    if (/adjust|hagaajin|damaged|jabtay/i.test(query)) {
      const stGuide = SYSTEM_KNOWLEDGE.modules.stock.howToAdjust;
      responseText = isSomali
        ? `🔄 **Tallaabooyinka Hagaajinta Kaydka (Stock Adjustment):**\n\n` + stGuide.so.join('\n\n')
        : `🔄 **How to Adjust Product Stock:**\n\n` + stGuide.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }

    if (/expense|kharash/i.test(query)) {
      const exGuide = SYSTEM_KNOWLEDGE.modules.expenses.howTo;
      responseText = isSomali
        ? `💸 **Tallaabooyinka lagu Daro Kharashka (Expenses):**\n\n` + exGuide.so.join('\n\n')
        : `💸 **How to Record an Expense:**\n\n` + exGuide.en.join('\n\n');
      return { reply: responseText, actionProposal: null };
    }
  }

  // General Executive Business Overview
  const overview = await getBusinessOverview({ userRole: user.role });
  if (isSomali) {
    responseText = `👋 **Ku soo dhowow Kaaliyaha Garaadka ee JILE Electronics!**

Halkan waxaa ku yaalla xogta guud ee dukaanka maanta:
- 🛒 **Iibka Maanta:** $${overview.todayRevenue.toFixed(2)} (${overview.todaySalesCount} rasiidh)
- 💸 **Kharashka Maanta:** $${overview.todayExpenses.toFixed(2)}
- 📦 **Wadarta Alaabta Dukaanka:** ${overview.totalProductsCount} nooc
- ⚠️ **Alaabta Digniinta ku jirta:** ${overview.lowStockAlertCount} nooc
- 💳 **Wadarta Daynta Macaamiisha:** $${overview.totalCustomerDebt.toFixed(2)}
- 🏦 **Qiimaha Guud ee Kaydka:** $${overview.inventoryValuation.toFixed(2)}

Waxaad i weydiin kartaa wax kasta oo ku saabsan nidaamka ama waxaad gujin kartaa su'aalaha hoose!`;
  } else {
    responseText = `👋 **Welcome to JILE Electronics AI Assistant!**

Here is your live business summary for today:
- 🛒 **Today's Sales Revenue:** $${overview.todayRevenue.toFixed(2)} (${overview.todaySalesCount} orders)
- 💸 **Today's Expenses:** $${overview.todayExpenses.toFixed(2)}
- 📦 **Total Catalog Products:** ${overview.totalProductsCount}
- ⚠️ **Low Stock Alerts:** ${overview.lowStockAlertCount}
- 💳 **Total Customer Debt:** $${overview.totalCustomerDebt.toFixed(2)}
- 🏦 **Inventory Valuation:** $${overview.inventoryValuation.toFixed(2)}

You can ask me questions about any module, analyze sales and profit trends, or ask me to prepare actions!`;
  }

  return { reply: responseText, actionProposal: null };
}

/**
 * Main Chat Processing Function
 */
async function processChatMessage({ messages = [], user, ip = '' }) {
  const openai = getOpenAIClient();
  const model = getModelName();

  const userMessages = messages.filter((m) => m && m.content);
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

  // If OpenAI is not configured, seamlessly use local engine
  if (!openai) {
    const fallbackResult = await fallbackLocalEngine(lastUserMessage, messages, user);
    return {
      message: fallbackResult.reply,
      actionProposal: fallbackResult.actionProposal,
      provider: 'local-fallback',
      model: 'intelligent-business-engine',
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(user);
    const chatConversation = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10), // Keep last 10 messages for rich multi-turn context
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

      // Check if model called tools
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

            // If this is an action proposal tool, capture the staged preview object
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
        // Model provided final text answer
        return {
          message: responseMessage.content,
          actionProposal,
          provider: 'openai',
          model,
        };
      }
    }

    return {
      message: chatConversation[chatConversation.length - 1]?.content || 'Completed processing.',
      actionProposal,
      provider: 'openai',
      model,
    };
  } catch (apiError) {
    console.error('OpenAI API Error, falling back to local engine:', apiError.message);
    const fallbackResult = await fallbackLocalEngine(lastUserMessage, messages, user);
    return {
      message: fallbackResult.reply,
      actionProposal: fallbackResult.actionProposal,
      provider: 'local-fallback-resilience',
      model: 'intelligent-business-engine',
    };
  }
}

module.exports = {
  processChatMessage,
  buildSystemPrompt,
  executeTool,
  fallbackLocalEngine,
};
