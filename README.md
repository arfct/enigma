# Enigma

Text to IPA phonemes, entirely in the browser. No server, no API, works offline
once loaded.

Named for the **engma** — ŋ, U+014B, the velar nasal at the end of *sing* — which
sits one letter away from the project's own name and serves as its logo.

Type or paste text and the phonemic transcription appears beneath it, set in
[Gentium](https://software.sil.org/gentium/) or one of four other SIL faces
drawn for phonetic notation.

## How it works

[eSpeak NG](https://github.com/espeak-ng/espeak-ng) compiled to WebAssembly, via
the [phonemizer](https://www.npmjs.com/package/phonemizer) package, vendored into
`vendor/`. Its letter-to-sound rules mean unknown words still get sensible
pronunciations — Carroll's `slˈɪθi tˈoʊvz` transcribes fine.

espeak discards punctuation and splits its output at clause boundaries, so
`app.js` re-aligns the source punctuation onto the returned clauses.

## Controls

- **Presets** — phonetics passages, pangrams, tongue twisters, literature
- **Dialect** — nine English variants, defaulting to General American
- **Font** — Gentium, Gentium Book, Charis, Doulos SIL, Andika, or the system UI font
- **Stress** — accent marks (acute for primary, grave for secondary), highlighted
  vowels, raw IPA stress marks, or none

## Development

No build step; it is plain ES modules and static files.

```sh
npx http-server -p 8642 -c-1
```

## Licences

App code MIT. Bundled fonts are SIL Open Font License. `vendor/phonemizer.js`
wraps eSpeak NG (GPL-3.0); see `vendor/phonemizer-LICENSE`.
