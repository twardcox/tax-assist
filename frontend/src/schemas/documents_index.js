export const schema = {
  label: "Documents Index",
  description: "Track which tax documents you have collected and which are still missing. Helps ensure you have everything before filing.",
  groups: [
    {
      label: "W-2 Forms",
      type: "list",
      key: "w2_forms",
      addLabel: "Add W-2",
      itemLabel: "W-2",
      description: "One W-2 per employer. Employers must mail W-2s by January 31.",
      source: "Your mailbox and employer HR portal (ADP, Paychex, Workday, etc.).",
      itemGroups: [
        {
          label: "W-2 Document",
          fields: [
            { key: "employer", label: "Employer Name", type: "text", description: "The employer who issued this W-2.", source: "Box c on the W-2." },
            { key: "file", label: "File Path / Location", type: "text", placeholder: "e.g., /documents/2025/w2-employer.pdf", description: "Where you saved this document.", source: "Your file system or cloud storage." },
            { key: "processed", label: "Entered into System", type: "boolean", description: "Whether you have entered this W-2's values into the Income section.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "1099-NEC (Non-Employee Compensation)",
      type: "list",
      key: "form_1099_nec",
      addLabel: "Add 1099-NEC",
      itemLabel: "1099-NEC",
      description: "Received from each client or payer who paid you $600+ for services.",
      source: "Payers must send 1099-NEC by January 31.",
      itemGroups: [
        {
          label: "1099-NEC Document",
          fields: [
            { key: "payer", label: "Payer Name", type: "text", description: "Who paid you.", source: "Box 1 issuer name on the form." },
            { key: "amount", label: "Amount (Box 1)", type: "currency", description: "Non-employee compensation amount.", source: "Box 1 on the 1099-NEC." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Income", type: "boolean", description: "Whether this amount is included in your self-employment income.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "1099-INT (Interest Income)",
      type: "list",
      key: "form_1099_int",
      addLabel: "Add 1099-INT",
      itemLabel: "1099-INT",
      description: "Received from banks and financial institutions for interest income of $10+.",
      source: "Bank and credit union statements; usually available online by mid-January.",
      itemGroups: [
        {
          label: "1099-INT Document",
          fields: [
            { key: "institution", label: "Financial Institution", type: "text", description: "The bank or institution that paid the interest.", source: "Box 1 issuer name on the form." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Income", type: "boolean", description: "Whether this interest is included in your income.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "1099-DIV (Dividends)",
      type: "list",
      key: "form_1099_div",
      addLabel: "Add 1099-DIV",
      itemLabel: "1099-DIV",
      description: "Received from brokerages and mutual funds for dividend income.",
      source: "Your brokerage tax documents, available in their online portal by mid-February.",
      itemGroups: [
        {
          label: "1099-DIV Document",
          fields: [
            { key: "institution", label: "Institution", type: "text", description: "The brokerage or fund company.", source: "Issuer name on the form." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Income", type: "boolean", description: "Whether dividends are included in your income.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "1099-B (Brokerage Sales)",
      type: "list",
      key: "form_1099_b",
      addLabel: "Add 1099-B",
      itemLabel: "1099-B",
      description: "Received from brokerages for stock, ETF, mutual fund, and crypto sales. Reports proceeds and cost basis.",
      source: "Your brokerage year-end tax documents.",
      itemGroups: [
        {
          label: "1099-B Document",
          fields: [
            { key: "institution", label: "Institution / Broker", type: "text", description: "The brokerage that reported the sales.", source: "Issuer name on the form." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Investments", type: "boolean", description: "Whether the gains/losses are reflected in your investments section.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "1099-R (Retirement Distributions)",
      type: "list",
      key: "form_1099_r",
      addLabel: "Add 1099-R",
      itemLabel: "1099-R",
      description: "Received for any distribution from an IRA, 401(k), pension, or annuity.",
      source: "Your retirement account custodian (Fidelity, Vanguard, TIAA, etc.) by January 31.",
      itemGroups: [
        {
          label: "1099-R Document",
          fields: [
            { key: "institution", label: "Institution", type: "text", description: "The custodian that issued the distribution.", source: "Issuer name on the form." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Retirement", type: "boolean", description: "Whether this distribution is reflected in your retirement section.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "Form 1098 (Mortgage Interest)",
      type: "list",
      key: "form_1098",
      addLabel: "Add 1098",
      itemLabel: "Form 1098",
      description: "Received from each mortgage lender reporting interest paid. Required to claim mortgage interest deduction.",
      source: "Your mortgage servicer by January 31. Also available in your online loan portal.",
      itemGroups: [
        {
          label: "1098 Document",
          fields: [
            { key: "lender", label: "Lender Name", type: "text", description: "The mortgage servicer who sent the form.", source: "Box 1 issuer name." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Real Estate", type: "boolean", description: "Whether mortgage interest is entered in your real estate section.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "Form 1098-T (Tuition)",
      type: "list",
      key: "form_1098t",
      addLabel: "Add 1098-T",
      itemLabel: "Form 1098-T",
      description: "Received from eligible colleges and universities. Required to claim education credits (American Opportunity or Lifetime Learning).",
      source: "The student's school, typically available in their student portal by January 31.",
      itemGroups: [
        {
          label: "1098-T Document",
          fields: [
            { key: "school", label: "School Name", type: "text", description: "The educational institution.", source: "Issuer name on the form." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved this document.", source: "Your file system." },
            { key: "processed", label: "Entered into Dependents", type: "boolean", description: "Whether tuition is reflected in the dependent's education section.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "Prior Year Returns",
      type: "list",
      key: "prior_returns",
      addLabel: "Add Prior Return",
      itemLabel: "Prior Return",
      description: "Prior year tax returns. Useful for carry-forward items (capital loss carryover, passive activity losses, NOLs) and as a reference for the scanner.",
      source: "Your CPA, TurboTax account, or IRS Get Transcript tool at irs.gov.",
      itemGroups: [
        {
          label: "Prior Return",
          fields: [
            { key: "year", label: "Tax Year", type: "number", placeholder: "2024", description: "The year of the return.", source: "Top of Form 1040." },
            { key: "file", label: "File Path / Location", type: "text", description: "Where you saved the PDF.", source: "Your file system." },
            { key: "processed", label: "Reviewed", type: "boolean", description: "Whether you have reviewed this return for carryover items.", source: "Your own tracking." },
          ],
        },
      ],
    },
    {
      label: "Business Documents",
      path: "business_documents",
      fields: [
        { key: "bank_statements", label: "Bank Statements", type: "boolean", description: "12 months of business bank statements. Required for audit support and profit/loss verification.", source: "Your business bank's online portal." },
        { key: "profit_loss_statement", label: "P&L Statement", type: "boolean", description: "Year-end profit and loss statement from your accounting software.", source: "QuickBooks, Wave, FreshBooks, or your accountant." },
        { key: "mileage_log", label: "Mileage Log", type: "boolean", description: "Contemporaneous mileage log with date, destination, business purpose, and miles. Required to substantiate vehicle deductions.", source: "Your own records, MileIQ, or similar app." },
        { key: "receipts_organized", label: "Receipts Organized", type: "boolean", description: "Business expense receipts organized by category. IRS requires receipts for expenses over $75.", source: "Your email, receipt apps (Expensify, Dext), or filing system." },
      ],
    },
    {
      label: "Real Estate Documents",
      path: "real_estate_documents",
      fields: [
        { key: "closing_disclosures", label: "Closing Disclosures", type: "boolean", description: "CD or HUD-1 from any property purchase, sale, or refinance this year.", source: "Your title company or attorney's closing package." },
        { key: "property_tax_bills", label: "Property Tax Bills", type: "boolean", description: "Annual property tax bills showing amount paid.", source: "Your county tax assessor's website or mail." },
        { key: "lease_agreements", label: "Lease Agreements", type: "boolean", description: "Current lease agreements for rental properties. Supports rental income and expense reporting.", source: "Your files or property management company." },
        { key: "rental_ledgers", label: "Rental Ledgers", type: "boolean", description: "Record of all rent received and expenses paid by property.", source: "Your property management software or spreadsheet." },
        { key: "improvement_receipts", label: "Improvement Receipts", type: "boolean", description: "Receipts for capital improvements (not repairs). These add to your cost basis.", source: "Your contractor invoices and payment records." },
      ],
    },
    {
      label: "Notes",
      fields: [
        {
          key: "notes",
          label: "Notes",
          type: "textarea",
          placeholder: "Document collection notes…",
          description: "Notes about missing documents, expected arrival dates, or documents you need to request.",
          source: "Your own notes.",
        },
      ],
    },
  ],
};
