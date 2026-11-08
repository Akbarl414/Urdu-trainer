# Roman Urdu — the one scheme used everywhere

**Status: FINAL (decided in Phase 0).** `scripts/validate-content.js` enforces §6 on every `roman` field, and `src/lang/normalise.js` implements §7. To change this scheme, change it here first, then update the validator, the normaliser tests, and all content in a single pass.

## 1. Principles

1. **Readable for an English speaker.** Plain letters, no diacritics, nothing you can't type on a phone keyboard.
2. **The sounds that change meaning are marked**: vowel length (`aa`), word-final nasal vowels (`N`), retroflex consonants (`T D R`), aspiration (`h`).
3. **Capital letters are phonetic, never grammatical.** Only `T`, `D`, `R`, `N` and `Gh` are ever capitalised. A sentence doesn't start with a capital, and neither do names: `ahmad`, `landan`, `paakistaan`.
4. **Write what people say** in everyday spoken Pakistani Urdu, not letter-by-letter transliteration of the script. For example, `behen` for بہن and `ye` for یہ. The `ur` field always carries the real spelling.
5. **Roman never stands alone.** Every Urdu word or sentence is stored as `roman` + `ur` + `en`.
6. **English loanwords keep English spelling**, in lowercase (§5).

## 2. The table

| Sound | Write | Urdu letter(s) | Examples |
|---|---|---|---|
| short a / i / u | `a`, `i`, `u` | zabar, zer, pesh (usually unwritten) | `ab`, `dil`, `tum` |
| long aa / ii / uu | `aa`, `ii`, `uu` | ا آ / ی / و | `aap`, `Thiik`, `huuN` |
| e / ai | `e`, `ai` | ے ی / ے ہ | `mere`, `hai` |
| o / au | `o`, `au` | و | `do`, `aur` |
| nasal vowel at the **end of a word** | `N` after the vowel | ں, or nasalisation | `maiN`, `haiN`, `nahiiN`, `huuN`, `kahaaN` |
| nasal vowel **inside a word** | `n` | ں / ن | `aankh`, `paanch`, `munh`, `jaaungaa` |
| retroflex | `T`, `D`, `R` | ٹ ڈ ڑ | `Thiik`, `Dar`, `laRkaa` |
| dental | `t`, `d` | ت د | `tum`, `das` |
| ch / aspirated | `ch`; add `h` for aspiration | چ; ھ (do-chashmii he) | `chaar`, `kuchh`, `khaanaa`, `ghar`, `bhaaii`, `phal`, `thaa`, `dhuup`, `Thiik`, `ThanDaa`, `jhuuTh`, `paRhnaa` |
| خ | `x` | خ | `xush`, `xabar` |
| غ | `Gh` | غ | `Ghalat` |
| ق | `q` | ق | `qariib` |
| ش | `sh` | ش | `shukriyaa` |
| z sounds | `z` | ز ذ ض ظ | `zaruur` |
| s sounds | `s` | س ص ث | `sab` |
| h sounds | `h` | ح ہ ھ (as a full h) | `hai`, `subah` |
| consonant و | `w` (never `v`) | و | `wo`, `waqt` |
| consonant ی | `y` | ی | `yahaaN` |
| ع | omitted | ع | `maaluum`, `baad`, `aurat` |
| ف | `f` | ف | `fikr` |
| ژ (rare) | `zh` | ژ | |
| everything else | the obvious letter | ب پ ج ک گ ل م ن ر | `b p j k g l m n r` |

## 3. Rules that aren't obvious from the table

