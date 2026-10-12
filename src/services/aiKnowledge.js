/**
 * Comprehensive Knowledge Base for JILE Electronics Management System
 * Covers all 17 modules, step-by-step procedures, business logic, workflows,
 * and error solutions in English and Somali.
 */

const SYSTEM_KNOWLEDGE = {
  general: {
    systemName: 'JILE Electronics Management System',
    currency: 'USD ($)',
    roles: {
      admin: 'Full system administrator: Can manage users, view profit reports, modify system settings, and perform all operational actions.',
      staff: 'Operational staff: Can record sales, view inventory, manage customers, record expenses, view standard reports, but cannot access user management, system settings, or sensitive profit breakdown.',
    },
    somaliOverview: 'JILE Electronics Management System waa nidaam dhamaystiran oo loogu talagalay maamulka dukaanka qalabka elektaroonigga ah, kaydka (inventory), iibka (sales & POS), daymaha macaamiisha, soo iibsiga qalabka, kharashaadka, iyo warbixinada maaliyadeed.',
  },

  modules: {
    dashboard: {
      name: 'Dashboard (Bogga Hore)',
      description: 'Central overview displaying today\'s sales, today\'s profit (Admin only), total sales, purchases, customer debt, inventory valuation, and sales trend graphs (daily, weekly, monthly, yearly).',
      somali: 'Bogga hore wuxuu ku tusayaa xogta guud ee maanta: iibka maanta, faa\'iidada maanta (admin kaliya), daymaha macaamiisha, qiimaha guud ee kaydka, iyo jaantusyada koboca ganacsiga.',
      features: ['KPI Summary cards', 'Low stock alerts widget', 'Interactive sales charts (Daily 7d, Weekly 4w, Monthly 6m, Yearly 4y)'],
    },

    products: {
      name: 'Products (Alaabta & Qalabka)',
      description: 'Manage inventory items with SKU, categories, selling price, purchase/cost price, stock level, and minimum stock threshold.',
      somali: 'Maamulka qalabka iyo alaabta ku jirta dukaanka: magaca, SKU, qaybta (category), qiimaha iibka, qiimaha soo iibsiga, iyo heerka ugu yar ee digniinta kaydka.',
      howTo: {
        en: [
          'Step 1: Open the sidebar and click "Products" -> "Add Product".',
          'Step 2: Enter Product Name, SKU (or barcode identifier), Category, Selling Price, and Purchase Price.',
          'Step 3: Specify Minimum Stock alert level and Initial Stock quantity if applicable.',
          'Step 4: Upload an optional product image and click "Create Product".',
          'Note: Initial stock automatically records an inbound stock movement with reason "new_product".',
        ],
        so: [
          'Talaabada 1aad: Fur dhinaca bidix (sidebar) oo guji "Products" -> "Add Product".',
          'Talaabada 2aad: Gali Magaca alaabta, SKU-da, Qaybta (Category), Qiimaha Iibka (Selling Price), iyo Qiimaha Soo Iibsiga (Purchase Price).',
          'Talaabada 3aad: Gali xadka ugu yar ee digniinta kaydka (Min Stock) iyo inta xabbo oo hadda diyaar ah (Initial Stock).',
          'Talaabada 4aad: Haddii loo baahdo geli sawirka alaabta kadibna guji "Create Product".',
        ],
      },
    },

    categories: {
      name: 'Categories (Qaybaha Alaabta)',
      description: 'Organize products into groups like Laptops, Smartphones, Screens, Accessories, Batteries, Audio, etc.',
      somali: 'Habeynta qaybaha qalabka sida Laptops, Mobilada, Shaashadaha, Qalabka dheeriga ah (Accessories).',
      howTo: {
        en: ['Go to "Products" -> "Categories" in the sidebar.', 'Click "Add Category", enter name and description, then save.'],
        so: ['Tag "Products" -> "Categories" ee dhinaca bidix.', 'Guji "Add Category", geli magaca iyo sharraxaadda, kadibna kaydi.'],
      },
    },

    stock: {
      name: 'Stock Management (Maamulka Kaydka)',
      description: 'Track all stock movements (inbound/outbound) and perform manual adjustments for damaged goods, lost items, or inventory recounts.',
      somali: 'Kormeerka dhaqdhaqaaqa kaydka oo dhan iyo samaynta hagaajinta kaydka haddii alaab jabto (damaged), lumo (lost), ama xisaabinta dukaanka dib loo saxayo.',
      howToAdjust: {
        en: [
          'Step 1: Go to "Products" -> "Stock Management".',
          'Step 2: Click "Adjust Stock".',
          'Step 3: Select the product, specify the quantity, choose adjustment type (In or Out), and select the reason ("damaged", "lost", "adjustment_in", or "adjustment_out").',
          'Step 4: Add explanatory notes and click "Save Adjustment". Stock is immediately updated and logged in the audit trail.',
        ],
        so: [
          'Talaabada 1aad: Tag "Products" -> "Stock Management".',
          'Talaabada 2aad: Guji badhanka "Adjust Stock".',
          'Talaabada 3aad: Dooro alaabta, qor tirada (quantity), nooca (In - kordhin, ama Out - dhimis), doorana sababta (damaged - jabtay, lost - luntay, adjustment_in/out).',
          'Talaabada 4aad: Qor faahfaahin yar kadibna guji "Save Adjustment". Kaydka si toos ah ayaa loo cusboonaysiinayaa.',
        ],
      },
    },

    sales: {
      name: 'Sales & POS (Iibka & Goobta Iibka)',
      description: 'Create new sales transactions, apply order and line discounts, select walk-in or registered customers, and collect full or partial payment.',
      somali: 'Diiwaangelinta iibka cusub, bixinta dhimista (discounts), doorashada macaamiisha caadiga ah (Walk-in) ama kuwa diiwaangashan, iyo qaadashada lacagta caddaanka ah ama daynta.',
      howTo: {
        en: [
          'Step 1: Go to "Sales" -> "New Sale".',
          'Step 2: Select a customer (choose "Normal Customer" for anonymous walk-ins or select an account for debtors).',
          'Step 3: Add products to cart. Quantities and line discounts can be adjusted in the item table.',
          'Step 4: If an order-level discount applies, enter it in the discount field.',
          'Step 5: Enter the Amount Paid. If Paid < Total, the remainder is automatically recorded as debt on the customer\'s account.',
          'Step 6: Click "Complete Sale". The receipt will open and inventory will automatically decrease.',
        ],
        so: [
          'Talaabada 1aad: Tag "Sales" -> "New Sale".',
          'Talaabada 2aad: Dooro macaamiilka ("Normal Customer" haddii uu yahay qof caadi ah oo socda, ama dooro macaamiil diiwaangashan haddii uu dayn qaadanayo).',
          'Talaabada 3aad: Ku dar alaabta gaadhiga iibka (cart). Waxaad beddeli kartaa tirada iyo qiimo dhimista alaab kasta.',
          'Talaabada 4aad: Gali lacagta dhimista guud (order discount) haddii aad bixinayso.',
          'Talaabada 5aad: Gali lacagta uu bixiyay (Amount Paid). Haddii lacagta la bixiyay ay ka yartahay wadarta guud, haraaga si toos ah ayaa dayn ahaan loogu xisaabinayaa macaamiilka.',
          'Talaabada 6aad: Guji "Complete Sale". Rasiidka ayaa si toos ah u soo baxaya, alaabtana kaydka ayaa laga jarayaa.',
        ],
      },
    },

    salesHistory: {
      name: 'Sales History (Taariikhda Iibka)',
      description: 'Search past invoices, review line items, filter by date or payment status, print receipts, and edit or void sales if necessary.',
      somali: 'Dib u eegista iibkii hore, raadinta lambarka rasiidka (Invoice #), daabacaadda rasiidhada, iyo wax ka beddelka ama tirtiridda iibka.',
    },

    receipts: {
      name: 'Receipts (Rasiidhada)',
      description: 'Generate formatted customer invoices and thermal receipts containing business details, items purchased, totals, amounts paid, and remaining debt.',
      somali: 'Soo saarista iyo daabacaadda rasiidhada xisaabta ee dukaanka oo wata faahfaahinta alaabta, qiimaha, iyo daynta haddii ay jirto.',
    },

    purchases: {
      name: 'Purchases (Soo Iibsiga Alaabta)',
      description: 'Record incoming supplier shipments. Restocks product inventory, updates purchase prices, and tracks amounts owed to suppliers.',
      somali: 'Diiwaangelinta alaabta cusub ee laga soo iibsaday shirkadaha ama ganacsatada (Suppliers). Waxay kordhisaa kaydka dukaanka waxayna xisaabisaa lacagta lagu leeyahay ganacsiga.',
      howTo: {
        en: [
          'Step 1: Go to "Purchases" -> "New Purchase".',
          'Step 2: Select the Supplier.',
          'Step 3: Add the products and their purchase unit cost and quantities.',
          'Step 4: Enter the amount paid to the supplier now. Any remaining amount is tracked as Supplier Amount Due.',
          'Step 5: Click "Save Purchase". Product current stock increases immediately.',
        ],
        so: [
          'Talaabada 1aad: Tag "Purchases" -> "New Purchase".',
          'Talaabada 2aad: Dooro shirkadda ama qofka aad alaabta ka soo iibsatay (Supplier).',
          'Talaabada 3aad: Ku dar alaabta, tirada la soo iibsaday, iyo qiimaha lagu soo iibiyay xabbad kasta.',
          'Talaabada 4aad: Gali lacagta aad hadda bixisay. Haraaga waxaa loo diiwaangelinayaa dayn shirkaddu kugu leedahay.',
          'Talaabada 5aad: Guji "Save Purchase". Kaydka alaabta ayaa si toos ah u kordhaya.',
        ],
      },
    },

    customers: {
      name: 'Customers (Macaamiisha)',
      description: 'Maintain customer profiles, phone numbers, addresses, total purchases, and outstanding debts.',
      somali: 'Diiwaanka macaamiisha dukaanka, taleefanadooda, cinwaankooda, wadarta waxyaabaha ay iibsadeen, iyo daymaha ay kugu leeyihiin ama aad ku leedahay.',
    },

    customerDebts: {
      name: 'Customer Debts (Daymaha Macaamiisha)',
      description: 'Dedicated debt ledger showing which customers owe money, total debt breakdown, and debt statuses (Paid, Partial, Unpaid).',
      somali: 'Liiska xisaabaadka daymaha ee macaamiisha lagu leeyahay, inta ay kala leeyihiin, iyo xaaladooda (bixiyay, qayb bixiyay, mise ma bixin).',
    },

    customerPayments: {
      name: 'Customer Payments (Bixinta Daymaha Macaamiisha)',
      description: 'Record payments made by debtors. The payment automatically reduces the customer debt balance and allocates funds to their oldest unpaid sales (FIFO).',
      somali: 'Diiwaangelinta lacagaha ay bixiyaan macaamiisha daynta lagu leeyahay. Nidaamku wuxuu lacagta si toos ah uga jarayaa rasiidhadoodii ugu horeeyay ee aan la bixin.',
      howTo: {
        en: [
          'Step 1: Go to "Customers" -> "Customer Payments".',
          'Step 2: Click "Record Payment".',
          'Step 3: Select the customer who has an outstanding debt.',
          'Step 4: Enter the amount paid (cannot exceed customer\'s total debt) and choose payment method (cash, bank, etc.).',
          'Step 5: Click "Save Payment". Customer debt is immediately reduced.',
        ],
        so: [
          'Talaabada 1aad: Tag "Customers" -> "Customer Payments".',
          'Talaabada 2aad: Guji "Record Payment".',
          'Talaabada 3aad: Dooro macaamiilka daynta lagu leeyahay.',
          'Talaabada 4aad: Gali lacagta uu bixiyay (kama badnaan karto daynta guud ee lagu leeyahay) iyo habka lacag-bixinta (cash, bank, iwm).',
          'Talaabada 5aad: Guji "Save Payment". Daynta macaamiilka si toos ah ayaa loo dhimayaa.',
        ],
      },
    },

    suppliers: {
      name: 'Suppliers (Shirkadaha Alaabta Laga Soo Iibsado)',
      description: 'Track wholesale vendors, contact info, total orders placed, amount paid, and remaining balance due to each vendor.',
      somali: 'Maamulka shirkadaha alaabta keena, xiriirkooda, xisaabaadka iibka jumlada, lacagaha la siiyay, iyo haraaga deynta lagu leeyahay dukaanka.',
    },

    expenses: {
      name: 'Expenses (Kharashaadka)',
      description: 'Record operating expenses under Rent, Electricity, Transport, Salary, Internet, and Other. Directly impacts Net Profit calculations.',
      somali: 'Diiwaangelinta kharashaadka dukaanka sida Kirada (Rent), Korontada (Electricity), Gaadiidka (Transport), Mushaaraadka (Salary), Internetka, iyo Kuwo kale.',
      howTo: {
        en: [
          'Step 1: Go to "Expenses" in the sidebar.',
          'Step 2: Click "Add Expense".',
          'Step 3: Enter the expense name, select category (Rent, Electricity, Transport, Salary, Internet, Other), enter the amount, and date.',
          'Step 4: Click "Save Expense". This expense will now be deducted from your Gross Profit to calculate accurate Net Profit.',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Expenses" ee dhinaca bidix.',
          'Talaabada 2aad: Guji "Add Expense".',
          'Talaabada 3aad: Gali magaca kharashka, dooro qaybta (Rent, Electricity, Transport, Salary, Internet, Other), geli lacagta, iyo taariikhda.',
          'Talaabada 4aad: Guji "Save Expense". Kharashkan waxaa si toos ah looga jarayaa faa\'iidada guud si loo helo faa\'iidada dhabta ah (Net Profit).',
        ],
      },
    },

    reports: {
      name: 'Reports (Warbixinada Ganacsiga)',
      description: 'Comprehensive business analytics and reporting covering Sales, Purchases, Expenses, Gross Profit, Net Profit, Stock movements, and export options to PDF/Excel.',
      somali: 'Warbixino ganacsi oo faahfaahsan: iibka, soo iibsiga, kharashaadka, faa\'iidada guud (Gross Profit), faa\'iidada dhabta ah (Net Profit), iyo dhaqdhaqaaqa kaydka oo loo soo degsan karo PDF ama Excel.',
    },

    profitReport: {
      name: 'Profit Report (Warbixinta Faa\'iidada - Admin Only)',
      description: 'Confidential line-by-line financial report displaying revenue, cost of goods sold (COGS), order and line discounts, and profit margin per sale.',
      somali: 'Warbixin gaar ah oo loogu talagalay maamulayaasha (Admin) kaliya, oo si faahfaahsan u muujinaysa qiimaha alaabtu ku soo gashay (cost price), inta lagu iibiyay, dhimista, iyo faa\'iidada rasiidh kasta.',
      formula: 'Sale Profit = sum((sellingPrice - costPrice) * qty - lineDiscount) - orderDiscount. Net Profit = Gross Profit - Operating Expenses.',
    },

    users: {
      name: 'Users & Permissions (Isticmaalayaasha & Ogolaanshaha - Admin Only)',
      description: 'Manage staff and administrator logins, reset passwords, and toggle active/inactive status.',
      somali: 'Maamulka shaqaalaha iyo maamulayaasha nidaamka gala (Admin/Staff), beddelidda furaha sirta, iyo xannibaadda.',
    },

    settings: {
      name: 'Settings (Habaynta Nidaamka)',
      description: 'Store branding, store name, phone, address, currency symbol, invoice numbering settings, and store logo.',
      somali: 'Habaynta guud ee magaca dukaanka, taleefanka, astaanta (logo), lacagta la isticmaalo, iyo qaab-dhismeedka rasiidhada.',
    },
  },

  faq: [
    {
      qEn: 'How is profit calculated in JILE Electronics?',
      qSo: 'Sidee loo xisaabiyaa faa\'iidada nidaamka JILE Electronics?',
      aEn: 'Gross Profit is calculated per item as (Selling Price - Cost Price) * Quantity - Line Discount, summed across all items and deducting the Order Discount. Net Profit is Gross Profit minus all recorded operating expenses for the period.',
      aSo: 'Faa\'iidada Guud (Gross Profit) waxaa loo xisaabiyaa: (Qiimaha Iibka - Qiimaha Qalabku ku soo galay) * Tirada - Dhimista xabbadda, waxaana laga jaraa dhimista guud ee rasiidka. Faa\'iidada Dhabta ah (Net Profit) waxaa laga helaa marka Faa\'iidada Guud laga jaro dhammaan kharashaadka dukaanka (Expenses).',
    },
    {
      qEn: 'Why is my product stock quantity incorrect?',
      qSo: 'Maxaa keenaya in tirada alaabtu ay khalad noqoto?',
      aEn: 'Inventory counts change only via: 1) Sales (decreases stock), 2) Purchases (increases stock), 3) Initial stock upon creation, or 4) Manual stock adjustments under Products -> Stock Management. Check the Stock Movements table to audit every change.',
      aSo: 'Tirada kaydka waxay ku beddelantaa: 1) Iibka la sameeyay (waa dhimis), 2) Alaab cusub oo la soo iibsaday (waa kordhin), 3) Tiradii hore ee alaabta markii la sameeyay, ama 4) Hagaajin gacanta lagu sameeyay (Stock Adjustment). Ka eeg taariikhda kaydka (Stock Movements) si aad u aragto dhaqdhaqaaq kasta.',
    },
    {
      qEn: 'What happens when a customer pays their debt?',
      qSo: 'Maxaa dhacaya marka macaamiilku bixiyo dayntiisa?',
      aEn: 'The system reduces the customer\'s totalDebt by the payment amount, updates totalPaid, and automatically applies the payment to their oldest unpaid invoices (FIFO) until the balance is covered.',
      aSo: 'Nidaamku wuxuu si toos ah u dhimayaa daynta guud ee macaamiilka, wuxuuna lacagta ku xisaabinayaa rasiidhadoodii ugu horeeyay ee aan la bixin ilaa dayntu ka dhamaato.',
    },
  ],
};

module.exports = { SYSTEM_KNOWLEDGE };
