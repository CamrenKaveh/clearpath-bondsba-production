# ClearPath Live Demo Script for Trisura Group Ltd.
## Estimated Duration: 15-20 minutes

---

## Pre-Demo Checklist
- [ ] Browser is open to https://clearpathsbaloan.com
- [ ] Internet connection is stable
- [ ] Window is sized to show full content (1280px+ width recommended)
- [ ] Have sample numbers ready for calculations
- [ ] Open EXECUTIVE_SUMMARY.md for reference on key talking points

---

## SECTION 1: Platform Introduction (2 minutes)

**Talking Point:** Start with the vision—automation that empowers, not replaces.

### Script:
> "What you're about to see is **ClearPath**, a modular platform designed to automate routine underwriting tasks. Our architecture is intentionally flexible—built to plug into your existing processes without disrupting your workflow.
>
> We've structured this as a **modular monolith**. That means we can add new lending domains—surety, equipment finance, trade finance—all sharing a unified document parser and analysis engine. For Trisura specifically, we've built a **proof-of-concept Surety Bond Underwriting module** to show you exactly how this would work."

**Visuals on screen:**
- Show the Overview page (landing page)
- Point out the navigation: SBA 7(a) tools + Surety Bond Underwriting (Beta)
- Highlight the tagline: "SBA · Surety · Free Platform"

---

## SECTION 2: The SBA Module Demo (5 minutes)
### Purpose: Show a proven, production-ready workflow as context

**Talking Point:** "Let's walk through the SBA side first—this is production-ready and has been serving users reliably. We use the same architecture for Surety, which you'll see next."

### Step 1: Amortization Terminal (3 minutes)

1. **Navigate:** Click "Amortization Terminal" in the Overview
2. **Show the interface:**
   - Point out the key inputs: Loan amount, rate, term, program selection
   - Show the "FY2026 Fee Waiver" notice at the top (regulatory compliance)

3. **Demo a calculation:**
   - **Fill in example numbers:**
     - Program: "7(a) Equipment / Working Capital"
     - Principal: $500,000
     - Rate: "10.5%" (Prime 8.5% + 2% margin)
     - Term: "10 years"
   - Let the page calculate automatically
   
4. **Point out the outputs:**
   - Monthly Debt Service prominently displayed (3xl text)
   - Total Interest Cost (shows the real cost of the loan)
   - DSCR metric visible
   - Annual Interest Rate clearly shown
   
5. **Show the charts:**
   - **Principal vs. Interest Over Time** - "Watch how interest front-loads the early years, then principal accelerates"
   - **Balance Remaining** - "Clear visualization of payoff curve"
   - Explain: "These charts help borrowers understand the true cost and timeline"

6. **Show the amortization table:**
   - Scroll through the first 12 months
   - Point out monthly breakdown of principal vs. interest
   - Show balance declining predictably

**Talking Point:** "What you're seeing is professional-grade financial visualization. Every number is verified, every chart is accurate. Now let's build a formal term sheet from this."

### Step 2: Term Sheet Compilation (2 minutes)

1. **Show the GenerativeFeatures panel:**
   - Point out the two prominent feature cards
   - Explain: "These are our AI-powered services"
   - Note the status indicators (Complete/Pending)

2. **Scroll down to "Create Term Sheet" section**
   
3. **Click "Create Term Sheet" button**
   - Show the loading state
   - Wait for the modal to open
   
4. **When modal opens, show the term sheet:**
   - Header with "CLEARPATH SBA" logo
   - Professional layout: Parties, Facility Details, Covenants
   - **Key section:** FY2026 Manufacturer Guaranty Fee Waiver (highlighted if applicable)
   - Point out: "This is suitable for handing to a senior loan officer or client. Professional formatting, all required sections."

5. **Show export options:**
   - Highlight three buttons: **Print**, **PDF**, **HTML**
   - Explain: "Users can download as PDF for archiving, HTML for editing, or print directly"

6. **Click "PDF"** to show PDF generation (briefly)
   - Confirm the download started
   - Explain: "The PDF preserves all formatting, ready for email or presentation"

**Talking Point:** "This SBA workflow demonstrates our capability. Now let me show you how we bring the exact same architecture to your surety domain."

---

## SECTION 3: Surety Bond Underwriting Module Demo (8 minutes)
### Purpose: Show the proof-of-concept and explain how it would scale

**Talking Point:** "This is where we get specific to Trisura. We've built a working beta of the Surety module—using the same document parser, same analysis engine, but tailored for your specific underwriting workflow."

### Step 1: Navigate to Surety Dashboard (1 minute)

