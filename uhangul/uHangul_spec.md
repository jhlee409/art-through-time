# uHangul v0.7

The final specification is `uhangul/spec/uhangul-v0.7.json`.

| Token | Phoneme | Source glyph | Position |
|---|---|---|---|
| F | /f/ | ᅗ | onset only |
| V | /v/ | ᄫ | onset only |
| Z | /z/ | ᅀ | onset only |
| R | /ɹ/ | ᄛ | onset only |
| X | /x/ | ᅘ | onset only |
| TH | /θ/ | θ | onset only |

Each extended syllable is stored as one U+FB000 private-use code point. New
consonants are never used in final position.
