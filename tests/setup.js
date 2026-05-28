/**
 * Test Setup & Configuration
 * Initializes mock Supabase client and test utilities
 */

// Mock Supabase client for testing
export function createMockSupabaseClient() {
  const rows = [];
  const makeRow = (table, data = {}) => ({
    id: data.id || `${table}_${Date.now()}`,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    ...data,
  });
  const makeQuery = (table, seed = rows) => {
    const query = {
      insert: (data) => {
        const inserted = (Array.isArray(data) ? data : [data]).map((item) => makeRow(table, item));
        rows.push(...inserted);
        return makeQuery(table, inserted);
      },
      update: (data) => makeQuery(table, [makeRow(table, data)]),
      select: () => makeQuery(table, seed.length ? seed : [makeRow(table)]),
      eq: () => makeQuery(table, seed),
      gte: () => makeQuery(table, seed),
      lte: () => makeQuery(table, seed),
      order: () => Promise.resolve({ data: seed, error: null }),
      limit: () => makeQuery(table, seed),
      single: async () => ({ data: seed[0] || makeRow(table), error: null }),
      maybeSingle: async () => ({ data: seed[0] || null, error: null }),
      then: (resolve) => Promise.resolve({ data: seed, error: null }).then(resolve),
    };
    return query;
  };

  return {
    from: (table) => makeQuery(table),
  };
}

// Test utilities
export const assert = {
  equal: (actual, expected, message) => {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  },

  approximately: (actual, expected, tolerance, message) => {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      throw new Error(`${message}: expected ~${expected}, got ${actual} (diff: ${diff})`);
    }
  },

  truthy: (value, message) => {
    if (!value) throw new Error(`${message}: expected truthy, got ${value}`);
  },

  falsy: (value, message) => {
    if (value) throw new Error(`${message}: expected falsy, got ${value}`);
  },

  deepEqual: (actual, expected, message) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message}:\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
  },

  isArray: (value, message) => {
    if (!Array.isArray(value)) {
      throw new Error(`${message}: expected array, got ${typeof value}`);
    }
  },

  hasProperty: (obj, prop, message) => {
    if (!(prop in obj)) {
      throw new Error(`${message}: object missing property "${prop}"`);
    }
  },
};

// Test runner
export async function runTests(testSuite) {
  let passed = 0;
  let failed = 0;
  const results = [];

  for (const [name, testFn] of Object.entries(testSuite)) {
    try {
      await testFn();
      passed++;
      results.push({ name, status: '✅ PASS' });
    } catch (error) {
      failed++;
      results.push({ name, status: '❌ FAIL', error: error.message });
    }
  }

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS');
  console.log('='.repeat(70));

  results.forEach(result => {
    console.log(`\n${result.status}: ${result.name}`);
    if (result.error) {
      console.log(`   ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('='.repeat(70) + '\n');

  return { passed, failed, results };
}

// Format currency for test output
export function usd(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format percentage
export function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}
