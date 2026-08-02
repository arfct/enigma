import { phonemize, list_voices } from './vendor/phonemizer.js';

const input = document.getElementById('input');
const output = document.getElementById('output');
const voiceSelect = document.getElementById('voice');
const fontSelect = document.getElementById('font');
const stressRadios = document.querySelectorAll('input[name="stress"]');
const lengthRadios = document.querySelectorAll('input[name="length"]');
const punctuationCheckbox = document.getElementById('punctuation');
const capitalCheckbox = document.getElementById('capitals');

function stressMode() {
  return document.querySelector('input[name="stress"]:checked').value;
}

function lengthMode() {
  return document.querySelector('input[name="length"]:checked').value;
}

const DEFAULT_VOICE = 'en-us';

const ABOUT_TEXT =
  'Enigma turns spelling into sound. Type anything and it reappears below as phonemes: ' +
  'every vowel, every stress, every sound you actually say — including the engma, ' +
  'the ŋ that hides at the end of everything.';

const PRESETS = {
  'About': [
    {
      label: 'About',
      text: ABOUT_TEXT,
    },
  ],
  'Phonetics passages': [
    {
      label: 'Rainbow Passage',
      text: 'When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.',
    },
    {
      label: 'Please call Stella',
      text: 'Please call Stella. Ask her to bring these things with her from the store: six spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a snack for her brother Bob. We also need a small plastic snake and a big toy frog for the kids.',
    },
    {
      label: 'Grandfather Passage',
      text: 'You wished to know all about my grandfather. Well, he is nearly ninety-three years old. He dresses himself in an ancient black frock coat, usually minus several buttons; yet he still thinks as swiftly as ever.',
    },
    {
      label: 'Arthur the Rat',
      text: 'Once there was a young rat named Arthur, who could never make up his mind. Whenever his friends asked him if he would like to go out with them, he would only answer, "I don\'t know."',
    },
  ],
  'Pangrams': [
    {
      label: 'Quick brown fox',
      text: 'The quick brown fox jumps over the lazy dog.',
    },
    {
      label: 'Liquor jugs',
      text: 'Pack my box with five dozen liquor jugs.',
    },
    {
      label: 'Zephyrs',
      text: 'Sphinx of black quartz, judge my vow. The five boxing wizards jump quickly. Waltz, bad nymph, for quick jigs vex.',
    },
  ],
  'Tongue twisters': [
    {
      label: 'Seashells',
      text: 'She sells seashells by the seashore; the shells she sells are surely seashells.',
    },
    {
      label: 'Peter Piper',
      text: 'Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked.',
    },
    {
      label: 'Woodchuck',
      text: 'How much wood would a woodchuck chuck if a woodchuck could chuck wood?',
    },
    {
      label: 'Sixth sheik',
      text: "The sixth sick sheik's sixth sheep's sick.",
    },
  ],
  'Literature & speeches': [
    {
      label: 'Declaration of Independence',
      text: 'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.',
    },
    {
      label: 'Gettysburg Address',
      text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.',
    },
    {
      label: 'Hamlet',
      text: 'To be, or not to be, that is the question: whether ’tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them.',
    },
    {
      label: 'Jabberwocky',
      text: '’Twas brillig, and the slithy toves did gyre and gimble in the wabe: all mimsy were the borogoves, and the mome raths outgrabe.',
    },
  ],
};

function renderPresets() {
  const presetSelect = document.getElementById('presets');
  const presetTexts = new Map();
  for (const [group, presets] of Object.entries(PRESETS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.label;
      option.textContent = preset.label;
      presetTexts.set(preset.label, preset.text);
      optgroup.append(option);
    }
    presetSelect.append(optgroup);
  }
  presetSelect.addEventListener('change', () => {
    const text = presetTexts.get(presetSelect.value);
    if (text) {
      input.value = text;
      fitInput();
      transcribe();
    }
  });
}

async function populateVoices() {
  const voices = await list_voices();
  const byCode = new Map();
  for (const voice of voices) {
    for (const lang of voice.languages) {
      const existing = byCode.get(lang.name);
      if (!existing || lang.priority < existing.priority) {
        byCode.set(lang.name, { code: lang.name, voice: voice.name, priority: lang.priority });
      }
    }
  }
  const languages = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  for (const { code, voice } of languages) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = voice.replace(/^English \((.+)\)$/, '$1');
    voiceSelect.append(option);
  }
  voiceSelect.value = DEFAULT_VOICE;
}

