# Enigma notation

The conventions Enigma uses to turn English text into its phonemic script, written
down so they can be reimplemented elsewhere. The engine is eSpeak NG (via the
`phonemizer` WASM build); everything below is a transformation applied to espeak's
raw output, which looks like `wˈɜːld` — IPA with inline stress ticks and length
colons.

## The modifications from base phonetics

Every way Enigma's default output departs from the raw IPA espeak produces:

| # | Base IPA                          | Enigma                                | Rule |
| - | --------------------------------- | ------------------------------------- | ---- |
| 1 | `ˈ` tick before stressed vowel    | *nothing* when word-initial           | Initial primary stress is the English default; unwritten |
| 2 | `ˈ` tick, non-initial             | acute on vowel: `ɐɡóʊ`                | U+0301 on first character of the vowel run |
| 3 | `ˌ` secondary tick                | grave on vowel: `ɪ̀ntɚ`                | U+0300, always written |
| 4 | `ː` length colon                  | doubled vowel: `tɜ́ɜnz`                | Echo copies the base letter, lowercase, no accent |
| 5 | lowercase only                    | source capitals restored: `Wɑ́ɑʃɪŋtən` | First base letter raised, skipping the Lm ticks |
| 6 | punctuation discarded             | source punctuation restored           | Clause-level only; inner marks unrecoverable |
| 7 | numbers spoken out                | numerals verbatim: `3.14`, `1,000`    | Pure-digit tokens only; `3%` still speaks |
| 8 | flat text                         | each word titled with its source word | Only when clause word counts align |
| 9 | θ at full ascender height         | script ϑ at 0.86em: `tɹuuϑs`          | U+03D1 (capital: U+03F4 ϴ); open cursive form sits in running text |

Everything else — the phoneme inventory, flapping (`ɾ`), rhotacized vowels
(`ɚ ɝ`), the reduced `ᵻ` — is espeak's own General American output, untouched.

## Defaults at a glance

| Setting        | Default             | Alternatives                          |
| -------------- | ------------------- | ------------------------------------- |
| Dialect        | `en-us` (General American) | eight other espeak English variants |
| Font           | Gentium             | Gentium Book, Charis, Doulos SIL, Andika, system-ui |
| Stress         | Accent marks (sparse) | Highlighted, raw IPA marks, none    |
| Vowel length   | Doubling            | Triangular colon, raised dot, macron  |
| Punctuation    | Included            | off                                   |
| Capitalization | Preserved           | off                                   |

The default combination — sparse accents, doubled vowels, restored punctuation and
capitals — is what gives output its archaic, almost-readable character:

> We hold these truths to be self-evident, that all men are created equal.
>
> Wii hoʊld ðiiz tɹuuϑs təbi sɛlfɛ́vɪdənt, ðæt ɔɔl mɛn ɑɑɹ kɹiiéɪɾᵻd iikwəl.

## Stress

espeak marks primary stress `ˈ` and secondary stress `ˌ` as spacing ticks placed
immediately before the stressed vowel. The four renderings:

**Accent marks (default).** Combining diacritics on the first character of the
stressed vowel run (the Americanist convention for diphthong nuclei — the acute in
`ɐɡóʊ` sits on the `o`, not the `ʊ`):

- Primary stress on the **first syllable of a word is unwritten** — it is the
  English default, so marking it is noise. A word has a vowel before its primary
  tick or it doesn't; only when it does is U+0301 combining acute applied:
  `hoʊld` (unmarked) vs `ɐɡóʊ`, `sɛlfɛ́vɪdənt`, `fətɑ́ɑɡɹəfi`.
- Secondary stress **always** takes U+0300 combining grave: `ɪ̀ntɚnǽʃənəl`, `àʊɚ`.
- The raised/lowered tick pair maps onto the raised/lowered accent pair, so no
  information is lost relative to IPA — the encoding just moves onto the vowel.
- Caveat: an acute over `ɪ` is nearly indistinguishable from `í` at reading size.
  The length mark usually disambiguates (`bɪ́t` vs `bíit`), but the vowel-glyph
  contrast itself collapses under the accent.

**Highlighted.** No marks; the stressed vowel run is wrapped in a styled span —
primary in full accent colour and bold, secondary in the same colour at ~55%
opacity. Survives nothing on copy-paste; display-only.

**Stress marks.** espeak's ticks passed through untouched: `sˈɛlfˈɛvɪdənt`.

**None.** Ticks stripped.

## Vowel length

