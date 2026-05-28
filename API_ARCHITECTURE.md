# ClearPath Modular Monolith - API Architecture

## Overview

This document describes the API architecture for ClearPath's new modular monolith supporting both SBA 7(a) loan processing and Trisura commercial surety underwriting.

The architecture consists of:
1. **Shared Core Parser** - Centralized document ingestion, OCR, and table extraction
2. **Domain-Specific Services** - Isolated business logic for each domain
3. **API Controllers** - RESTful endpoints that orchestrate the pipeline
4. **Core Router** - Central orchestrator coordinating domains and services

---

## Directory Structure

```
/src
├── core/
│   ├── parser-instance.js      # Singleton parser for server-side use
│   └── router.js               # Central orchestrator
├── shared/
│   ├── document-parser/
│   │   ├── index.js            # Main DocumentParserEngine
│   │   ├── ocr-engine.js       # OCR extraction
│   │   ├── table-extractor.js  # Table detection & extraction
│   │   └── data-normalizer.js  # Data normalization to standard schema
│   ├── types/
│   ├── utils/
│   └── ...
├── domains/
│   ├── sba-loans/              # SBA 7(a) domain (existing)
│   │   ├── components/
│   │   ├── services/
│   │   └── routes/
│   └── surety/                 # Trisura surety domain (new)
│       ├── components/
│       ├── services/
│       │   ├── spreadingEngine.js    # As-allowed adjustments
│       │   └── wipAnalyzer.js        # WIP & bond analysis
│       └── routes/
└── App.jsx                     # Frontend entry point

/api
├── middleware/
│   └── validation.js           # Shared validation helpers
├── v1/
│   ├── surety/
│   │   ├── upload.js           # Document upload & parsing
│   │   ├── analyze.js          # Comprehensive analysis
│   │   ├── spreading.js        # Spreading calculations
│   │   └── process.js          # Full pipeline (recommended)
│   └── sba/
│       └── loan.js             (future)
└── ai.js                       # Existing AI endpoint
```

---

## API Endpoints

### Surety Domain

#### 1. Full Pipeline (Recommended)
```
POST /api/v1/surety/process
```

**Purpose:** Complete end-to-end processing for surety bond applications.

**Request:**
```json
{
  "document": {
    "name": "financials_2024.pdf",
    "content": "base64_encoded_pdf_or_text_content",
    "type": "application/pdf"
  },
  "documentType": "balance-sheet",
  "analysisType": "full",
  "wipDetails": {
    "contracts": [
      {
        "id": "C001",
        "name": "Bridge Project",
        "status": "in-progress",
        "contractValue": 5000000,
        "costToDate": 3200000,
        "percentComplete": 65,
        "performanceBondValue": 500000,
        "paymentBondValue": 500000
      }
    ]
  },
  "spreadingOptions": {
    "underwriter": "John Doe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "documentId": "doc_...",
      "analysisDate": "2026-04-25T...",
      "analysisType": "full"
    },
    "parsed": {
      "raw": { ... },
      "normalized": {
        "documentMetadata": { ... },
        "financials": { ... },
        "business": { ... },
        "owners": { ... },
        "suretyContext": { ... }
      }
    },
    "spreadingAnalysis": {
      "original": { ... },
      "adjustments": { ... },
      "asAllowed": { ... },
      "riskFactors": [ ... ]
    },
    "wipAnalysis": {
      "wipSummary": { ... },
      "contractAnalysis": [ ... ],
      "marginAnalysis": { ... },
      "bondExposure": { ... },
      "riskAssessment": [ ... ]
    },
    "underwritingSummary": {
      "overallRiskLevel": "moderate",
      "keyMetrics": {
        "asAllowedNetIncome": 250000,
        "asAllowedMarginPercent": 3.5,
        "totalWIP": 5000000,
        "activeContracts": 3,
        "averageGrossMargin": 12.5,
        "totalBondValue": 3000000,
        "bondsAtRiskPercent": 35
      },
      "recommendations": [
        "Address identified moderate risk factors",
        "Request clarification on specific metrics"
      ],
      "warnings": [
        {
          "source": "spreading",
          "code": "LOW_MARGIN",
          "severity": "high",
          "message": "Profit margin below 5%"
        },
        {
          "source": "wip",
          "code": "HIGH_CONCENTRATION",
          "severity": "medium",
          "message": "High concentration in 2 large contracts (>30% of WIP)"
        }
      ]
    }
  },
  "timestamp": "2026-04-25T..."
}
```

