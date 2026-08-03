import { phonemize, list_voices } from './vendor/phonemizer.js';

const input = document.getElementById('input');
const output = document.getElementById('output');
const voiceSelect = document.getElementById('voice');
const fontSelect = document.getElementById('font');
const stressSelect = document.getElementById('stress');
const lengthSelect = document.getElementById('length');
const punctuationCheckbox = document.getElementById('punctuation');
const capitalCheckbox = document.getElementById('capitals');

function stressMode() {
  return stressSelect.value;
}

function lengthMode() {
  return lengthSelect.value;
}

const DEFAULT_VOICE = 'en-us';

const ABOUT_TEXT =
  'Enigma turns plain writing into cryptic script. Type anything and it reappears below ' +
  'spelled as pure sound: familiar words made suddenly strange, in an alphabet you can ' +
  'almost read.';

const PRESETS = {
  'About': [
    {
      label: 'About',
      text: ABOUT_TEXT,
    },
  ],
  'Phonetics passages': [
    {
      // One story verified to produce every symbol of espeak's General American
      // output: all consonants including ʒ ŋ ɾ ʔ n̩, every vowel and diphthong,
      // both stress marks, and the reduced ᵻ (in "waited").
      label: 'Every sound',
      text: 'Usually the weather was calm, but that night a huge storm caught the old fisherman far from shore. Thunder crashed, and azure waves rose like dark mountains. He pushed through the water, gripping his little wooden boat and thinking of his young son Roy, asleep at home. First the sail tore; then the rudder snapped. "Courage," he said, in a strange, measured voice. When morning came, he watched the deep green sea turn gold, fixed the torn sail with a button and good thread, and enjoyed the long, quiet voyage home, where the boy had waited all night on the beach, waving a yellow toy ship.',
    },
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
// A period between digits (3.14) is not a break, so decimal points are removed before
// splitting rather than excluded with lookbehind, which Safari before 16.4 cannot
// even parse — it kills the whole module and strands the page on its loading message.
const DECIMAL_POINT = /(\d)\.(?=\d)/g;

// A standalone numeral is not read out — it is silenced for espeak and carried
// through to the output verbatim, riding the same rails as punctuation. U+E001
// brackets mark it as a separator during the clause split.
const NUMBER_TOKEN = /(^|[\s“”"'‘’([{])(\d(?:[\d.,]*\d)?)(?=[\s.,:;?!…—–”"’')\]}]|$)/g;
const SEPARATOR = /((?:[.,:;?!…—–]|\uE001[^\uE001]*\uE001)+)/g;

function separatorText(separator) {
  return separator.replace(/\uE001([^\uE001]*)\uE001/g,
    (_, numeral) => ' ' + numeral.split(DECIMAL_STANDIN).join('.'));
}

function silenceNumbers(text) {
  return text.replace(NUMBER_TOKEN, '$1;');
}

// espeak emits nothing for a fragment with no letters or digits in it, so only
// those count as clauses — otherwise a trailing quote after a full stop (know.")
// would claim a clause of its own and throw the whole alignment off.
const SPEAKABLE = /[\p{L}\p{N}]/u;
const CAPITALISED = /^[^\p{L}]*\p{Lu}/u;
const OPENING = /^[\s“”"'‘’([{¿¡]*([“"'‘([{¿¡]+)/;
const CLOSING = /([”"'’)\]}]+)[\s]*$/;

const DECIMAL_STANDIN = '\uE000';

function clausePunctuation(text) {
  // Numerals become bracketed separators; decimal points ride through the clause
  // split disguised as a private-use character and reappear as dots afterwards.
  const parts = text
    .replace(NUMBER_TOKEN, '$1\uE001$2\uE001')
    .replace(DECIMAL_POINT, `$1${DECIMAL_STANDIN}`)
    .split(SEPARATOR);
  const clauses = [];
  let insideQuote = false;
  let pending = '';
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] || '';
    const separator = separatorText(parts[i + 1] || '');
    if (!SPEAKABLE.test(body)) {
      const insert = body.trim() + separator;
      if (clauses.length) clauses[clauses.length - 1].after += insert;
      else pending += insert;
      continue;
    }
    let before = (body.match(OPENING) || ['', ''])[1] || '';
    if (pending) {
      before = `${pending.trim()} ${before}`;
      pending = '';
    }
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
    clauses.push({
      before,
      after: after + separator,
      // A token with nothing to pronounce (a lone quote mark) produces no espeak
      // output, so it must not count against the word-for-word alignment.
      words: body
        .trim()
        .split(/\s+/)
        .filter(word => SPEAKABLE.test(word))
        .map(word => word.split(DECIMAL_STANDIN).join('.')),
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

  // Input that was nothing but numerals produces no clauses at all; give the
  // pending text a clause of its own so it still renders.
  if (!clauses.length && pending.trim()) {
    clauses.push({ before: pending.trim(), after: '', words: [] });
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
const ANY_VOWEL = new RegExp(`[${VOWELS}${VOWELS.toUpperCase()}]`);
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
    // Sparse marking, as in dictionaries: word-initial primary stress is the
    // default and goes unwritten; only a primary later in the word earns its
    // acute. Secondary stress is always the surprise, so it always gets a grave.
    return escaped
      .replace(PRIMARY_STRESS, (_, run, offset, whole) =>
        ANY_VOWEL.test(whole.slice(0, offset)) ? markNucleus(run, COMBINING_ACUTE) : run)
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

const COMBINING_MACRON = '̄';
const RAISED_DOT = '·';
// A long vowel is the base letter, any stress diacritic already placed on it, then ː.
const LENGTHENED_VOWEL = new RegExp(`([${VOWELS}${VOWELS.toUpperCase()}])([\\u0300-\\u036F]*)ː`, 'g');

function applyLength(text, mode) {
  if (mode === 'dot') return text.replace(/ː/g, RAISED_DOT);
  if (mode === 'macron') return text.replace(LENGTHENED_VOWEL, `$1$2${COMBINING_MACRON}`);
  // The echo vowel stays lowercase even when capitalisation raised the first one.
  if (mode === 'double') {
    return text.replace(LENGTHENED_VOWEL, (_, vowel, marks) => vowel + marks + vowel.toLowerCase());
  }
  return text;
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => HTML_ESCAPES[c]);
}

const WORD_EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function wordHtml(word, title) {
  let html = applyLength(applyStress(word, stressMode()), lengthMode());
  // Script theta: same phoneme, but the open cursive form sits better in running
  // text than the ascender-height θ. Capitalisation can have raised θ to Θ before
  // this runs, so both cases substitute (ϴ is U+03F4, capital theta symbol).
  html = html.replace(/θ/g, '<span class="theta">ϑ</span>').replace(/Θ/g, '<span class="theta">ϴ</span>');
  const clean = title.replace(WORD_EDGE_PUNCTUATION, '');
  if (!clean) return html;
  return `<span title="${escapeHtml(clean).replace(/"/g, '&quot;')}">${html}</span>`;
}

// espeak runs some function words together (to be → təbi) and expands numbers, so a
// clause's word count often differs from the source. Word-for-word mapping — for both
// capitals and hover titles — is only trusted when the counts agree; otherwise each
// word carries the whole source clause and only the certain opening capital is raised.
function render() {
  const aligned = currentPunctuation.length === currentLines.length;
  const includePunctuation = aligned && punctuationCheckbox.checked;
  const clauses = currentLines.map((line, i) => {
    const clause = aligned ? currentPunctuation[i] : null;
    const source = clause ? clause.words : [];
    let words = line.split(' ').filter(Boolean);
    const matched = source.length === words.length;
    if (clause && capitalCheckbox.checked && words.length && source.length) {
      if (matched) {
        words = words.map((word, j) => (CAPITALISED.test(source[j]) ? capitaliseWord(word) : word));
      } else if (CAPITALISED.test(source[0])) {
        words[0] = capitaliseWord(words[0]);
      }
    }
    const clauseSource = source.join(' ');
    const html = words.map((word, j) => wordHtml(word, matched ? source[j] : clauseSource)).join(' ');
    if (!includePunctuation || !clause) return html;
    const tail = /^[—–]/.test(clause.after) ? ` ${escapeHtml(clause.after)}` : escapeHtml(clause.after);
    return escapeHtml(clause.before) + html + tail;
  });
  output.innerHTML = clauses.join(includePunctuation ? ' ' : '\n').trim();
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
    const lines = await phonemize(silenceNumbers(text), voiceSelect.value);
    if (id !== requestId) return;
    currentLines = lines;
    currentPunctuation = clausePunctuation(text);
    // Numeral-only input gives espeak nothing to say but still has a clause to show.
    if (!currentLines.length && currentPunctuation.length) currentLines = [''];
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
stressSelect.addEventListener('change', render);
lengthSelect.addEventListener('change', render);
punctuationCheckbox.addEventListener('change', render);
capitalCheckbox.addEventListener('change', render);
fontSelect.addEventListener('change', () => {
  const font = fontSelect.value;
  output.style.setProperty('--output-font', font === 'system-ui' ? font : `'${font}'`);
});

// A select's natural width fits its longest option, leaving short values adrift in a
// wide box, so size each one to the option actually chosen.
const measure = document.createElement('span');
measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
document.body.append(measure);

function fitSelect(select) {
  const option = select.selectedOptions[0];
  if (!option) return;
  const style = getComputedStyle(select);
  measure.style.font = style.font;
  measure.textContent = option.textContent;
  select.style.width = `${Math.ceil(measure.offsetWidth + parseFloat(style.paddingRight)) + 4}px`;
}

function fitAllSelects() {
  document.querySelectorAll('select').forEach(fitSelect);
}

document.addEventListener('change', event => {
  if (event.target.matches('select')) fitSelect(event.target);
});

// The panel is anchored to the trigger's right edge, which is always on-screen — a
// left anchor let the panel momentarily jut past the viewport and widen the mobile
// layout before any clamp could run. Only a left-side overflow needs a nudge.
const optionsMenu = document.querySelector('.options');
const optionsPanel = optionsMenu.querySelector('.panel');
const PANEL_MARGIN = 12;

function positionPanel() {
  if (!optionsMenu.open) return;
  optionsPanel.style.right = '0px';
  const rect = optionsPanel.getBoundingClientRect();
  if (rect.left < PANEL_MARGIN) {
    optionsPanel.style.right = `${rect.left - PANEL_MARGIN}px`;
  }
}

optionsMenu.addEventListener('toggle', positionPanel);
window.addEventListener('resize', positionPanel);

renderPresets();
document.getElementById('presets').value = 'About';
input.value = ABOUT_TEXT;
fitInput();
fitAllSelects();

try {
  await populateVoices();
  fitSelect(voiceSelect);
  await transcribe();
} catch (err) {
  output.innerHTML = `<span class="error">Failed to load espeak-ng: ${err.message}</span>`;
}
