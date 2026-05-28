# ClearPath Setup Guide

## Overview
ClearPath is a modular SaaS application with two domains:
1. **SBA Loan Processing** - Existing functionality for 7(a) loan underwriting
2. **Surety Bond Underwriting** - New domain for Trisura commercial surety analysis

## Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (https://supabase.com)
- Vercel account (optional, for deployment)

## Installation

### 1. Install Dependencies
```bash
npm install
```

This installs the required packages including:
- React 18.3.1
- Vite 6.0.5
- Tailwind CSS 3.4.17
- @supabase/supabase-js 2.43.4
- Recharts 3.8.1

### 2. Configure Environment Variables

Create/update `.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

You can find these in your Supabase project settings:
- Settings → API → Project URL → `VITE_SUPABASE_URL`
- Settings → API → Project API Keys (anon/public) → `VITE_SUPABASE_ANON_KEY`

### 2A. Configure Billing + Stripe Variables

For subscription checkout, webhooks, and billing settings, set these server-side env vars in local `.env.local` and Vercel project settings:

```env
APP_URL=http://127.0.0.1:4173

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_YEARLY=
STRIPE_PRICE_PROFESSIONAL_MONTHLY=
STRIPE_PRICE_PROFESSIONAL_YEARLY=
STRIPE_PRICE_OPERATIONS_MONTHLY=
STRIPE_PRICE_OPERATIONS_YEARLY=
STRIPE_PRICE_FILE_PREP_PILOT=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Important:
- Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in client-side env vars.
- Use Stripe test mode first, then switch to live keys for cutover.
- Keep all price IDs server-side; UI calls checkout APIs only.

### 3. Set Up Surety Database Tables

**Option A: Via Supabase Dashboard (Recommended)**

1. Log into Supabase dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the contents of `/src/domains/surety/db/schema.sql`
5. Paste and run

**Option B: Via SQL Command**

```bash
# If using Supabase CLI:
supabase db push
```

### 4. Verify Database Setup

Check that all tables were created:
- `surety_applications`
- `surety_analyses`
- `surety_documents`
- `surety_risk_factors`
- `surety_recommendations`

## Running the Application

### Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`

### Production Build
```bash
npm run build
npm run preview
```

## Project Structure

```
clearpath/
├── api/v1/surety/
│   └── process-application.js      # Serverless function for document processing
├── src/
│   ├── AppRouter.jsx               # Main router (SBA + Surety)
│   ├── App.jsx                     # SBA loan processing UI
│   ├── main.jsx                    # Vite entry point
│   ├── index.css                   # Global styles
│   ├── domains/
│   │   └── surety/
│   │       ├── api/
│   │       │   └── suretyClient.js # API client for Surety endpoints
│   │       ├── components/
│   │       │   ├── SuretyApplicationForm.jsx     # Upload & analyze form
│   │       │   └── AnalysisResults.jsx           # Results display
│   │       └── db/
│   │           ├── schema.sql                    # Database schema
│   │           └── suretyDatabase.js             # Database service layer
│   └── components/                 # Shared components
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Application Flow

### Surety Bond Analysis Flow
1. **Upload Document** → `SuretyApplicationForm.jsx`
2. **Parse Document** → `/api/v1/surety/process-application.js`
3. **Extract Financials** → Shared core parser
4. **Run Analysis** → Spreading Engine + WIP Analyzer
5. **Display Results** → `AnalysisResults.jsx`
6. **Persist to DB** → `suretyDatabase.js` (optional, not yet integrated)

### Database Persistence (Optional)
To save analysis results:

```javascript
import { createApplication } from './src/domains/surety/db/suretyDatabase';