espeak marks long vowels with U+02D0 `ː`. The four renderings, applied after
stress so an accent already sits on the base letter:

- **Doubling (default).** `aː` → `aa`, as in Finnish, Estonian, or Dutch
  orthography, and as archaic Latin inscriptions marked length. The echo vowel
  copies any base letter but **stays lowercase after a capital**: `Ɑ́ɑɹθɚɹ`, never
  `Ɑ́Ɑɹθɚɹ`. A stress diacritic is not copied: `tɜ́ɜnz`, not `tɜ́ɜ́nz`.
- **Triangular colon.** IPA standard, untouched: `tɜ́ːnz`.
- **Raised dot.** `ː` → U+00B7 middle dot: `tɜ́·nz`. Boas's 1911 length mark,
  formalised in the 1916 AAA report. Note the collision: IPA's own U+02D1 `ˑ`
  looks the same but means *half*-long.
- **Macron.** U+0304 combining macron on the vowel, dropping the colon: `tɜ̄nz`.
  Stacks with stress accents (`ī́`) legibly in SIL fonts but visually tight;
  pairs better with the highlighted or none stress modes.

## Punctuation

espeak splits output at clause punctuation and discards the marks, so Enigma
re-aligns the source's punctuation onto the returned clauses:

- Clause-terminating punctuation (`. , : ; ? ! … — –`) is restored at clause
  boundaries. A period between digits is not a boundary.
- Quotes at clause edges are carried through. Straight quotes are identical
  opening and closing, so parity across the text decides which clause they attach
  to, and a closing quote whose opener fell mid-clause is dropped rather than
  stranded.
- Punctuation *inside* a clause — parentheses, mid-clause quotes, hyphens — is
  unrecoverable at this level and silently dropped.
- With the option off, output is one line per clause, unpunctuated.

## Numerals

A standalone number token — digits with optional internal dots and commas,
nothing else attached (`3`, `3.14`, `1,000`) — is not transcribed. It is silenced
before espeak (replaced with a clause break, so nothing is spoken) and the
literal digits are re-inserted through the punctuation channel: `Hii hǽz 3 dɑ́ɑɡz
ænd 1,000 kǽts.` Mixed tokens (`3%`, `$5`, `7th`) still transcribe as speech.
Because numerals travel with punctuation, turning punctuation off drops them too.

## Capitalization

espeak lowercases everything, so capitalization is re-applied from the source:

- The first *base letter* of the phonemic word is uppercased. The stress ticks
  `ˈ ˌ` are Unicode modifier letters (Lm) — naive first-letter logic uppercases
  the tick, a no-op, so Lm must be skipped.
- Word-for-word mapping is trusted only when a clause's source and output word
  counts agree. espeak merges function words (*to be* → `təbi`) and expands what
  it speaks, so on mismatch only the clause-initial word — whose position is
  certain — is capitalized.
- Uppercase vowels must be included in the vowel class used by stress and length
  rules, or a capitalized nucleus loses its accent.

## Word alignment (hover titles)

Each phonemic word is wrapped in an element whose `title` is the source word it
transcribes, using the same count-match rule as capitalization: on mismatch every
word in the clause carries the whole source clause rather than a wrong guess.
Source tokens with nothing to pronounce (a lone quote) are excluded from the
count. Titles are trimmed of edge punctuation.

## Typographic notes

- θ is drawn at ascender height and towers over lowercase IPA; substitute the
  script form ϑ (U+03D1, capital ϴ U+03F4) and render at 0.86em. All four SIL
  faces carry both as designed glyphs. This is a display substitution — copied
  text contains ϑ, not θ.
- The SIL faces (Gentium, Charis, Doulos SIL, Andika) are the only bundled fonts
  with complete, purpose-drawn IPA glyphs and correct mark stacking; system fonts
  vary.
- Transcription is set in its own ink colour (sepia `#6b4b2e` on light,
  `#d9bb95` on dark) at the same size as the source text.

## Implementation constraints

- No regex lookbehind anywhere — Safari before 16.4 fails to *parse* it, which
  kills the whole module. Decimal points are protected by substitution instead.
- Private-use characters U+E000 (protected decimal point) and U+E001 (numeral
  brackets) are internal to the clause splitter and must never reach output.
- The espeak vowel inventory used for nucleus detection:
  `iɪyʏeøɛœæaɶɑɒɔoʊuʉɨᵻᵿʌəɚɜɝɐɞɤ` plus uppercase forms, `ː`, and `˞`.
