/**
 * Comprehensive Knowledge Base for JILE Electronics Management System
 * Covers all 17 system modules, step-by-step procedures, business logic, workflows,
 * electronics domain knowledge, general knowledge, and error solutions in English and Somali.
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
      howTo: {
        en: [
          'Step 1: Click "Dashboard" in the sidebar menu.',
          'Step 2: Review the top KPI cards: Today\'s Sales, Expenses, Net Profit (Admin only), and Customer Debts.',
          'Step 3: Check the "Low Stock Alerts" panel to see products that require immediate restocking.',
          'Step 4: Use the timeframe selector (Daily, Weekly, Monthly, Yearly) to inspect sales performance trends.',
        ],
        so: [
          'Talaabada 1aad: Dhinaca bidix ka dooro "Dashboard".',
          'Talaabada 2aad: Eeg kaararka sare: Iibka Maanta, Kharashka, Faa\'iidada Dhabta ah (Admin kaliya), iyo Daymaha Macaamiisha.',
          'Talaabada 3aad: Eeg qaybta "Low Stock Alerts" si aad u aragto alaabta kaydkeedu yaraaday ee u baahan in la dalbo.',
          'Talaabada 4aad: Dooro muddada (Maalinle, Todobaadle, Bille, Sanadle) si aad u aragto jaantuska koboca iibka.',
        ],
      },
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
        en: [
          'Step 1: Go to "Products" -> "Categories" in the sidebar.',
          'Step 2: Click the "Add Category" button.',
          'Step 3: Enter the category name (e.g. "Smartphones" or "Solar Accessories") and an optional description.',
          'Step 4: Click "Save Category". All products can now be linked to this category.',
        ],
        so: [
          'Talaabada 1aad: Tag "Products" -> "Categories" ee dhinaca bidix.',
          'Talaabada 2aad: Guji badhanka "Add Category".',
          'Talaabada 3aad: Geli magaca qaybta (tusaale "Smartphones" ama "Qalabka Qorraxda") iyo sharraxaad kooban.',
          'Talaabada 4aad: Guji "Save Category". Alaabta oo dhan waxaad hadda ku xiri kartaa qaybtan.',
        ],
      },
    },

    stock: {
      name: 'Stock Management (Maamulka Kaydka)',
      description: 'Track all stock movements (inbound/outbound) and perform manual adjustments for damaged goods, lost items, or inventory recounts.',
      somali: 'Kormeerka dhaqdhaqaaqa kaydka oo dhan iyo samaynta hagaajinta kaydka haddii alaab jabto (damaged), lumo (lost), ama xisaabinta dukaanka dib loo saxayo.',
      howTo: {
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
          'Step 1: Go to "Sales" -> "New Sale" (POS).',
          'Step 2: Select a customer (choose "Normal Customer" for anonymous walk-ins or select an account for debtors).',
          'Step 3: Add products to cart. Quantities and line discounts can be adjusted in the item table.',
          'Step 4: If an order-level discount applies, enter it in the discount field.',
          'Step 5: Enter the Amount Paid. If Paid < Total, the remainder is automatically recorded as debt on the customer\'s account.',
          'Step 6: Click "Complete Sale". The receipt will open and inventory will automatically decrease.',
        ],
        so: [
          'Talaabada 1aad: Tag "Sales" -> "New Sale" (POS).',
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
      howTo: {
        en: [
          'Step 1: Go to "Sales" -> "Sales History".',
          'Step 2: Use the search bar to find an invoice by number or customer name.',
          'Step 3: Filter by date range (Today, This Week, This Month) or payment status (Paid, Partial, Unpaid).',
          'Step 4: Click the "View" or "Print" icon next to any sale to re-open and print its receipt.',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Sales" -> "Sales History".',
          'Talaabada 2aad: Isticmaal sanduuqa raadinta si aad u hesho rasiid adoo isticmaalaya lambarka (Invoice #) ama magaca macaamiilka.',
          'Talaabada 3aad: Ku kala shaandhee taariikhda ama xaaladda lacag-bixinta (Paid, Partial, Unpaid).',
          'Talaabada 4aad: Guji astaanta "Print" ama "View" ee ku xigta iibka si aad u daabacdo rasiidka.',
        ],
      },
    },

    receipts: {
      name: 'Receipts & Invoices (Rasiidhada)',
      description: 'Generate formatted customer invoices and thermal receipts containing business details, items purchased, totals, amounts paid, and remaining debt.',
      somali: 'Soo saarista iyo daabacaadda rasiidhada xisaabta ee dukaanka oo wata faahfaahinta alaabta, qiimaha, iyo daynta haddii ay jirto.',
      howTo: {
        en: [
          'Step 1: After completing a sale in POS, the receipt popup opens automatically.',
          'Step 2: Alternatively, navigate to "Sales History" and click "Print" on any past transaction.',
          'Step 3: Select your print format (Thermal Receipt 80mm or Full Page A4 invoice).',
          'Step 4: Click "Print". The receipt includes store name, contact info, itemized products, paid amount, and outstanding debt balance.',
        ],
        so: [
          'Talaabada 1aad: Marka aad iibka dhamaystirto POS-ka, rasiidka ayaa si toos ah u soo baxaya.',
          'Talaabada 2aad: Waxaad sidoo kale ka daabacan kartaa "Sales History" adoo gujinaya "Print".',
          'Talaabada 3aad: Dooro qaabka daabacaadda (Thermal 80mm ama warqad weyn A4).',
          'Talaabada 4aad: Guji "Print". Rasiidku wuxuu muujinayaa magaca dukaanka, taleefanka, alaabta, lacagta la bixiyay, iyo haddii dayn ku hadhay.',
        ],
      },
    },

    purchases: {
      name: 'Purchases (Soo Iibsiga Alaabta)',
      description: 'Record incoming supplier shipments. Restocks product inventory, updates purchase prices, and tracks amounts owed to suppliers.',
      somali: 'Diiwaangelinta alaabta cusub ee laga soo iibsaday shirkadaha ama ganacsatada (Suppliers). Waxay kordhisaa kaydka dukaanka waxayna xisaabisaa lacagta lagu leeyahay ganacsiga.',
      howTo: {
        en: [
          'Step 1: Go to "Purchases" -> "New Purchase".',
          'Step 2: Select the Supplier from the dropdown (or click "Add Supplier" if new).',
          'Step 3: Add the products and enter their purchase unit cost and quantities.',
          'Step 4: Enter the amount paid to the supplier now. Any remaining amount is tracked as Supplier Amount Due.',
          'Step 5: Click "Save Purchase". Product current stock increases immediately and an inbound movement is logged.',
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
      howTo: {
        en: [
          'Step 1: Go to "Customers" in the sidebar.',
          'Step 2: Click "Add Customer".',
          'Step 3: Enter the Customer Name, Phone Number, and optional address/notes.',
          'Step 4: Click "Save Customer". The customer profile is created and can now be selected in POS for credit/debt sales.',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Customers" ee dhinaca bidix.',
          'Talaabada 2aad: Guji badhanka "Add Customer".',
          'Talaabada 3aad: Gali Magaca macaamiilka, Taleefanka, iyo cinwaanka.',
          'Talaabada 4aad: Guji "Save Customer". Macaamiilkan waxaad hadda ka dooran kartaa POS-ka haddii uu dayn qaadanayo.',
        ],
      },
    },

    customerDebts: {
      name: 'Customer Debts (Daymaha Macaamiisha)',
      description: 'Dedicated debt ledger showing which customers owe money, total debt breakdown, and debt statuses (Paid, Partial, Unpaid).',
      somali: 'Liiska xisaabaadka daymaha ee macaamiisha lagu leeyahay, inta ay kala leeyihiin, iyo xaaladooda (bixiyay, qayb bixiyay, mise ma bixin).',
      howTo: {
        en: [
          'Step 1: Go to "Customers" -> "Customer Debts".',
          'Step 2: Inspect the total outstanding debt card at the top.',
          'Step 3: Browse the list of debtors with their names, phone numbers, total debt, and repayment status.',
          'Step 4: Click on any debtor to view their unpaid invoices or record a repayment.',
        ],
        so: [
          'Talaabada 1aad: Tag "Customers" -> "Customer Debts".',
          'Talaabada 2aad: Eeg wadarta daynta dibadda ku maqan ee kaadhka sare.',
          'Talaabada 3aad: Eeg liiska dadka daynta lagu leeyahay, magacyadooda, taleefanadooda, iyo cadadka daynta.',
          'Talaabada 4aad: Guji macaamiilka si aad u aragto rasiidhadooda aan la bixin ama lacag uga qabato.',
        ],
      },
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
          'Step 5: Click "Save Payment". Customer debt is immediately reduced and applied to oldest unpaid invoices.',
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
      howTo: {
        en: [
          'Step 1: Go to "Suppliers" in the sidebar.',
          'Step 2: Click "Add Supplier" to register a new vendor with Name, Company, Phone, and Email.',
          'Step 3: Review existing supplier balances: Total Purchased, Total Paid, and Balance Due.',
          'Step 4: To record a payment to a supplier, click "Pay Supplier", enter the amount, and confirm.',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Suppliers" ee dhinaca bidix.',
          'Talaabada 2aad: Guji "Add Supplier" si aad u diiwaangeliso shirkad cusub (Magaca, Shirkadda, Taleefanka).',
          'Talaabada 3aad: Eeg xisaabta shirkadaha: Wadarta la soo iibsaday, inta la bixiyay, iyo inta dukaanka lagu leeyahay.',
          'Talaabada 4aad: Haddii aad lacag siinayso shirkad, guji "Pay Supplier", geli cadadka, kadibna kaydi.',
        ],
      },
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
      howTo: {
        en: [
          'Step 1: Click "Reports" in the sidebar.',
          'Step 2: Choose the report type: Sales Report, Profit Report (Admin only), Expense Report, or Inventory Report.',
          'Step 3: Select your date filter (Today, This Week, This Month, Custom Date Range).',
          'Step 4: Click "Export PDF" or "Export Excel" to download the finalized report.',
        ],
        so: [
          'Talaabada 1aad: Guji "Reports" ee dhinaca bidix.',
          'Talaabada 2aad: Dooro nooca warbixinta: Iibka, Faa\'iidada (Admin kaliya), Kharashka, ama Kaydka.',
          'Talaabada 3aad: Dooro taariikhda aad rabto (Maanta, Todobaadkan, Bishan, ama Taariikh Gaar ah).',
          'Talaabada 4aad: Guji "Export PDF" ama "Export Excel" si aad ugu soo degsato fayl ahaan.',
        ],
      },
    },

    profitReport: {
      name: 'Profit Report (Warbixinta Faa\'iidada - Admin Only)',
      description: 'Confidential line-by-line financial report displaying revenue, cost of goods sold (COGS), order and line discounts, and profit margin per sale.',
      somali: 'Warbixin gaar ah oo loogu talagalay maamulayaasha (Admin) kaliya, oo si faahfaahsan u muujinaysa qiimaha alaabtu ku soo gashay (cost price), inta lagu iibiyay, dhimista, iyo faa\'iidada rasiidh kasta.',
      formula: 'Sale Profit = sum((sellingPrice - costPrice) * qty - lineDiscount) - orderDiscount. Net Profit = Gross Profit - Operating Expenses.',
      howTo: {
        en: [
          'Step 1: Log in with an Administrator account (Staff cannot view profit).',
          'Step 2: Go to "Reports" -> "Profit Report".',
          'Step 3: Select the reporting period (e.g. This Month or Custom Range).',
          'Step 4: View the breakdown: Total Revenue, COGS, Gross Profit, Total Expenses, Net Profit, and Profit Margin %.',
        ],
        so: [
          'Talaabada 1aad: Ku gal akoon maamule ah (Admin) maadaama shaqaalaha caadiga ah laga xannibay.',
          'Talaabada 2aad: Tag "Reports" -> "Profit Report".',
          'Talaabada 3aad: Dooro muddada (tusaale Bishan ama Maanta).',
          'Talaabada 4aad: Eeg xisaabta: Wadarta Iibka, Qiimaha Qalabku ku soo galay (COGS), Faa\'iidada Guud, Kharashaadka, iyo Faa\'iidada Dhabta ah (Net Profit).',
        ],
      },
    },

    users: {
      name: 'Users & Permissions (Isticmaalayaasha & Shaqaalaha - Admin Only)',
      description: 'Manage staff and administrator logins, reset passwords, and toggle active/inactive status.',
      somali: 'Maamulka shaqaalaha iyo maamulayaasha nidaamka gala (Admin/Staff), beddelidda furaha sirta, iyo xannibaadda.',
      howTo: {
        en: [
          'Step 1: Go to "Users" in the sidebar (Admin only).',
          'Step 2: Click "Add User" to create a new staff or admin account with Name, Email, Password, and Role.',
          'Step 3: To reset a password or change permissions, click "Edit" on the user\'s row.',
          'Step 4: To suspend an employee, toggle status from "Active" to "Inactive".',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Users" ee dhinaca bidix (Admin kaliya).',
          'Talaabada 2aad: Guji "Add User" si aad ugu darto shaqaale cusub (Magaca, Email, Password, iyo Role - Staff ama Admin).',
          'Talaabada 3aad: Si aad furaha sirta ugu beddesho, guji "Edit" qofka safkiisa ku jira.',
          'Talaabada 4aad: Haddii aad shaqada ka joojinayso, status-ka ka dhig "Inactive".',
        ],
      },
    },

    settings: {
      name: 'Settings (Habaynta Nidaamka)',
      description: 'Store branding, store name, phone, address, currency symbol, invoice numbering settings, and store logo.',
      somali: 'Habaynta guud ee magaca dukaanka, taleefanka, astaanta (logo), lacagta la isticmaalo, iyo qaab-dhismeedka rasiidhada.',
      howTo: {
        en: [
          'Step 1: Go to "Settings" in the sidebar (Admin only).',
          'Step 2: Update Store Name (e.g. JILE Electronics), Phone Number, Email, and Physical Address.',
          'Step 3: Configure invoice prefix (e.g. "INV-") and currency symbol ("$").',
          'Step 4: Upload your store logo for receipts and click "Save Settings".',
        ],
        so: [
          'Talaabada 1aad: Tag qaybta "Settings" ee dhinaca bidix (Admin kaliya).',
          'Talaabada 2aad: Wax ka beddel Magaca Dukaanka (JILE Electronics), Taleefanka, Email-ka, iyo Cinwaanka.',
          'Talaabada 3aad: Habee qaabka rasiidhadu u bilowdaan (sida "INV-") iyo calaamadda lacagta ("$").',
          'Talaabada 4aad: Soo geli astaanta dukaanka (Logo) kadibna guji "Save Settings".',
        ],
      },
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
    {
      qEn: 'Who can access profit and user management?',
      qSo: 'Yaa arki kara faa\'iidada iyo maamulka shaqaalaha?',
      aEn: 'Only users with the "admin" role have access to Profit Reports, User Management, and System Settings. Staff users have access to POS, Products, Purchases, Customers, and Expenses only.',
      aSo: 'Kaliya dadka leh doorka "admin" ayaa geli kara Warbixinta Faa\'iidada, Maamulka Shaqaalaha, iyo Habaynta Nidaamka. Shaqaalaha caadiga ahi (Staff) waxay gali karaan POS, Alaabta, Soo Iibsiga, Macaamiisha, iyo Kharashka.',
    },
  ],

  // General Knowledge & Electronics Encyclopedia
  generalKnowledge: [
    {
      keywords: ['ohm', 'ohms law', 'xeerka ohm', 'v=ir', 'voltage current resistance'],
      en: "⚡ **Ohm's Law:**\nOhm's Law states that current ($I$) flowing through a conductor between two points is directly proportional to voltage ($V$) and inversely proportional to resistance ($R$):\n\n**Formula:** $V = I \\times R$\n- **$V$ (Voltage):** Measured in Volts (V)\n- **$I$ (Current):** Measured in Amperes (A)\n- **$R$ (Resistance):** Measured in Ohms ($\\Omega$)\n\n*Power Formula:* $P = V \\times I = I^2 \\times R$",
      so: "⚡ **Xeerka Ohm (Ohm's Law):**\nXeerka Ohm wuxuu qeexayaa xiriirka ka dhexeeya Korontada (Voltage), Qulqulka (Current), iyo Iska-caabinta (Resistance):\n\n**Qaaciddada:** $V = I \\times R$\n- **$V$ (Voltage):** Waxaa lagu cabbiraa Volt (V)\n- **$I$ (Qulqulka - Current):** Waxaa lagu cabbiraa Ampere (A)\n- **$R$ (Iska-caabinta - Resistance):** Waxaa lagu cabbiraa Ohm ($\\Omega$)",
    },
    {
      keywords: ['capacitor', 'capacitors', 'kondhansar', 'capacitance', 'farad'],
      en: "🔋 **Capacitor (Kondhansar):**\nA passive electronic component that stores electrical energy in an electrostatic field. Commonly used in power supply filtering, smoothing voltage fluctuations, audio frequency filtering, and energy discharge circuits. Measured in Farads (F, $\\mu$F, nF, pF).",
      so: "🔋 **Capacitor (Kondhansarka):**\nWaa qalab elektaroonik ah oo kaydiya tamarta korontada ee qaab electrostatic ah. Waxaa inta badan loo isticmaalaa shaandhaynta korontada (filtering/smoothing), xasilinta korontada dukaamada iyo qalabka codka, iyo matoorrada.",
    },
    {
      keywords: ['resistor', 'resistors', 'iska caabin', 'resistance'],
      en: "📏 **Resistor:**\nA passive two-terminal electrical component that implements electrical resistance as a circuit element. It reduces current flow, divides voltages, adjusts signal levels, and terminates transmission lines. Resistance is measured in Ohms ($\\Omega$).",
      so: "📏 **Resistor (Qalabka Iska-caabinta):**\nWaa qayb elektaroonik ah oo xaddidda ama yareysa qulqulka korontada (current) ee wareegga, sidoo kalena u qaybisa korontada (voltage) qaybo kala duwan si aysan qaybaha jilicsan u gubin.",
    },
    {
      keywords: ['diode', 'diodes', 'dayood', 'led', 'rectifier'],
      en: "💡 **Diode & LED:**\nA semiconductor device that allows current to flow in one direction only (anode to cathode). Common types include Rectifier Diodes (converting AC to DC), Zener Diodes (voltage regulation), and LEDs (Light Emitting Diodes).",
      so: "💡 **Diode & LED:**\nWaa qalab semiconductor ah oo u oggolaanaya korontadu inay u socoto hal dhinac oo kaliya. Noocyada ugu caansan waxaa ka mid ah Rectifier Diodes (oo AC u roga DC) iyo LED (oo soo saara iftiinka marka koronto marto).",
    },
    {
      keywords: ['inverter', 'solar inverter', 'dc to ac', 'roge', 'roge qorrax'],
      en: "☀️ **Inverter (Roge):**\nAn electronic device or circuitry that changes direct current (DC) from batteries or solar panels into alternating current (AC) suitable for household electronics and appliances (110V/220V). Modern solar inverters include MPPT charge controllers for maximum solar efficiency.",
      so: "☀️ **Inverter (Rogaha Korontada):**\nWaa qalab u beddela korontada tooska ah (DC) ee ka timaada cadceedda (solar) ama baytariyada una roga koronto wareegta (AC) oo ah tan ay ku shaqeeyaan qalabka guryaha iyo xafiisyada (220V).",
    },
    {
      keywords: ['battery', 'batteries', 'lithium', 'lead acid', 'baytari', 'baytariyada'],
      en: "🔋 **Batteries (Lithium vs Lead-Acid):**\n- **Lithium-Ion / LiFePO4:** Lightweight, deep discharge (90-95%), fast charging, long lifespan (3000-5000+ cycles), ideal for modern solar and electronics.\n- **Lead-Acid / Gel:** Economical, heavier, recommended discharge depth ~50%, shorter cycle life (500-1000 cycles).",
      so: "🔋 **Baytariyada (Lithium iyo Lead-Acid):**\n- **Lithium / LiFePO4:** Aad u tayo fiican, miisaan fudud, xajin kara 90%+ tamarta, cimri dheer (3000-5000 wareeg).\n- **Lead-Acid / Gel:** Qiimo jaban, culays badan, laguma talinayo in la isticmaalo in ka badan 50% mar kasta si uusan u xumaan.",
    },
    {
      keywords: ['ram', 'memory', 'random access memory', 'xusuusta kumeelgaarka'],
      en: "💾 **RAM (Random Access Memory):**\nVolatile high-speed temporary memory used by computers, phones, and devices to hold active applications and working data currently processed by the CPU. Unlike SSD/HDD storage, RAM clears completely when powered off.",
      so: "💾 **RAM (Xusuusta Kumeelgaarka ah):**\nWaa xusuus aad u dheeraysa oo kombiyuutarka iyo mobilada u isticmaalaan inay ku qabtaan hawlaha iyo barnaamijyada hadda furan. Marka qalabka la damiyo, wax kasta oo RAM-ka ku jiray way tirmayaan.",
    },
    {
      keywords: ['ssd', 'hdd', 'storage', 'hard drive', 'kaydinta joogtada'],
      en: "💽 **SSD vs HDD:**\n- **SSD (Solid State Drive):** Uses flash memory chips, no moving parts, read/write speeds typically 500 MB/s to 7000+ MB/s (NVMe), highly shock resistant and fast.\n- **HDD (Hard Disk Drive):** Uses rotating magnetic platters and mechanical heads, slower (100-200 MB/s), vulnerable to drops, but cost-effective for mass storage.",
      so: "💽 **Farqiga u dhexeeya SSD iyo HDD:**\n- **SSD:** Wuxuu isticmaalaa microchips (flash memory), ma laha qaybo wareega, aad buu u dheereeyaa (5-10 jeer ka dheereeya HDD), qalabkuna si degdeg ah ayuu ku furmaa.\n- **HDD:** Wuxuu isticmaalaa saxan wareega, wuu ka gaabis badan yahay, waana jilicsan yahay haddii uu dhaco.",
    },
    {
      keywords: ['somalia', 'mogadishu', 'soomaaliya', 'muqdisho', 'caasimadda'],
      en: "🇸🇴 **Somalia & Mogadishu:**\nSomalia is a country in the Horn of Africa bordering Ethiopia, Djibouti, Kenya, the Gulf of Aden, and the Indian Ocean. Its capital and largest city is Mogadishu (Muqdisho). The official languages are Somali and Arabic, and the national currency is the Somali Shilling (SOS), alongside widespread USD electronic transactions.",
      so: "🇸🇴 **Soomaaliya & Muqdisho:**\nSoomaaliya waxay dhacdaa Geeska Afrika, xuduudna la leedahay Itoobiya, Jabuuti, Kiinya, Gacanka Cadmeed, iyo Badweynta Hindiya. Caasimadda dalka waa Muqdisho. Luqadaha rasmiga ah waa Af-Soomaali iyo Carabi, ganacsiguna inta badan wuxuu ku socdaa Doollarka Mareykanka ($) iyo Shilin Soomaaliga.",
    },
    {
      keywords: ['capital of', 'what is the capital', 'caasimada', 'caasimadda'],
      en: "🌍 **World Capitals Quick Reference:**\n- Somalia: Mogadishu\n- Kenya: Nairobi\n- Ethiopia: Addis Ababa\n- Djibouti: Djibouti City\n- United Arab Emirates: Abu Dhabi\n- Turkey: Ankara\n- United States: Washington, D.C.\n- United Kingdom: London\n- China: Beijing",
      so: "🌍 **Caasimadaha Dunida:**\n- Soomaaliya: Muqdisho\n- Kiinya: Nayroobi\n- Itoobiya: Addis Ababa\n- Jabuuti: Jabuuti\n- Imaaraadka: Abu Dhabi\n- Turkiga: Ankara\n- Mareykanka: Washington, D.C.\n- Ingiriiska: London\n- Shiinaha: Beijing",
    },
    {
      keywords: ['who are you', 'what are you', 'kumaad tahay', 'maxaad tahay', 'about you', 'maxaad qaban kartaa', 'what can you do'],
      en: "🤖 **About JILE Electronics AI Assistant:**\nI am the intelligent, general-purpose AI assistant for JILE Electronics Management System. I have complete knowledge of your electronics inventory, sales POS, customer debts, suppliers, purchases, expenses, and profit reports.\n\nI can:\n- Answer any questions about the store's products, stock levels, and pricing from MongoDB.\n- Provide real-time sales, profit (Admin only), debt, and expense reports.\n- Guide you step by step through every module in English and Somali.\n- Prepare business transactions (expenses, stock adjustments, payments, purchases) with your confirmation.\n- Answer general electronics, science, technology, and knowledge questions.",
      so: "🤖 **Nagu Saabsan — Kaaliyaha Garaadka ee JILE Electronics:**\nWaxaan ahay kaaliyaha garaadka macmalka ah (AI Assistant) ee loogu talagalay nidaamka JILE Electronics. Waxaan xog buuxda u leeyahay dhammaan maamulka dukaanka, alaabta, iibka, daymaha, kharashaadka, iyo warbixinada.\n\nWaxyaabaha aan kuu qaban karo:\n- Ka jawaabista su'aal kasta oo ku saabsan alaabta, qiimaha, iyo kaydka dukaanka.\n- Soo bandhigida warbixinada iibka, faa'iidada (Admin), daymaha, iyo kharashka.\n- Kugu hagida tallaabo-tallaabo dhammaan qaybaha nidaamka (Af-Soomaali & Ingiriis).\n- Diyaarinta hawlaha ganacsiga (kharash, hagaajin kayd, lacag-bixin) iyadoo lagugu celinayo ogolaansho.\n- Ka jawaabista su'aalaha guud ee sayniska, teknoolojiyada, iyo qalabka elektaroonigga ah.",
    },
  ],
};

module.exports = { SYSTEM_KNOWLEDGE };