1. **`N` only at the end of a word.** It marks a word-final nasal vowel: `maiN`, `meN`, `haiN`, `huuN`, `nahiiN`, `haaN`, `kahaaN`, `laRkoN`, `kitaabeN`, `roTiyaaN`, `aauuN`. Everywhere else, write a plain `n`, whether it's a nasalised vowel or a real consonant: `aankh`, `paanch`, `munh`, `saans`, `pahunchnaa`, `ThanDaa`, `band`, `zindagii`, `kyonke`, and futures like `jaaungaa`, `aaenge`, `pienge`. (So `aankh` (eye) and `band` (closed) both use `n`, even though one is a nasal vowel and the other a consonant. This is accepted for readability.)
2. **Doubled consonants are written double**: `pakkaa`, `sattar`, `bacchaa`. A doubled `ch` is written `cch`.
3. **Aspirated + doubled**: double the plain consonant, then add the aspirated one: `makkhii` (مکھی, fly), `chiTThii` (چٹھی, letter). **One exception: `acchaa`** (اچھا, really a + chh) is written `acchaa`, not `acchhaa`, so `acchaa` / `acchii` / `acche` look like `bacchaa` / `bacche`. No common word pair depends on this difference.
4. **Vowel before h is written as it's said**: `behen` (بہن), `kehnaa` (کہنا), `rehnaa` (رہنا), `pehle` (پہلے), `shehar` (شہر). When a vowel follows the h, the `a` stays: `rahaa`, `kahaa`, `kahaaN`.
5. **Word-final ہ after a consonant** is pronounced as a long vowel, so it is written `aa`: `kamraa` (کمرہ), `shukriyaa` (شکریہ), `bacchaa` (بچہ). Where the h is really heard, it is written `h`: `subah` (صبح).
6. **یہ / وہ are `ye` / `wo`**, as they're said.
7. **چائے is `chaae`** (ے = `e`).
8. **Glide `y`** is written where you hear it between vowels: `gayaa / gayii / gaye`, `aaiye`, `kiijiye`, `diyaa`, `liye`. Forms of `honaa`: `huaa / huii / hue`.
9. **`ai` vs `e`**: `ai` is the open sound in `hai`, `maiN`, `kaise`. `e` is the closed sound in `mere`, `se`, `ke`.
10. **Final `-ii` is always long**: `laRkii`, `paanii`, `bhaaii`, never `-i`, even though fast speech shortens it.
11. **Same spelling, different roman**: two words written the same in Urdu script get *different* romans when they sound different. `maiN` (میں, I) vs `meN` (میں, in); `kyaa` (کیا, what) vs `kiyaa` (کیا, did); `huaa` (ہوا, happened) vs `hawaa` (ہوا, air).
12. **Numbers are written as words** (`do`, `biis`, `saaRhe saat baje`), never as digits. Six is `chhe`.
13. **Hyphens** are allowed for fixed formulas and echo words: `assalaam-o-alaikum`, `chaae-shaae`. The normaliser treats a hyphen as a space. Apostrophes are not allowed.
14. **Punctuation** follows English: `. , ? ! …` and quotation marks for quoted speech.

## 4. Worked examples (60)

