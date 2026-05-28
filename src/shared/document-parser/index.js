/**
 * Shared Document Parser Core Engine
 *
 * This module is the shared contract for ALL domains that need to:
 * - Ingest financial documents (PDF, images, CSV)
 * - Extract tabular data (income statements, balance sheets, etc.)
 * - Normalize data into a standard format
 *
 * Domains (SBA, Surety, etc.) use this engine to extract raw data,
 * then apply domain-specific business rules on top.
 */

import { OCREngine } from './ocr-engine.js';
import { TableExtractor } from './table-extractor.js';
import { DataNormalizer } from './data-normalizer.js';

export class DocumentParserEngine {
  constructor() {
    this.ocr = new OCREngine();
    this.tableExtractor = new TableExtractor();
    this.normalizer = new DataNormalizer();
  }

  /**
   * Main entry point: Parse a financial document and extract raw data
   *
   * @param {File|Buffer} document - The document to parse
   * @param {Object} options - Parser options
   * @param {string} options.documentType - 'income-statement' | 'balance-sheet' | 'tax-return' | 'general'
   * @param {boolean} options.extractTables - Whether to extract tabular data (default: true)
   * @param {boolean} options.extractText - Whether to extract text (default: true)
   *
   * @returns {Promise<{
   *   raw: Object,           // Raw extracted data (OCR text, tables, images)
   *   normalized: Object,    // Standardized data format
   *   metadata: Object,      // Document metadata (pages, format, confidence scores)
   *   errors: Array          // Any warnings or partial failures
   * }>}
   */
  async parse(document, options = {}) {
    const {
      documentType = 'general',
      extractTables = true,
      extractText = true,
    } = options;

    try {
      // Step 1: OCR / Text Extraction
      const ocrResult = extractText
        ? await this.ocr.extract(document)
        : { pages: [], text: '', confidence: 0 };

      // Step 2: Table Extraction
      const tableResult = extractTables
        ? await this.tableExtractor.extract(document, ocrResult)
        : { tables: [], metadata: {} };

      // Step 3: Data Normalization (convert to standard schema)
      const normalized = this.normalizer.normalize(
        {
          text: ocrResult.text,
          tables: tableResult.tables,
          pages: ocrResult.pages,
        },
        documentType
      );

      return {
        raw: {
          text: ocrResult.text,
          tables: tableResult.tables,
          pages: ocrResult.pages,
          images: ocrResult.images || [],
        },
        normalized,
        metadata: {
          documentType,
          pageCount: ocrResult.pages?.length || 0,
          ocrConfidence: ocrResult.confidence || 0,
          extractedAt: new Date().toISOString(),
          parserVersion: '1.0.0',
        },
        errors: ocrResult.errors || [],
      };
    } catch (error) {
      return {
        raw: null,
        normalized: null,
        metadata: { error: error.message, documentType },
        errors: [{ type: 'PARSE_ERROR', message: error.message }],
      };
    }
  }

  /**
   * Extract specific data types from normalized output
   * Helper method for domain-specific consumers
   */
  extractFinancialMetrics(normalized) {
    return {
      revenue: normalized.financials?.revenue || 0,
      expenses: normalized.financials?.expenses || 0,
      netIncome: normalized.financials?.netIncome || 0,
      assets: normalized.financials?.assets || 0,
      liabilities: normalized.financials?.liabilities || 0,
      equity: normalized.financials?.equity || 0,
    };
  }

  /**
   * Validate that extracted data meets minimum quality standards
   */
  validateQuality(parseResult) {
    const { metadata, errors } = parseResult;
    return {
      isValid: metadata.ocrConfidence > 0.7 && errors.length === 0,
      confidence: metadata.ocrConfidence,
      warnings: errors,
    };
  }
}

// Export as singleton (shared instance across app)
export const documentParser = new DocumentParserEngine();
