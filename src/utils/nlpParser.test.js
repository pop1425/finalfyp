// src/utils/nlpParser.test.js
const { parseSpokenText } = require('./nlpParser');

const testCases = [
  {
    input: "Nitumie elfu saba kwa Juma",
    expected: { type: 'SEND', amount: 7000, recipient: 'Juma' }
  },
  {
    input: "Tuma laki moja na elfu hamsini kwa Amina",
    expected: { type: 'SEND', amount: 150000, recipient: 'Amina' }
  },
  {
    input: "Tuma elfu tano kwa Maria",
    expected: { type: 'SEND', amount: 5000, recipient: 'Maria' }
  },
  {
    input: "Nitumie elfu mbili mia tano kwa Amina",
    expected: { type: 'SEND', amount: 2500, recipient: 'Amina' }
  },
  {
    input: "Send five thousand to Alice",
    expected: { type: 'SEND', amount: 5000, recipient: 'Alice' }
  },
  {
    input: "Transfer 2500 to Bob",
    expected: { type: 'SEND', amount: 2500, recipient: 'Bob' }
  },

  {
    input: "Ghairi malipo",
    expected: { type: 'CANCEL' }
  },
  {
    input: "Cancel",
    expected: { type: 'CANCEL' }
  }
];

let failed = 0;
console.log('Running NLP Parser tests...\n');

testCases.forEach((tc, idx) => {
  const result = parseSpokenText(tc.input);
  let isPass = true;
  
  if (result.type !== tc.expected.type) isPass = false;
  if (tc.expected.amount && result.amount !== tc.expected.amount) isPass = false;
  if (tc.expected.recipient && result.recipient !== tc.expected.recipient) isPass = false;
  
  if (isPass) {
    console.log(`✅ Test ${idx + 1} passed: "${tc.input}"`);
  } else {
    console.log(`❌ Test ${idx + 1} FAILED: "${tc.input}"`);
    console.log('   Expected:', tc.expected);
    console.log('   Got:     ', result);
    failed++;
  }
});

console.log(`\nTests finished. Status: ${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
process.exit(failed > 0 ? 1 : 0);