---

#### 2. Upload & Parse
```
POST /api/v1/surety/upload
```

**Purpose:** Upload a document and get parsed/normalized data (without analysis).

**Request:**
```json
{
  "document": {
    "name": "financials_2024.pdf",
    "content": "...",
    "type": "application/pdf"
  },
  "documentType": "income-statement",
  "extractTables": true,
  "extractText": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_...",
    "documentName": "financials_2024.pdf",
    "parsed": {
      "raw": { ... },
      "normalized": { ... },
      "metadata": { ... }
    },
    "qualityMetrics": { ... }
  }
}
```

**Use case:** When you want to parse a document first, review the data, then decide what analysis to run.

---

#### 3. Analyze (Post-Parse)
```
POST /api/v1/surety/analyze
```

**Purpose:** Run analysis on already-parsed data.

**Request:**
```json
{
  "normalizedData": { ... },
  "analysisType": "full",
  "wipDetails": { ... },
  "spreadingOptions": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "spreadingAnalysis": { ... },
    "wipAnalysis": { ... },
    "underwritingSummary": { ... }
  }
}
```

**Use case:** When you have normalized data and need to run multiple analyses or re-analyze with different parameters.

---

#### 4. Spreading Only
```
POST /api/v1/surety/spreading
```

**Purpose:** Run only the as-allowed spreading calculations.

**Request:**
```json
{
  "normalizedData": { ... },
  "underwriter": "John Doe",
  "adjustmentRules": {
    "ownerSalaryAdjustment": 0.15,
    "depreciationAdd": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": { ... },
    "adjustments": { ... },
    "asAllowed": { ... },
    "riskFactors": [ ... ]
  }
}
```

**Use case:** Specialized endpoint for spreading calculations only (e.g., when analyzing non-construction businesses).

---

## Data Flow

### Full Pipeline (Recommended Flow)

```
Request Document
       ↓
POST /api/v1/surety/process
       ↓
┌─────────────────────────────────┐
│ Core Router                     │
│  ├─ Parse Document              │
│  │  ├─ OCREngine.extract()      │
│  │  ├─ TableExtractor.extract() │
│  │  └─ DataNormalizer.normalize()
│  │                              │
│  ├─ Transform for Surety        │
│  │                              │
│  ├─ Run Spreading Analysis      │
│  │  └─ SpreadingEngine          │
│  │                              │
│  ├─ Run WIP Analysis            │
│  │  └─ WIPAnalyzer              │
│  │                              │
│  └─ Generate Summary            │
└─────────────────────────────────┘
       ↓
Complete Analysis Response
```

### Step-by-Step Flow (Advanced)

```
1. POST /api/v1/surety/upload
   → Get documentId + normalized data

2. POST /api/v1/surety/analyze
   → Pass normalizedData + analysis options
   → Get spreading + WIP analysis

3. (Optional) POST /api/v1/surety/spreading
   → Re-run spreading with different rules
```

---

## Shared Contract Layer

All domains consume data through the **normalized schema** defined by `DataNormalizer`.

### Standard Normalized Schema

```javascript
{
  documentMetadata: {
    type: 'income-statement',
    extractedAt: '2026-04-25T...',
    sourceFormat: 'pdf'
  },
  financials: {
    revenue: 7000000,
    expenses: 5500000,
    netIncome: 1500000,
    grossProfit: 2500000,
    assets: { current: 2000000, fixed: 3000000, total: 5000000 },
    liabilities: { current: 1000000, longTerm: 2000000, total: 3000000 },
    equity: 2000000,
    ratios: { currentRatio: 2.0, debtToEquity: 1.5, profitMargin: 21.4 }
  },
  business: {
    name: "ABC Construction LLC",
    industry: "Construction",
    numberOfEmployees: 45,
    businessType: "llc",
    taxId: "12-3456789"
  },
  owners: {
    principals: [
      {
        name: "John Smith",
        title: "Owner/President",
        ownership: 50,
        personalCreditScore: 750,
        netWorth: 500000
      }
    ],
    guarantors: []
  },
  raw: { ... },
  suretyContext: {
    underwritingDate: '2026-04-25T...',
    spreaderRequired: true,
    wipAnalysisRequired: true
  }
}
```