let requestId = 0;
let currentLines = [];
let currentPunctuation = [];

// espeak splits its output at clause-terminating punctuation and discards the marks.
// A period between digits (3.14) is not a break, so it must not match here.
const CLAUSE_BREAK = /((?:(?<!\d)\.|\.(?!\d)|[,:;?!…—–])+)/g;

// espeak emits nothing for a fragment with no letters or digits in it, so only
// those count as clauses — otherwise a trailing quote after a full stop (know.")
// would claim a clause of its own and throw the whole alignment off.
const SPEAKABLE = /[\p{L}\p{N}]/u;
const CAPITALISED = /^[^\p{L}]*\p{Lu}/u;
const OPENING = /^[\s“”"'‘’([{¿¡]*([“"'‘([{¿¡]+)/;
const CLOSING = /([”"'’)\]}]+)[\s]*$/;

function clausePunctuation(text) {
  const parts = text.split(CLAUSE_BREAK);
  const clauses = [];
  let insideQuote = false;
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] || '';
    const separator = (parts[i + 1] || '').trim();
    if (!SPEAKABLE.test(body)) {
      if (clauses.length) clauses[clauses.length - 1].after += body.trim() + separator;
      continue;
    }
    let before = (body.match(OPENING) || ['', ''])[1] || '';
    const after = (body.match(CLOSING) || ['', ''])[1] || '';
    // A straight quote is shaped the same opening or closing. One starting a clause
    // while a quotation is already open must be closing the previous clause.
    if (insideQuote && before.startsWith('"') && clauses.length) {
      clauses[clauses.length - 1].after += '"';
      before = before.slice(1);
    }
    for (const character of body) {
      if (character === '"') insideQuote = !insideQuote;
    }
    const words = body.trim().split(/\s+/).filter(Boolean);
    clauses.push({
      before,
      after: after + separator,
      capitals: words.map(word => CAPITALISED.test(word)),
    });
  }

  // A quotation opening mid-clause cannot be placed without word-level alignment,
  // so drop any closing quote whose partner never made it into the output.
  let unclosed = 0;
  for (const clause of clauses) {
    for (const character of clause.before) {
      if (character === '"') unclosed++;
    }
    clause.after = [...clause.after]
      .filter(character => {
        if (character !== '"') return true;
        if (unclosed === 0) return false;
        unclosed--;
        return true;
      })
      .join('');
  }
  return clauses;
}

const STRESS_MARKS = /[ˈˌ]/g;
// Uppercase forms are included because preserving capitalization can raise the very
// vowel that carries the stress, and it must still be found here.
const VOWELS = 'iɪyʏeøɛœæaɶɑɒɔoʊuʉɨᵻᵿʌəɚɜɝɐɞɤ';
const VOWEL_RUN = `[${VOWELS}${VOWELS.toUpperCase()}ː˞]+`;
const PRIMARY_STRESS = new RegExp(`ˈ(${VOWEL_RUN})`, 'g');
const SECONDARY_STRESS = new RegExp(`ˌ(${VOWEL_RUN})`, 'g');
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const COMBINING_ACUTE = '́';
const COMBINING_GRAVE = '̀';

// Diacritic goes on the first element of the vowel run, the Americanist convention
// for marking a diphthong nucleus.
function markNucleus(run, diacritic) {
  const chars = [...run];
  return chars[0] + diacritic + chars.slice(1).join('');
}

function applyStress(text, mode) {
  const escaped = text.replace(/[&<>]/g, c => HTML_ESCAPES[c]);
  if (mode === 'marks') return escaped;
  if (mode === 'accents') {
    return escaped
      .replace(PRIMARY_STRESS, (_, run) => markNucleus(run, COMBINING_ACUTE))
      .replace(SECONDARY_STRESS, (_, run) => markNucleus(run, COMBINING_GRAVE))
      .replace(STRESS_MARKS, '');
  }
  if (mode === 'highlight') {
    return escaped
      .replace(PRIMARY_STRESS, '<b class="primary">$1</b>')
      .replace(SECONDARY_STRESS, '<b class="secondary">$1</b>')
      .replace(STRESS_MARKS, '');
  }
  return escaped.replace(STRESS_MARKS, '');
}

// ˈ and ˌ are modifier letters, so \p{L} alone would match the stress tick and
// "capitalise" that instead of the vowel behind it.
const BASE_LETTER = character => /\p{L}/u.test(character) && !/\p{Lm}/u.test(character);

function capitaliseWord(word) {
  const characters = [...word];
  const first = characters.findIndex(BASE_LETTER);
  if (first < 0) return word;
  characters[first] = characters[first].toUpperCase();
  return characters.join('');
}

// espeak runs some function words together (to be → təbi) and expands numbers, so a
// clause's word count often differs from the source. Positional mapping is only safe
// when the counts agree; otherwise just the opening word, whose position is certain.
function applyCapitals(line, capitals) {
  const words = line.split(' ');
  if (words.length !== capitals.length) {
    return capitals[0] ? [capitaliseWord(words[0]), ...words.slice(1)].join(' ') : line;
  }
  return words.map((word, i) => (capitals[i] ? capitaliseWord(word) : word)).join(' ');
}

function joinClauses() {
  const aligned = currentPunctuation.length === currentLines.length;
  const lines = currentLines.map((line, i) =>
    aligned && capitalCheckbox.checked ? applyCapitals(line, currentPunctuation[i].capitals) : line
  );
  if (!aligned || !punctuationCheckbox.checked) return lines.join('\n');
  return lines
    .map((line, i) => {
      const { before, after } = currentPunctuation[i];
      const tail = /^[—–]/.test(after) ? ` ${after}` : after;
      return before + line + tail;
    })
    .join(' ')
    .trim();
}

const COMBINING_MACRON = '̄';
const RAISED_DOT = '·';
// A long vowel is the base letter, any stress diacritic already placed on it, then ː.
const LENGTHENED_VOWEL = new RegExp(`([${VOWELS}${VOWELS.toUpperCase()}])([\\u0300-\\u036F]*)ː`, 'g');

function applyLength(text, mode) {
  if (mode === 'dot') return text.replace(/ː/g, RAISED_DOT);
  if (mode === 'macron') return text.replace(LENGTHENED_VOWEL, `$1$2${COMBINING_MACRON}`);
  if (mode === 'double') return text.replace(LENGTHENED_VOWEL, '$1$2$1');
  return text;
}

function render() {
  const stressed = applyStress(joinClauses(), stressMode());
  const marked = applyLength(stressed, lengthMode());
  output.innerHTML = marked.replace(/θ/g, '<span class="theta">θ</span>');
}

async function transcribe() {
  const text = input.value.trim();
  if (!text) {
    currentLines = [];
    currentPunctuation = [];
    output.textContent = '';
    return;
  }
  const id = ++requestId;
  try {
    const lines = await phonemize(text, voiceSelect.value);
    if (id !== requestId) return;
    currentLines = lines;
    currentPunctuation = clausePunctuation(text);
    render();
  } catch (err) {
    if (id !== requestId) return;
    output.innerHTML = `<span class="error">Transcription failed: ${err.message}</span>`;
  }
}

function fitInput() {
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

input.addEventListener('input', fitInput);
input.addEventListener('input', debounce(transcribe, 200));
voiceSelect.addEventListener('change', transcribe);
stressRadios.forEach(radio => radio.addEventListener('change', render));
lengthRadios.forEach(radio => radio.addEventListener('change', render));
punctuationCheckbox.addEventListener('change', render);
capitalCheckbox.addEventListener('change', render);
fontSelect.addEventListener('change', () => {
  const font = fontSelect.value;
  output.style.setProperty('--output-font', font === 'system-ui' ? font : `'${font}'`);
});

// The panel hangs from its own trigger, which can sit anywhere in a wrapping row, so
// nudge it back inside the viewport rather than letting it hang off the edge.
const optionsMenu = document.querySelector('.options');
const optionsPanel = optionsMenu.querySelector('.panel');
const PANEL_MARGIN = 12;

function positionPanel() {
  if (!optionsMenu.open) return;
  optionsPanel.style.left = '0px';
  const trigger = optionsMenu.getBoundingClientRect();
  const width = optionsPanel.offsetWidth;
  const rightLimit = window.innerWidth - PANEL_MARGIN - width;
  const x = Math.max(PANEL_MARGIN, Math.min(trigger.left, rightLimit));
  optionsPanel.style.left = `${x - trigger.left}px`;
}

optionsMenu.addEventListener('toggle', positionPanel);
window.addEventListener('resize', positionPanel);

renderPresets();
document.getElementById('presets').value = 'About';
input.value = ABOUT_TEXT;
fitInput();

try {
  await populateVoices();
  await transcribe();
} catch (err) {
  output.innerHTML = `<span class="error">Failed to load espeak-ng: ${err.message}</span>`;
}
