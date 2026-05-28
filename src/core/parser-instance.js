/**
 * Document Parser Singleton
 *
 * Server-side instance of the DocumentParserEngine.
 * Shared across all domain controllers to parse and normalize financial documents.
 */

import { DocumentParserEngine } from '../shared/document-parser/index.js';

let parserInstance = null;

export function getParserInstance() {
  if (!parserInstance) {
    parserInstance = new DocumentParserEngine();
  }
  return parserInstance;
}

export function resetParserInstance() {
  parserInstance = null;
}