### Domain-Specific Augmentation

Domains can extend this with context-specific fields:

**Surety Domain:**
```javascript
{
  ...normalizedData,
  suretyContext: {
    underwritingDate: '...',
    spreaderRequired: true,
    wipAnalysisRequired: true
  }
}
```

**SBA Domain (future):**
```javascript
{
  ...normalizedData,
  sbaContext: {
    loanPurpose: 'equipment',
    sbaProgram: '7a',
    guarantyPercentage: 75
  }
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Missing required fields: normalizedData",
  "timestamp": "2026-04-25T..."
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (validation error)
- `405` - Method not allowed
- `500` - Server error

---

## Implementation Notes

### Singleton Parser

The `DocumentParserEngine` is instantiated as a singleton on the server:

```javascript
// src/core/parser-instance.js
const parser = getParserInstance();
const result = await parser.parse(document, options);
```

This ensures consistent parsing behavior across all API calls.

### Service Independence

Each domain service (SpreadingEngine, WIPAnalyzer) is stateless and accepts normalized data:

```javascript
const spreadingEngine = new SpreadingEngine();
const spread = await spreadingEngine.generateSpread(normalizedData, options);

const wipAnalyzer = new WIPAnalyzer();
const wip = await wipAnalyzer.analyzeWIP(normalizedData, wipDetails);
```

Services can be tested independently and composed in different ways.

### Router Orchestration

The `Router` class coordinates the full pipeline:

```javascript
const result = await router.analyzeSuretybondApplication(
  document,
  {
    documentType: 'balance-sheet',
    analysisType: 'full',
    wipDetails: { ... }
  }
);
```

The router:
1. Parses the document
2. Transforms for domain
3. Runs analyses
4. Synthesizes results into underwriting summary

---

## Next Steps

1. **SBA Domain Routes** - Create `/api/v1/sba/loan.js` following the same pattern
2. **Database Persistence** - Store analyses in Supabase
3. **Document Storage** - Store uploaded documents (S3 or Vercel Blob)
4. **User Authentication** - Add JWT middleware for API protection
5. **Rate Limiting** - Prevent abuse of document processing
6. **Analytics & Logging** - Track analysis results and user activity

---

## Testing the API

### Using cURL

```bash
# Full pipeline
curl -X POST http://localhost:3000/api/v1/surety/process \
  -H "Content-Type: application/json" \
  -d '{
    "document": {
      "name": "test.pdf",
      "content": "base64_content"
    },
    "documentType": "balance-sheet"
  }'

# Upload only
curl -X POST http://localhost:3000/api/v1/surety/upload \
  -H "Content-Type: application/json" \
  -d '{
    "document": {
      "name": "test.pdf",
      "content": "base64_content"
    }
  }'
```

### Using JavaScript

```javascript
const response = await fetch('/api/v1/surety/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document: { name: 'test.pdf', content: '...' },
    documentType: 'balance-sheet'
  })
});

const result = await response.json();
console.log(result.data.underwritingSummary);
```

---

## Architecture Benefits

1. **Modularity** - Each domain is self-contained and can be developed independently
2. **Shared Core** - Both domains use the same parser, avoiding duplication
3. **Clear Contracts** - Normalized schema decouples parser from domain logic
4. **Easy to Test** - Services are pure functions accepting normalized data
5. **Scalable** - New domains can be added without modifying existing code
6. **Vercel Compatible** - Serverless functions scale automatically

---

## Version History

- **v1.0.0** (2026-04-25) - Initial modular architecture with Surety domain
  - Core parser engine (DocumentParserEngine, OCREngine, TableExtractor, DataNormalizer)
  - Surety domain services (SpreadingEngine, WIPAnalyzer)
  - API endpoints (upload, analyze, spreading, process)
  - Core router and orchestration