1. **Click "Surety Underwriting" in the navigation**
2. **Explain the interface:**
   - "This is the entry point for a surety bond underwriting case"
   - Point out the three KPI cards: Active Bonds, Portfolio Risk, Documents (all start at zero/empty as expected)
   - Explain the section description: "The analytics you're about to see use our shared document parser"

### Step 2: Demonstrate the As-Allowed Spreading Engine (4 minutes)

1. **Click "Open Spreading Engine"** button

2. **Explain the spreading methodology:**
   > "The As-Allowed Spreading Engine implements SBA 13(g)(2) financial spreading methodologies. For a surety underwriter, this is critical—you need standardized financial analysis that's defensible and consistent."

3. **Fill in sample financial data:**
   - **Gross Revenue:** 2,500,000
   - **Cost of Goods Sold:** 1,800,000
   - **Operating Expenses:** 400,000
   - Click **"Calculate Spreading"**

4. **Walk through the results:**
   - **Dark blue box (top):**
     - Gross Profit: $700,000 (28% of revenue)
     - EBITDA: $300,000 (12% margin)
   
   - **Health Score section:**
     - Status: "Strong" (green)
     - Assessment: "Contractor demonstrates strong cash generation and financial stability for bond support"
   
   - **Financial Waterfall Chart:**
     - Shows Revenue → Gross Profit → EBITDA waterfall
     - Visual representation of the cash flow
     - "This chart immediately shows if a contractor has the capacity to support bonds"

5. **Explain the underwriting value:**
   > "One click, and you have:
   > - Standardized financial analysis
   > - Health score for quick risk assessment
   > - Visual representation for stakeholder review
   > - All calculations automatically documented
   >
   > Today, this takes your team 2-3 hours. With ClearPath, it's a 5-minute verification."

### Step 3: Demonstrate the WIP Analyzer (3 minutes)

1. **Navigate back** - Click "Back to Surety Dashboard" or use browser back

2. **Click "Open WIP Analyzer"**

3. **Explain WIP monitoring:**
   > "Work-in-Progress tracking is the differentiator for surety underwriting. You need to see, in real time, which jobs are profitable and which are going sideways."

4. **Walk through the interface:**
   - **Portfolio KPIs (top):**
     - Total WIP: $4,850,000 (costs incurred)
     - Earned Revenue: $5,300,000 (amount billed)
     - Unearned WIP: $2,200,000 (remaining work)
     - At-Risk Jobs: 1 (flagged for attention)
   
   - **Active Jobs table (left side):**
     - Show three sample jobs
     - Highlight color coding:
       - Green: "On Track"
       - Amber: "At Risk" (negative margin)
       - Blue: "In Progress"
     - Point out: "Job selection triggers a detailed analysis below"
   
   - **WIP vs. Earned Revenue Trend (right side chart):**
     - Show the red line (costs) vs. green line (revenue)
     - Explain: "This shows profitability trends over time. If costs are outpacing revenue, you catch it immediately."
   
   - **Click on 'Highway Expansion B'** (the At Risk job)
     - Show the job detail box
     - Highlight: "At Risk" status badge
     - Show metrics: Contract value, costs to date, earned revenue, margin
     - Read the alert: "Contingent liability review recommended"
   
   - **Explain the workflow:**
     > "Your team uploads WIP reports monthly. ClearPath extracts the job data, calculates profitability, flags risks. Instead of manually building spreadsheets, you have a real-time risk dashboard."

**Talking Point:** "What you're seeing is not theoretical. This is a working tool, ready to be customized to your specific process. Let me explain how this gets integrated into your operation."

---

## SECTION 4: Architecture & Scalability (3 minutes)

**Talking Point:** "Let me show you why we built it this way, and how it scales for Trisura."

### Explain the Architecture:

1. **Three-Layer Pattern (reference EXECUTIVE_SUMMARY.md if needed):**
   ```
   Layer 1: Document Ingestion
   ↓
   Shared Parser (OCR + AI extraction)
   ↓
   Structured Data (JSON)
   ↓
   Layer 2: Domain-Specific Analysis
   ↓
   SBA Spreading | Surety Spreading | (Future: Equipment Finance, Trade, etc.)
   ↓
   Layer 3: Professional Presentation
   ↓
   PDF Reports | Interactive Dashboards | Export Formats
   ```

2. **Key Benefits:**
   - **One parser, multiple domains:** Upload a contractor financial statement once. Use it for SBA underwriting, surety analysis, and equipment financing—all from the same extracted data.
   - **Extensible:** Add a new lending domain (equipment finance, trade finance) without touching existing code. Estimated 4-6 weeks per new domain.
   - **Consistent experience:** Every domain uses the same design system, accessibility standards, compliance framework.