| # | Roman | Urdu | English | Shows |
|---|---|---|---|---|
| 1 | ab | اب | now | short a |
| 2 | dil | دل | heart | short i |
| 3 | tum | تم | you (familiar) | short u |
| 4 | aap | آپ | you (respectful) | long aa |
| 5 | Thiik | ٹھیک | fine, OK | retroflex Th, long ii |
| 6 | huuN | ہوں | (I) am | long uu, final nasal |
| 7 | maiN Thiik huuN | میں ٹھیک ہوں | I'm fine | the reference sentence |
| 8 | mere | میرے | my (m. pl./obl.) | e |
| 9 | hai | ہے | is | ai |
| 10 | do | دو | two | o |
| 11 | aur | اور | and | au |
| 12 | maiN | میں | I | final nasal after ai |
| 13 | meN | میں | in | same script as #12, different sound |
| 14 | haiN | ہیں | are | final nasal |
| 15 | nahiiN | نہیں | no, not | final nasal after ii |
| 16 | haaN | ہاں | yes | final nasal after aa |
| 17 | aankh | آنکھ | eye | nasal vowel inside a word → n |
| 18 | paanch | پانچ | five | nasal vowel inside a word → n |
| 19 | munh | منہ | mouth | nasal vowel inside a word → n |
| 20 | ThanDaa | ٹھنڈا | cold | consonant n before retroflex D |
| 21 | Dar | ڈر | fear | retroflex D |
| 22 | laRkaa | لڑکا | boy | retroflex flap R |
| 23 | laRkii | لڑکی | girl | final -ii |
| 24 | paRhnaa | پڑھنا | to read, study | aspirated flap Rh |
| 25 | chhoTaa | چھوٹا | small | chh, retroflex T |
| 26 | das | دس | ten | dental d |
| 27 | tiin | تین | three | dental t |
| 28 | chaar | چار | four | ch |
| 29 | kuchh | کچھ | some, something | chh |
| 30 | khaanaa | کھانا | food; to eat | aspirated kh |
| 31 | ghar | گھر | house, home | aspirated gh |
| 32 | bhaaii | بھائی | brother | aspirated bh |
| 33 | phal | پھل | fruit | ph is p + h, **not** f |
| 34 | thaa | تھا | was | th is t + h, **not** English "th" |
| 35 | dhuup | دھوپ | sunshine | dh |
| 36 | jhuuTh | جھوٹ | a lie | jh, final Th |
| 37 | xush | خوش | happy | x for خ |
| 38 | xabar | خبر | news | x |
| 39 | Ghalat | غلط | wrong | Gh for غ |
| 40 | Ghazal | غزل | ghazal | Gh |
| 41 | qariib | قریب | near | q for ق |
| 42 | shukriyaa | شکریہ | thank you | sh; final ہ as aa |
| 43 | zaruur | ضرور | definitely | z for ض |
| 44 | sab | سب | all | s |
| 45 | waqt | وقت | time | consonant w |
| 46 | yahaaN | یہاں | here | consonant y |
| 47 | pakkaa | پکا | firm, for sure | doubled k |
| 48 | bacchaa | بچہ | child | doubled ch = cch |
| 49 | acchaa | اچھا | good; OK | cch (the aspiration exception) |
| 50 | makkhii | مکھی | fly (insect) | doubled + aspirated |
| 51 | maaluum | معلوم | known | ع omitted |
| 52 | aurat | عورت | woman | ع omitted |
| 53 | behen | بہن | sister | vowel before h, as said |
| 54 | kyaa / kiyaa | کیا / کیا | what / did | same script, different roman |
| 55 | huaa / hawaa | ہوا / ہوا | happened / air | same script, different roman |
| 56 | gayaa · gayii · gaye | گیا · گئی · گئے | went (m. sg · f · m. pl) | glide y |
| 57 | kamraa · kamre · kamroN | کمرہ · کمرے · کمروں | room · rooms/obl. · obl. pl | final ہ as aa; final nasal |
| 58 | kitaabeN · roTiyaaN | کتابیں · روٹیاں | books · breads | feminine plurals with final nasal |
| 59 | ye · wo · chaae | یہ · وہ · چائے | this · that · tea | decided spellings |
| 60 | jaaungaa · aaenge | جاؤں گا · آئیں گے | I'll go · (they) will come | nasal inside a word → n |

## 5. English loanwords

English words used in Urdu keep **normal English spelling, all lowercase**: `phone`, `bus`, `tv`, `doctor`, `hospital`, `office`, `ticket`. Names of English places and brands follow the same rule (`tesco`), but Urdu-pronounced place names use the scheme (`landan`, `paakistaan`, `laahaur`).

- In `vocab.json` the word carries `"loanword": true`. Its `roman` (and anything in its `forms`) is exempt from the scheme rules in §6. Only the lowercase check applies: letters `a–z` (including `v`), space and hyphen, plus a final `N` when an Urdu ending is attached (`buseN`).
- **In sentences**, a token is exempt when it matches the `roman` or `forms` of a loanword entry introduced in this or an earlier lesson. All other tokens in the sentence are checked normally.
- **Urdu endings on English stems** are written as the English stem plus the Urdu ending, and each such form is listed in `forms`: `buseN` (buses), `doctoroN ko` (to the doctors). English plural `-s` is not used: like any unmarked masculine noun, `phone` stays `phone` in the plural. The validator exempts these forms only when they are listed.
- **Code-switched verbs** (`miss karnaa`, `book karnaa`, `enjoy karnaa`): the English part is a loanword entry (`miss`, `book`, `enjoy`); `karnaa` is checked normally.
- Gender still matters and is required for loanword nouns: `phone` m, `bus` f, `tv` m, `doctor` m.
- The `ur` field uses the normal Urdu spelling (`فون`, `بس`, `ٹی وی`, `ڈاکٹر`).
- Typed answers for loanwords are matched case-insensitively, ignoring punctuation.

## 6. What the validator enforces on every `roman` field

