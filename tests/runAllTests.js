#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Executes all test suites and generates report
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  'loanCalculator.test.js',
  'termSheetGenerator.test.js',
  'database.test.js',
  'billing.pricing.test.js',
  'integration-health.test.js',
  'auth-touchpoints.test.js',
  'launch-readiness.test.js',
];

const results = {
  passed: 0,
  failed: 0,
  suites: [],
};

async function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testFile);
    const process = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    process.on('exit', (code) => {
      resolve({
        file: testFile,
        exitCode: code,
        passed: code === 0,
      });
    });

    process.on('error', (err) => {
      console.error(`Failed to run ${testFile}:`, err);
      resolve({
        file: testFile,
        exitCode: 1,
        passed: false,
        error: err.message,
      });
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 CLEARPATH COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(70));
  console.log(`\nRunning ${testFiles.length} test suites...\n`);

  const startTime = Date.now();

  for (const testFile of testFiles) {
    console.log(`\n📂 Starting: ${testFile}`);
    const result = await runTest(testFile);
    results.suites.push(result);

    if (!result.passed) {
      results.failed++;
    } else {
      results.passed++;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));

  results.suites.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.file}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${results.passed} passed, ${results.failed} failed`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(70) + '\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