3. **For Trisura Specifically:**
   - **Faster time-to-launch:** Surety module timeline is 8-10 weeks (Phase 1-2 in TRISURA_PITCH.md)
   - **Lower risk:** We can add features and underwriting rules incrementally
   - **Your data ownership:** All data stays in your infrastructure. ClearPath is the software layer.

---

## SECTION 5: Business Case (2 minutes)

**Talking Point:** "Let's talk about impact. What does this mean for Trisura?"

### Share Key Numbers (from EXECUTIVE_SUMMARY.md):

**Current State (Without ClearPath):**
- Cycle time per bond: **8-13 hours** (Monday–Friday)
- Annual labor per underwriter: **400-600 hours**
- Cost to Trisura: **$50K-$75K annually per underwriter** in lost productivity

**With ClearPath:**
- Cycle time per bond: **1.25 hours** (completed by Tuesday afternoon)
- Annual labor per underwriter: **75-150 hours** (reduction of 300-400 hours)
- Savings per underwriter: **$37K-$50K annually**
- Scaling benefit: **50% growth in underwriting capacity without new hires**

**3-Year ROI (from EXECUTIVE_SUMMARY.md):**
- Initial investment: **$100K-$150K** (Phase 1-2)
- Annual benefit (Year 1): **$180K** (assume 5 underwriters, conservative estimate)
- 3-year cumulative benefit: **$500K+**
- **Break-even: 18 months**

---

## SECTION 6: Implementation & Next Steps (1 minute)

**Talking Point:** "Here's how we move from proof-of-concept to production."

### Timeline (from TRISURA_PITCH.md):

**Phase 1 (Weeks 1-4): Foundation**
- Backend API implementation
- Database schema (PostgreSQL/Supabase)
- Authentication and authorization
- Document parser integration with Trisura's systems

**Phase 2 (Weeks 5-8): Customization**
- Financial spreading rules (your specific methodologies)
- WIP tracking tailored to your job types
- Risk scoring custom to Trisura's underwriting guidelines
- Report templates matching your brand

**Phase 3 (Weeks 9-12): Testing & Refinement**
- UAT with your team
- Performance optimization
- Security audit and compliance review
- Go-live preparation

**Cost Estimate:**
- Phase 1-2: **$100K-$150K**
- Phase 3 & ongoing support: **$50K-$75K annually**

---

## SECTION 7: Close & Questions

**Talking Point:** "Before we wrap up, let me leave you with the key questions we should discuss."

### Key Questions for Discovery:

1. **Workflow Integration:**
   - "How do contractors currently submit financial documents? Email? Portal? We need to understand your data intake flow."
   
2. **Customization Scope:**
   - "What are your critical underwriting metrics? We've built SBA 13(g)(2) spreading—do you use that framework, or different ones?"
   
3. **Data Ownership & Security:**
   - "Where do you want this hosted? Trisura infrastructure, cloud (AWS/Azure), or SaaS? We support all models."
   
4. **Team Adoption:**
   - "How many underwriters would use this initially? Who would be the champion on your side?"

5. **Regulatory & Compliance:**
   - "Are there specific audit/compliance requirements for underwriting tools in your market?"

---

## APPENDIX: Troubleshooting Live Demo

### If the application is slow to load:
- "The app is cached in browsers. Let me refresh." → Hit F5 or Cmd+R
- "If needed, we can show the pre-recorded walkthrough."

### If a calculation or PDF generation fails:
- "This is a demo environment. In production, we've built error recovery and fallbacks."
- "Let me show you the logs in our monitoring dashboard [if available]."

### If the user asks about backend/API details:
- "We use a serverless architecture for scalability. As part of Phase 1, we'd integrate with your specific systems."
- "All data is encrypted in transit and at rest. We follow HIPAA-equivalent security practices."

### If the user asks about customization timeline:
- "Each new underwriting rule or metric adds 1-2 weeks during Phase 2. We've designed it to be modular so you can add features without rewriting the core."

---

## Post-Demo Next Steps

1. **Send follow-up email:**
   - Recap key points (cycle time reduction, ROI)
   - Attach EXECUTIVE_SUMMARY.md, TRISURA_PITCH.md, DEPLOYMENT_SUMMARY.md
   - Link to live platform: https://clearpathsbaloan.com
   - Propose a discovery call within 1 week

2. **Schedule Discovery Call (60 min):**
   - Answer the key questions above
   - Walk through your current workflow
   - Discuss customization needs and timeline
   - Review budget and decision process

3. **Prepare Phase 1 Proposal:**
   - Based on discovery call, refine scope and timeline
   - Provide detailed cost breakdown
   - Define success metrics (cycle time reduction, error rate, user adoption)

---

**Good luck with the demo! You've built something impressive.** 🚀
