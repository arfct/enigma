import { phonemize, list_voices } from './vendor/phonemizer.js';

const input = document.getElementById('input');
const output = document.getElementById('output');
const voiceSelect = document.getElementById('voice');
const stressSelect = document.getElementById('stress');
const fontSelect = document.getElementById('font');

const DEFAULT_VOICE = 'en-us';

const PRESETS = {
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

function clausePunctuation(text) {
  const parts = text.split(CLAUSE_BREAK);
  const marks = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i];
    const mark = (parts[i + 1] || '').trim();
    if (body && body.trim()) marks.push(mark);
    else if (mark && marks.length) marks[marks.length - 1] += mark;
  }
  return marks;
}

const STRESS_MARKS = /[ˈˌ]/g;
const VOWEL_RUN = '[iɪyʏeøɛœæaɶɑɒɔoʊuʉɨᵻᵿʌəɚɜɝɐɞɤː˞]+';
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

function joinClauses() {
  if (currentPunctuation.length !== currentLines.length) return currentLines.join('\n');
  return currentLines
    .map((line, i) => {
      const mark = currentPunctuation[i];
      return /^[—–]/.test(mark) ? `${line} ${mark}` : line + mark;
    })
    .join(' ')
    .trim();
}

function render() {
  const marked = applyStress(joinClauses(), stressSelect.value);
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
stressSelect.addEventListener('change', render);
fontSelect.addEventListener('change', () => {
  const font = fontSelect.value;
  output.style.setProperty('--output-font', font === 'system-ui' ? font : `'${font}'`);
});

renderPresets();
fitInput();

try {
  await populateVoices();
  await transcribe();
} catch (err) {
  output.innerHTML = `<span class="error">Failed to load espeak-ng: ${err.message}</span>`;
}
