/**
 * Decimal Math Utility for Financial Calculations
 *
 * Uses Decimal.js to ensure EXACT financial calculations with no floating-point errors.
 *
 * Example:
 *   decimalMath.add(0.1, 0.2)  // Returns 0.3 (not 0.30000000000000004)
 *   decimalMath.divide(100, 3) // Returns 33.33 (configurable precision)
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial use
Decimal.set({
  precision: 28,        // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP,  // Standard rounding for money
  toExpNeg: -7,
  toExpPos: 21,
});

export const decimalMath = {
  /**
   * Convert any value to Decimal
   */
  parse: (value) => new Decimal(value || 0),

  /**
   * Addition
   */
  add: (...values) => {
    return values.reduce((sum, val) => sum.plus(new Decimal(val)), new Decimal(0));
  },

  /**
   * Subtraction
   */
  subtract: (a, b) => {
    return new Decimal(a).minus(new Decimal(b));
  },

  /**
   * Multiplication
   */
  multiply: (...values) => {
    return values.reduce((product, val) => product.times(new Decimal(val)), new Decimal(1));
  },

  /**
   * Division
   */
  divide: (a, b) => {
    if (new Decimal(b).isZero()) {
      throw new Error('Division by zero');
    }
    return new Decimal(a).dividedBy(new Decimal(b));
  },

  /**
   * Percentage calculation
   */
  percent: (value, percent) => {
    return new Decimal(value).times(new Decimal(percent).dividedBy(100));
  },

  /**
   * Round to specified decimal places
   */
  round: (value, places = 2) => {
    return new Decimal(value).toDecimalPlaces(places);
  },

  /**
   * Format as currency string
   */
  formatCurrency: (value, currency = 'USD') => {
    const decimal = new Decimal(value);
    const formatted = decimal.toFixed(2);

    if (currency === 'USD') {
      return `$${formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }
    return formatted;
  },

  /**
   * Compare two values
   */
  compare: (a, b) => {
    return new Decimal(a).comparedTo(new Decimal(b));
    // Returns: -1 (a < b), 0 (a === b), 1 (a > b)
  },

  /**
   * Check if value is zero
   */
  isZero: (value) => {
    return new Decimal(value).isZero();
  },

  /**
   * Get numeric value
   */
  toNumber: (value) => {
    return new Decimal(value).toNumber();
  },
};

export default decimalMath;
