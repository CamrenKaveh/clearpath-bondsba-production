/**
 * Surety API Client
 * Handles all communication with surety backend endpoints
 */

import { getAuthToken } from '../../../shared/utils/supabaseClient.js';

const API_BASE = '/api/v1/surety';

/** Build headers, attaching an auth token when available */
async function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session. Protected endpoints return 401 with a user-facing message.
  }
  return headers;
}

export class SuretyClient {
  /**
   * Process complete surety bond application
   * Recommended endpoint - single request for full analysis
   */
  static async processApplication(document, options = {}) {
    const {
      documentType = 'balance-sheet',
      analysisType = 'full',
      wipDetails = {},
      spreadingOptions = {},
    } = options;

    const response = await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        document,
        documentType,
        analysisType,
        wipDetails,
        spreadingOptions,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Processing failed');
    }

    const result = await response.json();
    return result.data;
  }

  static async listSavedApplications(limit = 6) {
    const response = await fetch(`${API_BASE}/applications?limit=${encodeURIComponent(limit)}`, {
      method: 'GET',
      headers: await buildHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to load saved applications' }));
      throw new Error(error.error || 'Failed to load saved applications');
    }

    const result = await response.json();
    return result.data;
  }

  static async getSavedApplication(applicationId) {
    const response = await fetch(`${API_BASE}/applications?applicationId=${encodeURIComponent(applicationId)}`, {
      method: 'GET',
      headers: await buildHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to load saved application' }));
      throw new Error(error.error || 'Failed to load saved application');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Upload and parse document only
   */
  static async uploadDocument(document, documentType = 'balance-sheet') {
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        document,
        documentType,
        extractTables: true,
        extractText: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Run analysis on pre-parsed data
   */
  static async analyzeData(normalizedData, options = {}) {
    const {
      analysisType = 'full',
      wipDetails = {},
      spreadingOptions = {},
    } = options;

    // Extract financials from normalizedData to match the analyze endpoint's expected field name
    const financials = normalizedData?.financials || normalizedData;

    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        financials,
        analysisType,
        wipDetails,
        spreadingOptions,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Run spreading calculations only
   */
  static async calculateSpreading(normalizedData, underwriter = 'System') {
    const response = await fetch(`${API_BASE}/spreading`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        normalizedData,
        underwriter,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Spreading calculation failed');
    }

    const result = await response.json();
    return result.data;
  }
}
