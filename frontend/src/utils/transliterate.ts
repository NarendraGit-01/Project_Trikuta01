/**
 * Bilingual Telugu <-> English Transliteration Utilities.
 * Provides bidirectional phonetic mapping and script detection for Temple Receipts.
 */

export function isTeluguScript(text: string): boolean {
  if (!text) return false;
  return /[\u0C00-\u0C7F]/.test(text);
}

/* ─────────────────────────────────────────────────────────────
   1. TELUGU -> ENGLISH TRANSLITERATION
───────────────────────────────────────────────────────────── */

const TE_TO_EN_VOWELS: Record<string, string> = {
  'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo',
  'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au',
};

const TE_MATRAS: Record<string, string> = {
  'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo',
  'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au',
  '్': '',
};

const TELUGU_LABIALS = new Set(['ప', 'ఫ', 'బ', 'భ', 'మ']);

const TE_CONSONANTS: Record<string, string> = {
  'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
  'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
  'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
  'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
  'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
  'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh',
  'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l', 'క్ష': 'ksh', 'ఱ': 'r',
};

const ADDRESS_PHRASES: [string, string][] = [
  ['పెట్రోల్ బంకు ప్రక్కన', 'Near Petrol Bunk'],
  ['పెట్రోల్ బంకు', 'Petrol Bunk'],
  ['పెట్రోలు బంకు ప్రక్కన', 'Near Petrol Bunk'],
  ['పెట్రోలు బంకు', 'Petrol Bunk'],
  ['మెయిన్ రోడ్డు', 'Main Road'],
  ['మొయిన రోడ్డు', 'Main Road'],
  ['మెయిన్ బజార్', 'Main Bazaar'],
  ['మెయిన్', 'Main'],
  ['రోడ్డు', 'Road'],
  ['ప్రక్కన', 'Beside'],
  ['ఎదురుగా', 'Opposite'],
  ['సమీపంలో', 'Near'],
  ['బజార్', 'Bazaar'],
  ['డి.నెం', 'D.No'],
  ['నెం', 'No'],
  ['జిల్లా', 'District'],
  ['నగర్', 'Nagar'],
  ['కాలనీ', 'Colony'],
  ['గ్రామం', 'Village'],
  ['మండలం', 'Mandal'],
  ['వీధి', 'Street'],
  ['రహదారి', 'Highway'],
];

const DEVOTEE_LEXICON: Record<string, string> = {
  'వెంకటరమణ': 'Venkataramana',
  'వెంకటలక్ష్మి': 'Venkatalakshmi',
  'వెంకటసత్యనారాయణ': 'Venkata Satyanarayana',
  'వెంకట సత్యనారాయణ': 'Venkata Satyanarayana',
  'కనకమహాలక్ష్మి': 'Kanakamahalakshmi',
  'వీరవెంకటప్రభువుణం': 'Veera Venkata Prabhuvanam',
  'వీరవెంకట ప్రభువుణం': 'Veera Venkata Prabhuvanam',
  'వీర వెంకట సుబ్రహ్మణ్యం': 'Veera Venkata Subrahmanyam',
  'వీరవెంకట సుబ్రహ్మణ్యం': 'Veera Venkata Subrahmanyam',
  'పట్టాభిరామయ్య': 'Pattabhi Ramayya',
  'పట్టాభి రామయ్య': 'Pattabhi Ramayya',
  'వరలక్ష్మి': 'Varalakshmi',
  'వరలక్ష్మి (ప్రసన్న)': 'Varalakshmi (Prasanna)',
  'ప్రసన్న': 'Prasanna',
  'శ్రీ చక్రధర్': 'Sri Chakradhar',
  'చక్రధర్': 'Chakradhar',
  'శ్రీ వైష్ణవి': 'Sri Vaishnavi',
  'వైష్ణవి': 'Vaishnavi',
  'పుల్లయ్య': 'Pullayya',
  'రత్నావతి': 'Ratnavati',
  'నాగరాజు': 'Nagaraju',
  'సుబ్బలక్ష్మి': 'Subbalakshmi',
  'లక్ష్మి': 'Lakshmi',
  'రమేష్ బాబు': 'Ramesh Babu',
  'సత్యనారాయణ': 'Satyanarayana',
  'పార్వతి': 'Parvati',
  'శ్రీనివాస రావు': 'Srinivasa Rao',
  'శ్రీనివాసు': 'Srinivasu',
  'నాగేశ్వర రావు': 'Nageswara Rao',
  'మహాలక్ష్మి': 'Mahalakshmi',
  'సత్యవతి': 'Satyavati',
  'రామారావు': 'Rama Rao',
  'వెంకటేశ్వర రావు': 'Venkateswara Rao',
};

