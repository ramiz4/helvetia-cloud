/**
 * Manual tests for sanitizeServiceName function
 * Run with: node --loader ts-node/esm serviceName.test.ts
 * Or simply verify the logic manually
 */

import { sanitizeServiceName } from './serviceName';

// Test cases with expected results
const testCases = [
  // Basic cases
  { input: 'my-repo', expected: 'my-repo', description: 'already valid name' },
  { input: 'MyRepo', expected: 'myrepo', description: 'uppercase to lowercase' },
  
  // Consecutive special characters
  { input: 'my___repo', expected: 'my-repo', description: 'consecutive underscores' },
  { input: 'my---repo', expected: 'my-repo', description: 'consecutive hyphens' },
  { input: 'my...repo', expected: 'my-repo', description: 'consecutive dots' },
  { input: 'my@@@repo', expected: 'my-repo', description: 'consecutive special chars' },
  
  // Leading/trailing special characters
  { input: '_myrepo', expected: 'myrepo', description: 'leading underscore' },
  { input: 'myrepo_', expected: 'myrepo', description: 'trailing underscore' },
  { input: '_myrepo_', expected: 'myrepo', description: 'leading and trailing underscores' },
  { input: '---myrepo---', expected: 'myrepo', description: 'multiple leading/trailing hyphens' },
  
  // Complex cases
  { input: 'my_special___repo!!!', expected: 'my-special-repo', description: 'multiple issues combined' },
  { input: '@@@repo###name$$$', expected: 'repo-name', description: 'special chars everywhere' },
  
  // Edge cases
  { input: '', expected: '', description: 'empty string' },
  { input: '___', expected: 'service', description: 'only special characters' },
  { input: '123-repo', expected: '123-repo', description: 'starts with number (valid)' },
  { input: '-123-repo', expected: '123-repo', description: 'starts with hyphen then number' },
  
  // DNS compliance - 63 character limit
  { 
    input: 'a'.repeat(70) + '-repo', 
    expected: 'a'.repeat(63), 
    description: 'truncates to 63 chars' 
  },
  { 
    input: 'a'.repeat(62) + '---', 
    expected: 'a'.repeat(62), 
    description: 'truncates and removes trailing hyphens' 
  },
];

// Run tests
console.log('Testing sanitizeServiceName function...\n');
let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected, description }) => {
  const result = sanitizeServiceName(input);
  const success = result === expected;
  
  if (success) {
    passed++;
    console.log(`✓ ${description}`);
    console.log(`  Input: "${input}" → Output: "${result}"\n`);
  } else {
    failed++;
    console.log(`✗ ${description}`);
    console.log(`  Input: "${input}"`);
    console.log(`  Expected: "${expected}"`);
    console.log(`  Got: "${result}"\n`);
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('All tests passed! ✓');
} else {
  console.log('Some tests failed. ✗');
  process.exit(1);
}
