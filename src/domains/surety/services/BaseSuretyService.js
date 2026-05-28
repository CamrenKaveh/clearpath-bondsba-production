/**
 * Base Service for Surety Domain
 *
 * All Surety-specific services inherit from this and follow the same pattern:
 * - Accept normalized data from shared parser
 * - Apply domain-specific business logic (spreading, WIP analysis, risk factors)
 * - Return domain-specific analysis results
 * - Never access SBA domain services
 */

export class BaseSuretyService {
  constructor() {
    this.domain = 'surety';
  }

  /**
   * All services must implement this validation pattern
   */
  validateInput(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * All services must log actions for audit trail
   */
  logAction(action, data, userId) {
    console.log(`[${this.domain}] ${action}`, {
      timestamp: new Date().toISOString(),
      userId,
      dataKeys: Object.keys(data),
    });
  }

  /**
   * Helper to ensure no cross-domain dependency
   */
  assertDomainIsolation() {
    if (typeof window !== 'undefined') {
      const sbaImport = Object.keys(window).find(k => k.includes('sba'));
      if (sbaImport) {
        throw new Error(
          'Domain isolation violation: Surety service attempted to import SBA domain'
        );
      }
    }
  }
}

export default BaseSuretyService;
