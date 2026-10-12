/**
 * OpenAI Tool (Function) Definitions for JILE Electronics Management System
 */

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_sales_metrics',
      description: 'Get sales revenue, total orders, amount paid, debts incurred, order discounts, and top selling products for a specified period (today, yesterday, this_week, last_week, this_month, last_month, this_year, or custom date range).',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'],
            description: 'The time period to analyze. Defaults to today.',
          },
          from: {
            type: 'string',
            description: 'Optional start date (YYYY-MM-DD) if period is custom.',
          },
          to: {
            type: 'string',
            description: 'Optional end date (YYYY-MM-DD) if period is custom.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_profit_metrics',
      description: 'Calculate gross profit, cost of goods sold, operating expenses, and net profit for a specific period. (Admin role required).',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'],
            description: 'The time period for profit analysis.',
          },
          from: {
            type: 'string',
            description: 'Optional start date (YYYY-MM-DD).',
          },
          to: {
            type: 'string',
            description: 'Optional end date (YYYY-MM-DD).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_inventory_status',
      description: 'Retrieve current inventory counts, low stock alerts, out of stock products, and total inventory valuation based on purchase prices.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'low_stock', 'out_of_stock'],
            description: 'Filter products by stock status.',
          },
          search: {
            type: 'string',
            description: 'Optional search keyword for product name or SKU.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of items to return (default 15).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_stock_movements',
      description: 'Retrieve audit logs of stock movements (inbound or outbound) including sales, purchases, damaged items, adjustments, and who performed them.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'this_week', 'this_month', 'this_year'],
            description: 'Time window for movements.',
          },
          type: {
            type: 'string',
            enum: ['in', 'out', 'all'],
            description: 'Movement direction (inbound, outbound, or all).',
          },
          limit: {
            type: 'number',
            description: 'Number of recent movements (default 10).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_customer_debts',
      description: 'Retrieve customers with outstanding unpaid debts, total balance owed, contact phone numbers, and repayment statuses.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional name or phone number filter.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of debtors to return (default 10).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_expenses_summary',
      description: 'Get total business expenses, breakdown by category (Rent, Electricity, Transport, Salary, Internet, Other), and recent expense receipts.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'this_week', 'this_month', 'this_year', 'custom'],
            description: 'Time period for expenses.',
          },
          category: {
            type: 'string',
            enum: ['Rent', 'Electricity', 'Transport', 'Salary', 'Internet', 'Other'],
            description: 'Optional filter by category.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_suppliers_summary',
      description: 'View supplier accounts, wholesale order totals, payments made, and amounts currently due to vendors.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional supplier name or company name search.',
          },
          limit: {
            type: 'number',
            description: 'Maximum records (default 10).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_business_overview',
      description: 'Get an executive dashboard summary of key metrics: today\'s sales, today\'s expenses, product count, total customer debt, supplier debt, inventory value, and active alerts.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_system_help',
      description: 'Get step-by-step instructions and user manuals on how to use any module of JILE Electronics (products, stock, sales, receipts, debts, purchases, reports, etc.) in English or Somali.',
      parameters: {
        type: 'object',
        properties: {
          module: {
            type: 'string',
            enum: [
              'dashboard',
              'products',
              'categories',
              'stock',
              'sales',
              'receipts',
              'purchases',
              'customers',
              'customerDebts',
              'customerPayments',
              'suppliers',
              'expenses',
              'reports',
              'profitReport',
              'users',
              'settings',
              'general',
            ],
            description: 'The system module or feature the user is asking about.',
          },
        },
        required: ['module'],
      },
    },
  },

  // PREPARATION TOOLS (Preview & Staging Actions with explicit user confirmation)
  {
    type: 'function',
    function: {
      name: 'propose_add_product',
      description: 'Prepare a preview to add a new product. NEVER creates the product directly; generates a confirmation card for the user to review and approve.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Product name' },
          sku: { type: 'string', description: 'Unique product SKU or code' },
          category: { type: 'string', description: 'Category name or ID' },
          sellingPrice: { type: 'number', description: 'Selling price per unit' },
          purchasePrice: { type: 'number', description: 'Purchase/cost price per unit' },
          minStock: { type: 'number', description: 'Minimum stock alert threshold (default 5)' },
          initialStock: { type: 'number', description: 'Initial stock on hand (default 0)' },
          description: { type: 'string', description: 'Optional description' },
        },
        required: ['name', 'sku', 'sellingPrice', 'purchasePrice'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_adjust_stock',
      description: 'Prepare a preview to adjust product inventory (e.g. increase stock or deduct for damaged/lost goods). Requires user confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product name or SKU or ID' },
          quantity: { type: 'number', description: 'Number of units to adjust' },
          type: { type: 'string', enum: ['in', 'out'], description: 'Adjustment direction: "in" (add) or "out" (deduct)' },
          reason: {
            type: 'string',
            enum: ['adjustment_in', 'adjustment_out', 'damaged', 'lost'],
            description: 'Reason for adjustment',
          },
          notes: { type: 'string', description: 'Reason explanation / notes' },
        },
        required: ['product', 'quantity', 'type', 'reason'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_customer_payment',
      description: 'Prepare a preview to record a customer debt payment. Requires user confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          customer: { type: 'string', description: 'Customer name or phone or ID' },
          amount: { type: 'number', description: 'Amount paid by customer' },
          method: { type: 'string', enum: ['cash', 'bank', 'other'], description: 'Payment method' },
          notes: { type: 'string', description: 'Payment notes' },
        },
        required: ['customer', 'amount'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_record_expense',
      description: 'Prepare a preview to record an operational business expense. Requires user confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Expense name or title' },
          category: {
            type: 'string',
            enum: ['Rent', 'Electricity', 'Transport', 'Salary', 'Internet', 'Other'],
            description: 'Expense category',
          },
          amount: { type: 'number', description: 'Expense amount' },
          date: { type: 'string', description: 'Optional date YYYY-MM-DD (defaults to today)' },
          description: { type: 'string', description: 'Optional notes/description' },
        },
        required: ['name', 'category', 'amount'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_update_product',
      description: 'Prepare a preview to update product prices or minimum stock threshold. Requires user confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product name or SKU or ID' },
          sellingPrice: { type: 'number', description: 'New selling price' },
          purchasePrice: { type: 'number', description: 'New purchase price' },
          minStock: { type: 'number', description: 'New minimum stock threshold' },
          name: { type: 'string', description: 'New product name' },
        },
        required: ['product'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'propose_record_purchase',
      description: 'Prepare a preview to record a purchase order from a supplier. Requires user confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          supplier: { type: 'string', description: 'Supplier name or ID' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product: { type: 'string', description: 'Product name or SKU or ID' },
                quantity: { type: 'number', description: 'Quantity purchased' },
                purchasePrice: { type: 'number', description: 'Purchase cost per unit' },
              },
              required: ['product', 'quantity'],
            },
            description: 'List of items purchased',
          },
          paid: { type: 'number', description: 'Amount paid immediately to supplier' },
          notes: { type: 'string', description: 'Order notes' },
        },
        required: ['supplier', 'items'],
      },
    },
  },
];

module.exports = { AI_TOOLS };