export function transliterateTeluguToEnglish(text: string): string {
  if (!text || text.trim() === '') return '';
  const trimmed = text.trim();
  if (DEVOTEE_LEXICON[trimmed]) {
    return DEVOTEE_LEXICON[trimmed];
  }
  if (!isTeluguScript(text)) return text; // already english

  let t = text;
  // Replace standard phrases
  for (const [te, en] of ADDRESS_PHRASES) {
    t = t.split(te).join(en);
  }

  const out: string[] = [];
  let i = 0;
  const n = t.length;

  while (i < n) {
    const c = t[i];
    const nxt = i + 1 < n ? t[i + 1] : '';

    if (TE_TO_EN_VOWELS[c]) {
      out.push(TE_TO_EN_VOWELS[c]);
    } else if (TE_CONSONANTS[c]) {
      const base = TE_CONSONANTS[c];
      if (nxt === '్') {
        // Virama halant: consonant only
        out.push(base);
        i++; // skip halant
      } else if (TE_MATRAS[nxt]) {
        out.push(base + TE_MATRAS[nxt]);
        i++; // skip matra
      } else {
        out.push(base + 'a');
      }
    } else if (TE_MATRAS[c] !== undefined) {
      out.push(TE_MATRAS[c]);
    } else if (c === 'ం') {
      const isWordEnd = !nxt || !/[\u0C00-\u0C7F]/.test(nxt);
      out.push(isWordEnd || TELUGU_LABIALS.has(nxt) ? 'm' : 'n');
    } else if (c === 'ః') {
      out.push('h');
    } else {
      out.push(c);
    }
    i++;
  }

  const res = out.join('');
  // Clean up and capitalize words
  return res
    .split(/\s+/)
    .map((word) => {
      if (word.startsWith('D.No') || word.startsWith('D-') || word.startsWith('No.')) return word;
      if (word.length <= 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/* ─────────────────────────────────────────────────────────────
   2. ENGLISH -> TELUGU TRANSLITERATION
───────────────────────────────────────────────────────────── */

const IND_VOWELS: Record<string, string> = {
  'aa': 'ఆ', 'ai': 'ఐ', 'au': 'ఔ', 'ee': 'ఈ', 'ii': 'ఈ',
  'oo': 'ఊ', 'uu': 'ఊ', 'ou': 'ఔ',
  'a': 'అ', 'i': 'ఇ', 'u': 'ఉ', 'e': 'ఎ', 'o': 'ఒ',
};

const MATRAS: Record<string, string> = {
  'aa': 'ా', 'ai': 'ై', 'au': 'ౌ', 'ee': 'ీ', 'ii': 'ీ',
  'oo': 'ూ', 'uu': 'ూ', 'ou': 'ౌ',
  'a': '', 'i': 'ి', 'u': 'ు', 'e': 'ె', 'o': 'ొ',
};

const CONSONANTS: Record<string, string> = {
  'ksh': 'క్ష', 'gny': 'జ్ఞ', 'tr': 'త్ర', 'dr': 'ద్ర',
  'kh': 'ఖ', 'gh': 'ఘ', 'ng': 'ఙ', 'ch': 'చ', 'jh': 'ఝ',
  'ny': 'ఞ', 'th': 'థ', 'dh': 'ధ', 'nh': 'ణ', 'ph': 'ఫ',
  'bh': 'భ', 'mh': 'మ', 'sh': 'శ', 'zh': 'ళ',
  'k': 'క', 'g': 'గ', 'c': 'క', 'j': 'జ', 't': 'త',
  'd': 'డ', 'n': 'న', 'p': 'ప', 'b': 'బ', 'm': 'మ',
  'y': 'య', 'r': 'ర', 'l': 'ల', 'v': 'వ', 'w': 'వ',
  's': 'స', 'h': 'హ', 'f': 'ఫ', 'z': 'జ', 'x': 'క్స',
};

function matchAt(str: string, pos: number, map: Record<string, string>): [string, string] | null {
  for (let len = 3; len >= 1; len--) {
    const sub = str.slice(pos, pos + len);
    if (map[sub] !== undefined) return [sub, map[sub]];
  }
  return null;
}

function convertEnglishWord(word: string): string {
  const s = word.toLowerCase();
  let result = '';
  let i = 0;
  let pendingConsonant = '';

  while (i < s.length) {
    let vowelKey: string | null = null;
    if (i + 1 < s.length) {
      const two = s.slice(i, i + 2);
      if (IND_VOWELS[two]) vowelKey = two;
    }
    if (!vowelKey && IND_VOWELS[s[i]]) vowelKey = s[i];

    if (vowelKey) {
      if (pendingConsonant) {
        result += pendingConsonant + (MATRAS[vowelKey] ?? '');
        pendingConsonant = '';
      } else {
        result += IND_VOWELS[vowelKey];
      }
      i += vowelKey.length;
      continue;
    }

    const consMatch = matchAt(s, i, CONSONANTS);
    if (consMatch) {
      const [key, te] = consMatch;
      if (pendingConsonant) {
        result += pendingConsonant + '్';
      }
      pendingConsonant = te;
      i += key.length;
      continue;
    }

    if (pendingConsonant) {
      result += pendingConsonant;
      pendingConsonant = '';
    }
    result += s[i];
    i++;
  }

  if (pendingConsonant) {
    result += pendingConsonant;
  }
  return result;
}

export function transliterateToTelugu(input: string): string {
  if (!input || input.trim() === '') return '';
  if (isTeluguScript(input)) return input; // already telugu

  const trimmed = input.trim();
  // Check exact English in Devotee Lexicon
  for (const [te, en] of Object.entries(DEVOTEE_LEXICON)) {
    if (en.toLowerCase() === trimmed.toLowerCase()) {
      return te;
    }
  }

  return input
    .trim()
    .split(/\s+/)
    .map((w) => {
      for (const [te, en] of Object.entries(DEVOTEE_LEXICON)) {
        if (en.toLowerCase() === w.toLowerCase()) return te;
      }
      return convertEnglishWord(w);
    })
    .join(' ');
}
