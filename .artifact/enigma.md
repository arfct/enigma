---
title: Enigma
date: 2026-08
category: tool
tags:
  - web
  - writing
url: https://arfct.github.io/enigma/
links:
  source: https://github.com/arfct/enigma
media:
  - src: transcription.png
    caption: The opening of the Declaration of Independence, one of the presets, and its transcription beneath it in Gentium
    alt: A cream page with three lines of English text in black, a thin rule, and below it three lines of the same sentence in brown phonetic letters with accents
  - src: options.png
    caption: The Options menu, set to the American dialect, Gentium, accents for stress and doubled letters for long vowels
    alt: The same page with a white menu open at the top right listing Dialect America, Font Gentium, Stress Accents, Vowel length Doubling, and two ticked boxes for punctuation and capitalization
unconfirmed:
  - date
---

"We hold these truths to be self-evident" comes out of Enigma as "Wii hoʊld ðiiz tɹuuϑs təbi sɛlfɛ́vɪdənt". The page transcribes English text into IPA phonemes as it is typed, and then changes the raw IPA in nine ways, which a notation file specifies for reuse. Long vowels are doubled where IPA writes a length mark. Stress moves onto the vowel as an acute or a grave accent and is left unwritten on a first syllable, where English puts it by default, and the capitals and punctuation of the source text are restored.

The transcription is done in the browser by eSpeak NG compiled to WebAssembly, so the page has no server and works offline once loaded. eSpeak applies letter-to-sound rules, which means that a word absent from any dictionary, such as Carroll's "slithy", is transcribed as well. Hovering over a word shows the word it came from. An options menu covers nine English dialects, six fonts, four ways of marking stress and four of marking vowel length, and the presets load phonetics passages, pangrams, tongue twisters, literature and speeches.

The name comes from the engma, ŋ, the letter for the sound at the end of "sing", which is the logo.

JavaScript with no build step, eSpeak NG in WebAssembly, SIL fonts. 2026.
