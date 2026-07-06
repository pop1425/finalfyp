// src/utils/nlpParser.js

const swahiliMap = {
  moja: 1,
  mbili: 2,
  tatu: 3,
  nne: 4,
  tano: 5,
  sita: 6,
  saba: 7,
  nane: 8,
  tisa: 9,
  kumi: 10,
  ishirini: 20,
  thelathini: 30,
  arobaini: 40,
  hamsini: 50,
  sitini: 60,
  sabini: 70,
  themanini: 80,
  tisini: 90
};

const englishMap = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

function parseSwahiliNumbers(tokens) {
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'laki') {
      const nextWord = tokens[i + 1];
      const multiplier = swahiliMap[nextWord];
      if (multiplier !== undefined) {
        total += 100000 * multiplier;
        i++;
      } else {
        total += 100000;
      }
    } else if (token === 'elfu') {
      const nextWord = tokens[i + 1];
      const multiplier = swahiliMap[nextWord];
      if (multiplier !== undefined) {
        total += 1000 * multiplier;
        i++;
      } else {
        total += 1000;
      }
    } else if (token === 'mia') {
      const nextWord = tokens[i + 1];
      const multiplier = swahiliMap[nextWord];
      if (multiplier !== undefined) {
        total += 100 * multiplier;
        i++;
      } else {
        total += 100;
      }
    } else if (swahiliMap[token] !== undefined) {
      total += swahiliMap[token];
    }
  }
  return total;
}

function parseEnglishNumbers(tokens) {
  let total = 0;
  let currentSection = 0;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (englishMap[token] !== undefined) {
      currentSection += englishMap[token];
    } else if (token === 'hundred') {
      currentSection = (currentSection || 1) * 100;
    } else if (token === 'thousand') {
      total += (currentSection || 1) * 1000;
      currentSection = 0;
    } else if (token === 'million') {
      total += (currentSection || 1) * 1000000;
      currentSection = 0;
    }
  }
  
  return total + currentSection;
}

/**
 * Parses spoken transaction text in English or Swahili.
 * @param {string} text - Spoken input text.
 * @returns {object} Parsed command details.
 */
function parseSpokenText(text) {
  if (!text) return { type: 'UNKNOWN', text: '' };
  
  const cleanText = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
  const tokens = cleanText.split(/\s+/);
  
  // Check for Cancel command
  if (tokens.some(t => ['cancel', 'ghairi', 'sitisha', 'abort', 'rudi'].includes(t))) {
    return { type: 'CANCEL' };
  }
  
  // Check for Balance command
  if (tokens.some(t => ['balance', 'salio', 'account'].includes(t))) {
    return { type: 'BALANCE' };
  }
  
  // Check if we have transaction keyword (send, tuma, nitumie, transfer, pay, lipa)
  const isSend = tokens.some(t => ['send', 'transfer', 'tuma', 'nitumie', 'lipa', 'pay'].includes(t));
  if (!isSend) {
    return { type: 'UNKNOWN', text: text };
  }
  
  // Extract recipient
  let recipient = '';
  // Check for Swahili recipient indicator "kwa" or English "to"
  const recipientMatch = cleanText.match(/\b(?:kwa|to)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (recipientMatch) {
    recipient = recipientMatch[1].trim();
    // Capitalize name
    recipient = recipient.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  // Extract amount
  let amount = 0;
  
  // 1. Direct digit parsing
  const digitMatch = cleanText.replace(/,/g, '').match(/\b\d+\b/);
  if (digitMatch) {
    amount = parseInt(digitMatch[0], 10);
  } else {
    // 2. Word parsing
    // Split text to only scan before "kwa" or "to" to avoid name tokens interfering
    const mainTextPart = cleanText.split(/\b(?:kwa|to)\b/)[0];
    const amountTokens = mainTextPart.trim().split(/\s+/);
    
    // Determine language by keywords
    const hasSwahiliWords = amountTokens.some(t => ['elfu', 'laki', 'mia', 'moja', 'mbili', 'tatu', 'nne', 'tano', 'sita', 'saba', 'nane', 'tisa', 'kumi', 'hamsini', 'ishirini', 'thelathini', 'arobaini', 'sitini', 'sabini', 'themanini', 'tisini'].includes(t));
    
    if (hasSwahiliWords) {
      amount = parseSwahiliNumbers(amountTokens);
    } else {
      amount = parseEnglishNumbers(amountTokens);
    }
  }
  
  if (amount > 0 && recipient) {
    return {
      type: 'SEND',
      amount,
      recipient
    };
  }
  
  return {
    type: 'UNKNOWN',
    text: text,
    amount: amount || undefined,
    recipient: recipient || undefined
  };
}

module.exports = {
  parseSpokenText,
  parseSwahiliNumbers,
  parseEnglishNumbers
};
