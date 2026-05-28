# ClearPath Modular Monolith Architecture

## Overview

ClearPath uses a **modular monolith** pattern: a single codebase with clear domain boundaries, allowing multiple lending/bond domains to share a common document parsing engine while maintaining independent business logic.

```
┌─────────────────────────────────────────────────────────────────┐
│                       BROWSER / CLIENT                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  AppRouter.jsx   │ (Page switching SBA ↔ Surety)
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────────┐   ┌─────▼─────┐    ┌───────▼──────┐
    │ SBA Domain  │   │  Surety   │    │   Shared     │
    │ (pages      │   │  Domain   │    │   Services   │
    │  route to   │   │ (pages    │    │ (auth, core) │
    │  /api/v1/   │   │  route to │    │              │
    │  sba-loans) │   │ /api/v1/  │    │              │
    │             │   │  surety)  │    │              │
    └────┬────────┘   └─────┬─────┘    └───────┬──────┘
         │                  │                   │
         │                  │     ┌─────────────┘
         │                  │     │
    ┌────┴────────┐   ┌─────┴─────┐
    │  API Layer  │   │ Shared     │
    │  /api/v1/   │   │ Parser &   │
    │  sba-loans/ │   │ Utils      │
    │  *.js       │   │            │
    │             │   └──────┬─────┘
    │             │          │
    └────┬────────┘   ┌──────▼──────┐
         │            │ Core Engine  │
         │            │ (Document    │
         │            │  Parser,     │
         │            │  Normalizer) │
         │            └──────┬───────┘
         │                   │
         └───────────────────┼──────────────┐
                             │              │
                         ┌───▼────┐  ┌──────▼──────┐
                         │Database│  │External AI  │
                         │(Supabase)  │APIs (Claude)│
                         └────────┘  └─────────────┘
```

---

## Directory Structure

### Frontend (`src/`)

```
src/
├── AppRouter.jsx               # Main router (SBA ↔ Surety switching)
├── App.jsx                     # SBA domain landing page
├── main.jsx                    # React entry point
│
├── core/
│   ├── parser-instance.js      # Singleton: getParserInstance()
│   └── router.js               # Router utilities
│
├── shared/                     # Shared across all domains
│   ├── document-parser/
│   │   ├── index.js            # DocumentParserEngine class
│   │   ├── ocr-engine.js       # OCR extraction
│   │   ├── table-extractor.js  # Table data extraction
│   │   └── data-normalizer.js  # Standardize output format
│   │
│   └── utils/
│       ├── pdfExport.js        # PDF generation
│       └── [other shared utilities]
│
├── domains/
│   │
│   ├── sba-loans/              # Domain: SBA 7(a) Lending
│   │   ├── components/
│   │   │   ├── AmortizationTerminal.jsx
│   │   │   ├── AmortizationCharts.jsx
│   │   │   ├── TermSheetTemplate.jsx
│   │   │   ├── GenerativeFeatures.jsx
│   │   │   ├── PremiumForm.jsx
│   │   │   ├── EligibilityScreener.jsx
│   │   │   └── DocumentChecklist.jsx
│   │   │
│   │   ├── services/           # Business logic
│   │   │   ├── spreadingEngine.js
│   │   │   └── termSheetGenerator.js
│   │   │
│   │   └── index.jsx            # Domain entry point
│   │
│   └── surety/                 # Domain: Surety Bond Underwriting
│       ├── components/
│       │   ├── SuretyDashboard.jsx
│       │   ├── SuretyApplicationForm.jsx
│       │   ├── SpreadingEngine.jsx
│       │   ├── WIPAnalyzer.jsx
│       │   └── AnalysisResults.jsx
│       │
│       ├── services/           # Business logic
│       │   ├── spreadingEngine.js
│       │   └── wipAnalyzer.js
│       │
│       ├── db/
│       │   └── suretyDatabase.js
│       │
│       ├── api/
│       │   └── suretyClient.js
│       │
│       └── index.jsx            # Domain entry point
```

### Backend (`api/`)

```
api/
├── ai.js                       # Shared AI utilities
├── middleware/
│   └── validation.js           # HTTP validation
│
└── v1/
    ├── sba-loans/              # SBA domain endpoints
    │   ├── upload.js
    │   ├── calculate-amortization.js
    │   └── generate-term-sheet.js
    │
    └── surety/                 # Surety domain endpoints
        ├── upload.js
        ├── spreading.js
        ├── analyze.js
        └── process-application.js
```

---

## Module Boundaries

### Shared Core Layer (src/shared/)

**Responsibility:** Document ingestion, extraction, normalization

- Parse PDFs, images, CSV files via OCR
- Extract tables and text
- Normalize financial data into standard schema
- Handle file format conversions

**Does NOT do:**
- Domain-specific calculations
- Business rule enforcement
- UI/Presentation

**Used by:** Both SBA and Surety domains

---

## Adding a New Domain

```
src/domains/equipment-finance/
├── components/
├── services/
├── db/
├── api/
└── index.jsx

api/v1/equipment-finance/
├── upload.js
└── [domain-specific endpoints]
```

The core parser is automatically reused. No duplication needed.

---

## Important Patterns

### Parser Singleton
```javascript
import { getParserInstance } from '@/core/parser-instance.js';
const parser = getParserInstance();
const result = await parser.parse(document, options);
```

### Domain Isolation
- ✅ Can import from shared/ and own domain/
- ❌ Cannot import from other domain/ folders
- API routes are the contract between domains

---

## API Contracts

**SBA Domain:**
```
POST /api/v1/sba-loans/upload → parsed financials
POST /api/v1/sba-loans/calculate-amortization → schedule
POST /api/v1/sba-loans/generate-term-sheet → PDF
```

**Surety Domain:**
```
POST /api/v1/surety/upload → parsed financials
POST /api/v1/surety/spreading → health scores
POST /api/v1/surety/analyze → risk assessment
```

---

## Phase 1 Authentication (Weeks 1-2)

- [ ] Add Google OAuth middleware
- [ ] Implement role-based access control
- [ ] Add audit logging to all routes
- See: `/Users/camre/clearpath/SECURITY_ARCHITECTURE_PHASE_1.md`

---

## Deployment

- **Frontend:** Vercel
- **Backend:** Vercel Serverless Functions (api/)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Cloud Storage