// After analysis completes:
await createApplication({
  documentId: analysis.metadata.documentId,
  documentName: document.name,
  documentType: 'balance-sheet',
  applicantName: 'Borrower Inc.',
  businessType: 'Construction',
  industry: 'General Contracting',
  analysis: analysis // Full analysis result
});
```

## API Endpoints

### POST /api/v1/surety/process-application
Process a financial document and run analyses.

**Request:**
```json
{
  "documentContent": "text content of document",
  "documentName": "balance_sheet_2024.txt",
  "documentType": "balance-sheet",
  "analysisType": "full"
}
```

**Response:**
```json
{
  "success": true,
  "metadata": { ... },
  "parsed": {
    "normalized": { ... },
    "raw": "..."
  },
  "spreadingAnalysis": { ... },
  "wipAnalysis": { ... },
  "underwritingSummary": { ... }
}
```

## Database Schema

### surety_applications
Main application record with denormalized key metrics for query performance.

**Key fields:**
- `id` (UUID) - Primary key
- `document_id` (VARCHAR) - Unique identifier for uploaded document
- `applicant_name` (VARCHAR) - Borrower/applicant name
- `overall_risk_level` (VARCHAR) - critical | high | moderate | low
- `status` (VARCHAR) - new | in_review | approved | rejected
- `analysis_result` (JSONB) - Full analysis JSON blob

### surety_analyses
Detailed analysis results linked to application.

**Key fields:**
- `application_id` (UUID FK) - Reference to surety_applications
- `spreading_analysis` (JSONB) - As-Allowed adjustment details
- `wip_analysis` (JSONB) - Work-in-progress & bond exposure
- `underwriting_summary` (JSONB) - Risk assessment & recommendations

### surety_risk_factors
Individual risk factors identified during analysis.

**Key fields:**
- `application_id` (UUID FK)
- `severity` (VARCHAR) - critical | high | medium | low
- `code` (VARCHAR) - NEGATIVE_MARGIN | HIGH_CONCENTRATION | etc.
- `is_resolved` (BOOLEAN) - Track resolution status

### surety_recommendations
Underwriting recommendations for the application.

**Key fields:**
- `application_id` (UUID FK)
- `priority` (INTEGER) - 0 (low) to 3 (critical)
- `recommendation` (TEXT) - Recommendation text
- `completed_at` (TIMESTAMP) - When recommendation was actioned

## Common Tasks

### Test Surety Analysis
1. Navigate to `http://localhost:5173`
2. Click "Surety Bond Underwriting" tab
3. Upload a financial document (text, PDF, CSV)
4. Review analysis results

### Check Application Status
```javascript
// In browser console:
import { getApplication } from './src/domains/surety/db/suretyDatabase';
const result = await getApplication('app_uuid_here');
console.log(result);
```

### Query Analytics
```javascript
import { getAnalyticsSummary } from './src/domains/surety/db/suretyDatabase';
const summary = await getAnalyticsSummary();
console.log(summary); // { total, byRiskLevel, byStatus }
```

## Troubleshooting

### "Supabase not configured. Database features will be disabled."
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Restart dev server: `npm run dev`

### "Failed to parse document"
- Ensure document is text-readable (TXT, CSV) or supported format (PDF, DOCX)
- Check file size < 10MB
- Verify document contains financial data (amounts, line items)

### Tables don't exist in Supabase
- Run `/src/domains/surety/db/schema.sql` in Supabase SQL Editor
- Enable RLS policies (already in schema)

### API 500 Error during processing
- Check `/api/v1/surety/process-application.js` exists
- Verify serverless functions are deployed to Vercel
- Check function logs in Vercel dashboard

## Deployment

### To Vercel
```bash
git add .
git commit -m "Add Surety domain"
git push origin main
```

Vercel automatically:
- Builds the frontend (Vite)
- Deploys serverless functions in `/api`
- Sets environment variables from `.env.local`

## Next Steps

1. **Authentication** - Add Supabase Auth for user isolation
2. **Historical Analysis** - Create dashboard to view past analyses
3. **PDF Export** - Integrate term sheet generation (already scaffolded in plan)
4. **Advanced Parsing** - Integrate OCR for PDF documents
5. **Admin Dashboard** - Analytics and risk factor management

## Support

For issues or questions:
1. Check application logs: Browser console + Vercel function logs
2. Review error messages in UI
3. Verify environment variables
4. Check Supabase connection status (green dot in footer)
