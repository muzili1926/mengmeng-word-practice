# IPA pronunciation data notice

The pronunciation data bundled in `ngsl-phonetics.json` and `books/*.json` combines the original vocabulary-book pronunciation columns with filtered open pronunciation entries. UK and US variants are kept in separate fields.

- US source: [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict), `data/en_US.txt`; the project credits the English US data as based on modified `cmudict-ipa` (MIT).
- UK source: [JoseLlarena/Britfone](https://github.com/JoseLlarena/Britfone), Britfone 3.0.1; the project describes it as British RP/Standard Southern British IPA data under MIT.
- Entries were selected only when a bundled vocabulary list lacked that accent's pronunciation.
- Retained license texts: `IPA-DICT-LICENSE.txt` and `BRITFONE-LICENSE.txt`.

Wiktionary entries were used to fill a small number of remaining NGSL gaps; see `NOTICE-WIKTIONARY.md` for entry links and attribution. Where Wiktionary provides one unlabelled pronunciation, it is recorded in both accent fields and identified as a common source form there. Any remaining missing UK/US forms stay blank.