1. **Characters**: lowercase `a–z` except `v`; capitals `T D R N G` only; space, hyphen, and `. , ? ! … ; : " ( )`. In exercise prompt fields the blank marker `___` is also allowed. No digits, no apostrophes.
2. **`G` only as `Gh`.**
3. **`N` only directly after a vowel letter (`a e i o u`) and at the end of a word** (followed by a space, punctuation, a hyphen, or the end of the field).
4. **`c` only as part of `ch`, or as the first half of the doubled `cch`** (`chh` is ch + h).
5. **No `ee`, `oo`, or a tripled vowel.** These are typical English-style slips (`theek`, `hoon`); long vowels are written `ii`, `uu`.
6. **A capital at the start of a sentence is only allowed if it's one of `T D R N`** (e.g. `Thiik hai.` is fine; `Main` fails on both `M` and the spelling).
7. Each `roman` field has a non-empty `ur` sibling in Arabic script (U+0600–U+06FF, U+0750–U+077F, U+FB50–U+FDFF, U+FE70–U+FEFF) and an `en` sibling.
8. Loanword tokens are exempt from rules 1–6 as described in §5. They must still be lowercase, apart from a final `N` from an Urdu ending.

The validator can't check things that need the ear, like vowel quality (`behen`) or word choice. Those are on the manual accuracy checklist in CONTENT_GUIDE.md (Phase 6).

## 7. How typed answers are matched (implemented in `src/lang/normalise.js`)

- **Exact**: same letters and capitals, ignoring punctuation and extra spaces. A hyphen counts as a space.
- **Close enough (counted correct, the exact form shown with differences highlighted)**:
  - capitals ignored: `T/t`, `D/d`, `R/r`, `Gh/gh`;
  - nasal marking ignored **only where the expected word has `N`**: `huuN ~ hun ~ hu`, `nahiiN ~ nahin ~ nahi`. A plain consonant `n` must match: `din ≠ dii`, `jaan ≠ jaa`, in both directions;
  - vowel length ignored: `aa ~ a`, `ii ~ i`, `uu ~ u`;
  - doubled consonants ignored: `pakkaa ~ pakaa`;
  - common phone spellings accepted: `ee → ii` (`theek`), `oo → uu` (`hoon`), `v → w` (`vo`), `mein → meN`, `hain → haiN`;
  - fixed greetings as people type them, when the answer contains that greeting: `assalamualaikum`, `asalamualaikum`, `salam alaikum`, `salam` for `assalaam-o-alaikum`; `walaikum assalam`, `walaikumassalam`, `walaikum salam` for `wa-alaikum-assalaam`; `alhamdolillah`, `alhumdulillah` for `alhamdulillaah`. From lesson 5: `nhi`, `nai` for `nahiiN`; `pta nhi`, `pata nai` for `pataa nahiiN`; `g` (the usual texting spelling) for `jii`; `taiyaar`, `tyar` for `tayyaar` (`tayyar` already folds to it). From lessons 6–10: `aap ka/ki/ke` for `aapkaa/aapkii/aapke`, `tumara` for `tumhaaraa`, `kia` for `kyaa`, `khush` for `xush`, `bohat` and `bht` for `bahut`, `preshan` for `pareshaan`, `shukria` for `shukriyaa`, `maaf kijie` for `maaf kiijiye`, `koi baat nhi` for `koii baat nahiiN`, `khuda hafiz` for `xudaa haafiz`, `allahafiz` for `allaah haafiz`, `fir milenge` and `phir milain ge` for `phir milenge`, `insha allah` for `inshaallaah`, `apna khayal rakhiye` for `apnaa xayaal rakhiye`, `aie` for `aaiye`, `bethiye` for `baiThiye`, `chai` for `chaae`, `len ge` for `lenge`, `khubsurat` for `xuubsuurat`, `fir aiye ga` for `phir aaiyegaa`. The list is `PHONE_PHRASES` in `normalise.js`. A variant never counts for a different phrase (`salam` is not the reply).
- **Never close enough on endings that carry grammar**: `laRkaa ≠ laRkii ≠ laRke`, `gayaa ≠ gayii ≠ gaye`, `kaa ≠ kii ≠ ke`. Collapsing vowel length must never let a wrong ending match a right one. The normaliser tests cover every one of these pairs.
