# Urdu Trainer — Curriculum

The full path from A1 to low B2 spoken Urdu: **18 units × 10 lessons = 180 lessons**. Lesson 10 of every unit is a review lesson (no new grammar, 0–4 new items). Lesson ids are global: `lesson-001` … `lesson-180`.

This file is the plan of record. Keep it up to date when content is generated. Titles may be polished when a unit is written. **Once a lesson ships, its id and position never change** (CLAUDE.md, content ids rule).

**Contexts**: `family` (family and hospitality), `media` (films, music, TV), `uk-life` (community and everyday life in the UK).
**Roman Urdu** below follows [ROMANIZATION.md](./ROMANIZATION.md). English loanwords keep their English spelling in lowercase (`phone`, `bus`, `tv`, `doctor`) and carry `"loanword": true` in content.

## Budget

| | Per unit | Whole course |
|---|---|---|
| Teaching lessons | 9 × 7–9 new items | 162 lessons |
| Review lessons | 1 × 0–4 items | 18 lessons |
| New items (words + phrases) | ≤ 80 | ≈ 1,440 (≈ 1,250 words + ≈ 190 phrases) |
| Exercises | 9 × 8–12 + review 12 | ≈ 1,900 |

## CEFR map

| Units | Level | You can… |
|---|---|---|
| 1–4 | A1 | greet, introduce your family, say what you have and where things are |
| 5–8 | A2 | describe things, talk about routines and what's happening now, ask for and give simple instructions |
| 9–12 | B1 | make plans, say what you like and need, tell what happened |
| 13–16 | B1+ | express ability, completion and feelings naturally, tell stories, talk about possibilities |
| 17–18 | low B2 | join clauses freely, report what people said, sound natural in mixed Urdu–English conversation |

## Grammar features (drive facet unlocking)

| Feature | Unlocked by | Effect |
|---|---|---|
| `gender` | lesson-011 | noun `gender` facet, Gender sort game |
| `oblique` | lesson-032 | `oblique`-tagged exercises in Agreement snap |
| `agreement` | lesson-041 | Agreement snap (adjectives) |
| `perfective` | lesson-101 | verb `perfective` facet, perfective items in Agreement snap |
| `ne` | lesson-116 | verb `takes_ne` facet, "Ne or no ne?" game |

---

## Unit 1 — Salaam! Greetings, respect and "to be" · A1

**Can-do:** greet people of any age correctly, say how you are, introduce family members, use `jii` and the right "you".
**Vocab themes:** greetings, politeness formulas, close family, basic feelings, a few question words as chunks. You may already know much of this, so the **"I already know this"** button carries a lot of weight here.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 001 | Salaam and how are you? | Urdu puts the verb last: `maiN Thiik huuN` = "I fine am" | You can greet someone and say how you are | family |
| 002 | Three ways to say "you" | `aap` / `tum` / `tuu` and who gets which; `jii` as the respect particle | You can choose the right "you" for an elder, a friend or a child | family |
| 003 | I am, you are | `honaa` present: `huuN / hai / haiN / ho` (full table) | You can say who and how people are | uk-life |
| 004 | This is my mum | `ye` / `wo` as "this/he/she" and "that/he/she"; `meraa / merii` as a chunk; respect plural (`ammii haiN`) | You can introduce your family respectfully | family |
| 005 | Yes, no and questions | `jii haaN`, `jii nahiiN`, `nahiiN` before the verb; `kyaa` at the start for yes/no questions | You can ask and answer yes/no questions | uk-life |
| 006 | What's your name? Where are you from? | Question words stay in place: `aapkaa naam kyaa hai?`, `aap kahaaN se haiN?` (chunks); `aunty` / `uncle` for elders you don't call by name | You can exchange names and say where you're from | uk-life |
| 007 | Happy, tired, busy | Describing words with `honaa`; invariable adjectives (`xush, udaas, biimaar, pareshaan, masruuf`) | You can say how you and others feel | family |
| 008 | Thank you, sorry, goodbye | Set phrases and `jii` as a softener (`shukriyaa`, `maaf kiijiye`, `koii baat nahiiN`, `xudaa haafiz`, `phir milenge`) | You can thank, apologise and say goodbye politely | uk-life |
| 009 | Welcome, come in! | Recognising hospitality chunks unanalysed (`aaiye`, `baiThiye`, `chaae lenge?`) | You can respond when you're welcomed into someone's home | family |
| 010 | Review: Unit 1 | Mixed review; dialogue: visiting your partner's family | You can hold a two-minute greeting conversation | family |

**Planned for lesson 006** (decided in Phase 3c, D26): `aunty` (f, آنٹی) and `uncle` (m, انکل) as `loanword` + `invariable` nouns: the same form for one, several, and before postpositions, so no `plural` / `oblique_pl`. Notes to include: you don't call an elder by their first name, so community elders, friends' parents and older neighbours are `aunty` / `uncle`; `aunty jii` and `uncle jii` add extra respect; `uncle log` is a casual "the uncles", meaning the older men as a group (`log` is taught properly in lesson 018, so here it is a note, not a sentence). They take the respectful `haiN` like any elder.

**Recurring cast** (introduced in lessons 1–5; reuse these names, roles and genders in later dialogues):

| Name | Who | Gender | Notes |
|---|---|---|---|
| — | your partner's mum and dad | f / m | always addressed with `aap` |
| — | your partner's grandmother | f | calls you `beTaa`, says `tum` to you, `tuu` to Zain |
| `sanaa` | your partner's younger sister | f | `tum`; friends with Aisha |
| `bilaal` | your partner's cousin, about your age | m | `tum` |
| `zain` | your partner's nephew, six | m | |
| `aaishaa` | your neighbour, a doctor | f | |
| `imraan` | Aisha's husband, a doctor | m | Aisha speaks of him with `haiN` |

The partner never speaks in a dialogue: their gender isn't known, and their lines would depend on it.

## Unit 2 — Things and people: nouns, gender and plurals · A1

**Can-do:** know that every noun is masculine or feminine, make plurals, count to ten, talk about food at home.
**Vocab themes:** home, kitchen and food, people, numbers 1–10.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 011 | Boy and girl: every noun has a gender | Masculine/feminine; the `-aa` (m) / `-ii` (f) tendency. **Unlocks `gender`** | You can tell masculine from feminine nouns | family |
| 012 | One boy, two boys | Marked masculine nouns: `laRkaa → laRke`, `kamraa → kamre` | You can make plurals of `-aa` masculine nouns | family |
| 013 | Houses, days and friends | Unmarked masculine nouns don't change: `ghar, din, dost`; the trap `aadmii` (m) | You can use common masculine nouns in the plural | uk-life |
| 014 | Girls, books and things | Feminine plurals: `-ii → -iyaaN`, otherwise `-eN` (`kitaabeN, baateN`) | You can make feminine plurals | family |
| 015 | Gender surprises | Feminine without `-ii` (`kitaab, chaae, baat, raat`), masculine with `-ii` (`paanii, aadmii, dahii`), English loanwords (`bus` f, `phone` m) | You can handle nouns whose gender doesn't follow the ending | uk-life |
| 016 | One to ten | Numbers 1–10 + plural nouns (`do kamre, tiin laRkiyaaN`) | You can count people and things | uk-life |
| 017 | There is, there are | `yahaaN / wahaaN … hai / haiN` for "there is"; `kitne / kitnii?` as chunks | You can say what's here and ask how many | uk-life |
| 018 | What's for dinner? | Mass nouns and always-plural nouns (`chaawal` m pl, `log` m pl) | You can talk about the food on the table | family |
| 019 | Some, many, all | `kuchh`, `bahut`, `sab`, `thoRaa`, `koii` with nouns | You can talk about quantities | family |
| 020 | Review: Unit 2 | Mixed review; dialogue: helping in the kitchen | You can describe a family meal | family |

## Unit 3 — Whose is it? Possession with kaa / kii / ke · A1

**Can-do:** say whose things and relatives are, name the whole extended family, say what you have.
**Vocab themes:** kinship (both sides of the family), personal belongings, body (light).

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 021 | My house, my book | `meraa / merii / mere` agree with the thing owned, not the owner | You can say "my" correctly with any noun | family |
| 022 | Your ×3 | `teraa`, `tumhaaraa`, `aapkaa` matching the three "you"s | You can say "your" at the right respect level | family |
| 023 | His, her, our, their | `uskaa / iskaa` (no he/she difference!), `hamaaraa`, `unkaa` (also respectful "his/her") | You can talk about other people's things and family | family |
| 024 | Ahmad's brother | Noun + `kaa / kii / ke` + noun: `ahmad kaa bhaaii`, `saarah kii behen` | You can link any two nouns with "'s" | family |
| 025 | Dad's side, Mum's side | Kinship terms practised with `kaa / kii / ke` (`chaachaa, phuuphii, maamuuN, xaalaa, daadaa, naanii`) | You can name your relatives on both sides of the family | family |
| 026 | Respect in possession | Respect plural with possessives: `mere abbuu`, `unke waalid` | You can talk respectfully about elders | family |
| 027 | I have a car | Possession of things: `mere paas … hai` | You can say what you have and don't have | uk-life |
| 028 | I have two brothers | Kinship and body possession: `meraa ek bhaaii hai`, `mere do bacche haiN` (no `paas`) | You can describe the size of your family | family |
| 029 | Whose phone is this? | `kiskaa / kiskii / kiske` | You can ask whose something is | uk-life |
| 030 | Review: Unit 3 | Mixed review; dialogue: looking at a family photo album | You can explain your family tree | family |

## Unit 4 — In, on, from, to: postpositions and the oblique · A1

**Can-do:** say where things and people are, where you're from and going, travel around town.
**Vocab themes:** rooms and furniture, places in town, transport, times of day.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 031 | In the house, on the table | `meN` and `par` after unmarked nouns (`ghar meN, mez par`) | You can say where things are | family |
| 032 | In the room: the oblique | Marked masculine nouns change before postpositions: `kamraa → kamre meN`. **Unlocks `oblique`** | You can use `-aa` nouns after "in/on" | family |
| 033 | In the shops: oblique plural | Plural `-oN`: `dukaanoN meN`, `laRkoN ke saath` | You can use plurals after postpositions | uk-life |
| 034 | With me, from him | Pronoun forms before postpositions: `mujh se, us par, un ke saath` | You can use pronouns after postpositions | family |
| 035 | From London, by bus | `se` = from / by (transport) / with (instrument) | You can say where you came from and how you travelled | uk-life |
| 036 | From morning till evening | `tak` and `se … tak`; times of day (`subah, dopahar, shaam, raat`) | You can talk about ranges of time and distance | uk-life |
| 037 | To me, for you | `ko` for recipients; contracted forms `mujhe, tujhe, use, hameN, tumheN, unheN` | You can say who something is for or given to | family |
| 038 | Next to, behind, in front of | Compound postpositions: `ke saath, ke paas, ke liye, ke baad, se pehle, ke andar, ke baahar, ke saamne, ke piichhe` | You can describe where things are around the house | family |
| 039 | At my brother's house | Possessives go oblique too: `mere bhaaii ke ghar meN` | You can say where relatives live | family |
| 040 | Review: Unit 4 | Mixed review; dialogue: getting the bus to a relative's house | You can give and follow simple location information | uk-life |

## Unit 5 — Describing and asking · A2

**Can-do:** describe people, places and weather; ask every kind of question; compare things; shop.
**Vocab themes:** adjectives (size, colour, character), weather, shopping, prices.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 041 | Good boy, good girl | Variable adjectives: `acchaa / acchii / acche` agree like `meraa`. **Unlocks `agreement`** | You can describe people and things | family |
| 042 | Adjectives that never change | Invariable adjectives: `xuubsuurat, laal, saaf, mushkil, aasaan` | You can tell which adjectives agree and which don't | uk-life |
| 043 | In a big house | Adjectives in the oblique: `baRe ghar meN`, `acche laRke ko` | You can use adjectives after postpositions | family |
| 044 | This one, that one | `ye / wo` → `is / us` (sg) and `in / un` (pl) before nouns and postpositions | You can point things out ("in this shop", "from those people") | uk-life |
| 045 | Who, where, when, why, how | `kaun, kahaaN, kab, kyoN, kaise` and where they go in the sentence | You can ask open questions | uk-life |
| 046 | How much is this? | Agreeing question words: `kitnaa / kitnii / kitne`, `kaunsaa`, `kaisaa`; prices (`ye kitne kaa hai?`) | You can ask prices and choose between items | uk-life |
| 047 | Bigger, the best | Comparison: `X Y se baRaa hai`; superlative `sab se acchaa` | You can compare people and things | family |
| 048 | It's cold today! | Weather: noun vs adjective (`ThanD hai` vs `paanii ThanDaa hai`), `baarish, dhuup, garmii` | You can talk about the weather | uk-life |
| 049 | Very, quite, a bit | Intensifiers and softeners: `bahut, kaafii, zaraa, thoRaa, bilkul` | You can make descriptions stronger or softer | media |
| 050 | Review: Unit 5 | Mixed review; dialogue: shopping for a gift at a market stall | You can shop and describe what you want | uk-life |

## Unit 6 — What I usually do: present habitual · A2

**Can-do:** talk about your routine, work, habits and what people like to watch and listen to.
**Vocab themes:** daily-routine verbs, `noun + karnaa` verbs, work, clock times, media verbs.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 051 | I eat, I drink | Infinitive `-naa` → stem; habitual `stem + taa/tii/te + honaa` (`maiN khaataa huuN`) | You can say what you usually eat and drink | family |
| 052 | Everyone's routine | Full habitual table; women's `ham … te haiN` in casual speech | You can say what anyone usually does | family |
| 053 | I don't eat meat | Negative habitual drops the auxiliary: `maiN gosht nahiiN khaataa` | You can say what you don't do | uk-life |
| 054 | Where do you work? | `noun + karnaa` verbs (`kaam karnaa, baat karnaa, intazaar karnaa`); routine questions | You can talk about work | uk-life |
| 055 | At seven o'clock | Clock times with `baje`, `saaRhe`, `sawaa`, `paune`; numbers 11–20 | You can tell the time and say when you do things | uk-life |
| 056 | Always, sometimes, never | Frequency: `hameshaa, aksar, kabhii kabhii, kabhii nahiiN, har roz` | You can say how often you do things | family |
| 057 | My own: apnaa | `apnaa` when the subject owns it: `maiN apne bhaaii se baat kartaa huuN` | You can talk about your own family without sounding odd | family |
| 058 | Films, dramas and songs | Media verbs (`dekhnaa, sunnaa, gaanaa, paRhnaa`) in the habitual | You can talk about what you watch and listen to | media |
| 059 | I know him | `ko` with specific/animate objects: `maiN uskii behen ko jaantaa huuN` | You can talk about people you know and visit | family |
| 060 | Review: Unit 6 | Mixed review; dialogue: a new colleague asks about your week | You can describe a typical week | uk-life |

## Unit 7 — What's happening now (and what was): present progressive and thaa · A2

**Can-do:** say what's going on right now, on the phone, on TV and in the weather; talk about days and dates; say where and how you were.
**Vocab themes:** phone calls, days of the week, time words, activities, TV.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 061 | I'm eating | `stem + rahaa / rahii / rahe + honaa` | You can say what you're doing right now | family |
| 062 | What are you doing? | Negatives and questions in the progressive (`kyaa kar rahe ho?`, `kuchh nahiiN`) | You can ask what people are up to | family |
| 063 | Usually vs right now | Habitual vs progressive; `aajkal` + progressive for ongoing situations; progressive for plans (`maiN kal aa rahaa huuN`) | You can choose between "I do" and "I'm doing" | uk-life |
| 064 | I'm on my way! | Phone-call language: `maiN raaste meN huuN`, `aa rahii huuN`, `awaaz nahiiN aa rahii` | You can handle a quick family phone call | family |
| 065 | It's raining | Describing a scene: `baarish ho rahii hai`, `bacche khel rahe haiN` | You can describe what's happening around you | uk-life |
| 066 | What's on TV? | `tv par kyaa aa rahaa hai?`; talking about a drama while watching it | You can chat about what's on screen | media |
| 067 | Today, yesterday, tomorrow | `aaj`, `kal` (both yesterday *and* tomorrow), `parsoN`, `abhii`, `aajkal` | You can place events in time | family |
| 068 | Monday to Sunday | Days of the week; `ko` with days (`itwaar ko`), `hafte meN do baar` | You can arrange a day to meet | uk-life |
| 069 | I was ill: thaa, thii, the | `thaa / thii / the / thiiN`, the past of `honaa`; `kal maiN ghar par thaa` | You can say where and how you and others were | family |
| 070 | Review: Unit 7 | Mixed review; dialogue: a busy Saturday phone call ("where were you?") | You can narrate what everyone is doing and where they were | family |

## Unit 8 — Please, come, sit, eat: imperatives and requests · A2

**Can-do:** ask, offer, instruct and refuse at the right politeness level; follow directions and a GP's instructions.
**Vocab themes:** movement verbs, directions, hospitality, body parts, health basics.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 071 | Come, sit, eat (tum) | `tum`-imperative: stem + `-o` (`aao, baiTho, khaao`) | You can tell a friend or sibling what to do | family |
| 072 | Please come in (aap) | `aap`-imperative: `-iye`; irregulars `liijiye, diijiye, kiijiye, piijiye` | You can make polite requests to elders | family |
| 073 | tuu-commands: love or rudeness? | Bare stem (`aa, jaa, sun`): to small children, in songs and prayers, and why not to strangers | You can recognise intimate and rude commands | media |
| 074 | Don't go! | Negative commands: `mat` (direct) and `na` (polite): `mat jaao`, `fikr na kiijiye` | You can tell people not to do things | family |
| 075 | Could you just… | Softening: `zaraa`, `meharbaanii karke`, `please`; infinitive as a polite instruction (`kal zaruur aanaa`) | You can make requests sound gentle | uk-life |
| 076 | Have some more! | Hospitality: offering and refusing (`aur liijiye`, `bas, shukriyaa`, `takalluf na kiijiye`) | You can accept and refuse food politely | family |
| 077 | Go straight, turn left | Directions: `siidhe jaaiye, baaeN / daaeN muRiye, signal se` | You can ask for and give directions | uk-life |
| 078 | At the GP | Body parts + instructions (`munh kholiye, lambii saans liijiye`) | You can follow a doctor's instructions | uk-life |
| 079 | Listen! Look! Let's go! | Commands as discourse markers: `suno, dekho, chalo, chhoRo` | You can recognise everyday "filler" commands in films and talk | media |
| 080 | Review: Unit 8 | Mixed review; dialogue: hosting guests for dinner | You can host and be hosted | family |

## Unit 9 — Plans and promises: the future · A2→B1

**Can-do:** make plans, invitations and promises; guess; talk about weddings and holidays; use numbers up to 100.
**Vocab themes:** plans, celebrations, travel, numbers 21–100, forecasts.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 081 | I will go | Future: `-uungaa / -egaa / -enge / -oge` + `-gaa / -gii / -ge` | You can say what you will do | uk-life |
| 082 | I'll give, I'll take | Common futures: `hogaa, luungaa, duungaa, jaauungaa, aauungaa` | You can use the most common verbs in the future | family |
| 083 | He must be at home | Presumptive `hogaa`: `wo ghar par hogaa` (guessing) | You can make guesses | family |
| 084 | Next week, this summer | Future time words: `agle hafte, is garmii meN, chhuTTiyoN meN` | You can talk about your plans | uk-life |
| 085 | Will you have tea? | Polite offers and invitations with the future (`chaae pienge?`, `aap aaenge?`) | You can invite and offer | family |
| 086 | When's the wedding? | Wedding vocab and promises (`shaadii kab hogii?`, `maiN zaruur aauungii`) | You can talk about an upcoming family event | family |
| 087 | Twenty to fifty | Numbers 21–50 (irregular!) and money (`biis pound`) | You can handle prices and ages | uk-life |
| 088 | Fifty-one to a hundred | Numbers 51–100; `sau, hazaar` | You can understand any price or age | uk-life |
| 089 | Rain tomorrow | Weather forecasts and lyric futures (`phir milenge`, `kal baarish hogii`) | You can talk about what will happen | media |
| 090 | Review: Unit 9 | Mixed review; dialogue: planning Eid with the family | You can plan an event with someone | family |

## Unit 10 — I like, I need, I know: "mujhe" constructions · B1

**Can-do:** say what you like, need, know, must do and feel; describe symptoms.
**Vocab themes:** likes and dislikes, needs, skills, languages, feelings, illness.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 091 | I like it: mujhe pasand hai | Dative subject: `mujhe` + thing + `pasand hai`; agreement goes to the thing | You can say what you like and dislike | media |
| 092 | I need: mujhe chaahiye | `mujhe … chaahiye` (needs and wants; agreement with plural) | You can ask for what you need in a shop | uk-life |
| 093 | I can speak a little Urdu | `mujhe … aataa / aatii hai` for skills and languages | You can say what you know how to do | uk-life |
| 094 | I don't know | `mujhe pataa hai / maaluum hai`; `mujhe nahiiN pataa` | You can say what you know or don't know | uk-life |
| 095 | I'm scared, I'm hungry | Feelings with `mujhe`: `Dar lagtaa hai, bhuukh lagii hai` (chunk), `xushii hai, afsos hai` | You can express feelings and physical states | family |
| 096 | I have to go | `mujhe jaanaa hai` (obligation/plan) | You can say what you have to do | uk-life |
| 097 | You should rest | `chaahiye` + infinitive: `aapko aaraam karnaa chaahiye` | You can give advice | family |
| 098 | I've got a fever | Symptoms: `mujhe buxaar hai`, `mere sar meN dard hai`, `zukaam` | You can describe symptoms at the GP | uk-life |
| 099 | I want vs I need | `maiN … chaahtaa huuN` vs `mujhe … chaahiye`; `dil chaahtaa hai` | You can say what you want to do | media |
| 100 | Review: Unit 10 | Mixed review; dialogue: GP appointment (or a pharmacy visit) | You can explain a health problem | uk-life |

## Unit 11 — What happened I: past of intransitive verbs · B1

**Can-do:** say where you went, what happened, what life used to be like.
**Vocab themes:** travel and arrival, events, childhood, emigration and visiting Pakistan.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 101 | I went, she came | Perfective of intransitive verbs agrees with the subject: `gayaa / gayii / gaye` (builds on `thaa` from 069). **Unlocks `perfective`** | You can say where people went | family |
| 102 | Irregular pasts | `jaanaa → gayaa`, `honaa → huaa`, `aanaa → aayaa` | You can use the most common irregular intransitive pasts | uk-life |
| 103 | Arrived, woke up, slept | More intransitives: `pahunchnaa, uThnaa, sonaa → soyaa, rehnaa → rahaa, baiThnaa` | You can describe your journey and your night | uk-life |
| 104 | She didn't come | Negative and question forms in the past (`wo nahiiN aayii`, `kab pahunche?`) | You can ask and answer about past events | uk-life |
| 105 | When I was little | Past habitual `-taa thaa`: "used to" | You can talk about your childhood | family |
| 106 | I was sleeping when… | Past progressive `rahaa thaa` | You can set the scene for a story | family |
| 107 | What happened? | `kyaa huaa?`; everyday mishaps (`der ho gayii` as chunk, `bus nikal gayii`) | You can explain why you were late | uk-life |
| 108 | Has come, had come | Present perfect `aayaa hai` and past perfect `aayaa thaa` | You can say whether something has just happened or had already happened | uk-life |
| 109 | Our trip to Pakistan | Narrating a past trip with intransitives (`ham laahaur gaye, wahaaN rahe`) | You can tell someone about a trip | family |
| 110 | Review: Unit 11 | Mixed review; dialogue: Nani talks about moving to England | You can follow and retell a short life story | family |

## Unit 12 — What happened II: transitive verbs and ne · B1

**Can-do:** say what you ate, bought, watched, said and did, with correct `ne` and agreement.
**Vocab themes:** transitive daily verbs, shopping, media, news and conversation.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 111 | Why "ne"? | Transitive verbs in the past mark the subject with `ne`: `maiN ne khaanaa khaayaa` | You can say what you did with simple verbs | family |
| 112 | The verb follows the object | Agreement with the object: `maiN ne roTii khaaii`, `us ne kitaabeN xariidiiN` | You can make the verb agree in `ne` sentences | uk-life |
| 113 | maiN ne, unhoN ne | `ne` with pronouns: `maiN ne, tum ne, us ne, ham ne, aap ne, unhoN ne, inhoN ne` | You can use `ne` with every pronoun | family |
| 114 | Did, gave, took, drank | Irregular perfectives: `kiyaa, diyaa, liyaa, piyaa` (+ `kii, dii, lii, pii`) | You can use the most common irregular pasts | family |
| 115 | I saw my sister | Object + `ko` → verb goes default masculine singular: `maiN ne apnii behen ko dekhaa` | You can talk about people you saw or called | family |
| 116 | Verbs that break the rule | No `ne`: `laanaa`, `bhuulnaa`, `bolnaa` (usually); optional with `samajhnaa`. **Unlocks `ne`** | You can avoid the classic `ne` traps | uk-life |
| 117 | I watched a film last night | Past transitive with media vocab (`kal maiN ne ek film dekhii`) | You can say what you watched and what you thought | media |
| 118 | Did you hear? | `aap ne sunaa?`, `us ne kahaa ke…` (direct speech chunk) | You can pass on family news | family |
| 119 | A day in the past | Mixing intransitive and transitive pasts in one story | You can tell how your day went | uk-life |
| 120 | Review: Unit 12 | Mixed review; dialogue: what everyone did at the dawat | You can retell an event with correct `ne` | family |

## Unit 13 — Can, manage, already, seem: saknaa, paanaa, chuknaa, lagnaa · B1+

**Can-do:** express ability, managing (or not), completion, impressions, time taken, permission and obligation.
**Vocab themes:** abilities, transport and timing, opinions, emotions.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 121 | I can speak Urdu | `stem + saknaa` (never with `ne`) | You can say what you can and can't do | uk-life |
| 122 | Could you…? | `saknaa` in past and negative; polite requests `kyaa aap … sakte haiN?` | You can ask for help politely | uk-life |
| 123 | I couldn't sleep | `paanaa`: manage to (`maiN so nahiiN paayaa`) | You can say you didn't manage something | family |
| 124 | I've already eaten | `chuknaa`: already done (`maiN khaa chukaa huuN`) | You can say something is already done | family |
| 125 | I think… | `lagnaa` = seem: `mujhe lagtaa hai ke…`, `acchaa lagtaa hai` | You can give opinions and impressions | media |
| 126 | How long does it take? | `lagnaa` = take time / cost: `kitnaa waqt lagegaa?` | You can ask how long a journey takes | uk-life |
| 127 | She started crying | `oblique infinitive + lagnaa` = begin (`wo rone lagii`) | You can describe sudden reactions | media |
| 128 | Let me go! | `denaa` = let: `mujhe jaane do`; `ne`-free permission | You can ask for and give permission | family |
| 129 | I had to go | `paRnaa` and `honaa` obligation in all tenses (`mujhe jaanaa paRaa`) | You can say what you had to do | uk-life |
| 130 | Review: Unit 13 | Mixed review; dialogue: arranging a lift to the airport | You can negotiate plans and abilities | uk-life |

## Unit 14 — Compound verbs: le lenaa, de denaa, ho jaanaa · B1+

**Can-do:** sound natural with completion and direction verbs, understand dramatic speech, get things done.
**Vocab themes:** household tasks, events and preparations, emotional reactions.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 131 | What's a compound verb? | Main stem + light verb (`khaa lo, kar do`): flavour, not meaning | You can recognise compound verbs | family |
| 132 | It got done: jaanaa | `ho jaanaa, so jaanaa, aa jaanaa, samajh jaanaa` (change of state) | You can say things became or got done | family |
| 133 | For myself: lenaa | `kar lenaa, le lenaa, samajh lenaa, khaa lenaa` | You can say you did something for yourself | uk-life |
| 134 | For others: denaa | `de denaa, bataa denaa, rakh denaa, chhoR denaa` | You can say you did something for someone else | family |
| 135 | Compounds and ne | The light verb decides `ne`: `maiN ne kar liyaa` vs `wo so gayaa` | You can use compound verbs in the past | uk-life |
| 136 | She burst into tears | Dramatic light verbs: `ro paRnaa, bol uThnaa, kar baiThnaa` | You can follow emotional scenes in dramas | media |
| 137 | When not to use them | Negatives and ongoing actions avoid compounds (`nahiiN kiyaa`, not `nahiiN kar liyaa`) | You can choose simple vs compound | uk-life |
| 138 | Could you just tell me? | Requests with compounds: `zaraa bataa diijiye`, `kar diijiye` | You can make natural everyday requests | uk-life |
| 139 | Wedding preparations | Narrating preparations with compounds | You can describe getting ready for an event | family |
| 140 | Review: Unit 14 | Mixed review; dialogue: the day before a mehndii | You can coordinate tasks with family | family |

## Unit 15 — Then what happened? Joining actions and telling stories · B1+

**Can-do:** sequence actions, tell a story or film plot, give reasons and contrasts.
**Vocab themes:** storytelling, plot vocabulary, cause and effect, family history.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 141 | Having eaten, I left | Conjunctive participle `stem + kar`: `khaa kar, ghar jaa kar` | You can join two actions | family |
| 142 | karke and milkar | `karke` for `karnaa`; `milkar` = together; `ruk kar`, `soch kar` | You can use the commonest participle chunks | uk-life |
| 143 | First, then, finally | Sequencers: `pehle, phir, uske baad, aaxir meN` | You can structure a story | family |
| 144 | What's the film about? | Retelling a plot in the present (`hero … se miltaa hai`) | You can summarise a film or drama | media |
| 145 | When I was young | `jab … tab / to` clauses | You can say when things happened | family |
| 146 | As soon as I got home | `-te hii` (as soon as), `-te -te` (while, gradually) | You can describe timing precisely | uk-life |
| 147 | Because… so… | `kyonke, isliye, is wajah se` | You can give reasons | uk-life |
| 148 | But still… | `lekin, magar, phir bhii, balke` | You can contrast ideas | media |
| 149 | Grandad's story | Narrating family history with all past forms | You can tell a family story | family |
| 150 | Review: Unit 15 | Mixed review; dialogue: telling your partner's cousin how you met | You can tell a three-minute story | family |

## Unit 16 — If, maybe, I wish: subjunctive and conditionals · B1+ → B2

**Can-do:** make suggestions, express wishes and blessings, talk about possibilities and hypotheticals.
**Vocab themes:** plans and decisions, blessings and duaa, advice, hopes.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 151 | Shall I come? | Subjunctive forms: `maiN aauuN?`, `wo jaae`, `ham chaleN` | You can ask "shall I…?" | family |
| 152 | Let's go! | Suggestions: `chaleN?`, `kyoN na ham…`, `chaliye` | You can suggest doing something | uk-life |
| 153 | I want you to come | `chaahnaa ke` + subjunctive: `maiN chaahtaa huuN ke tum aao` | You can say what you want others to do | family |
| 154 | Maybe… | `shaayad` + subjunctive; `ho saktaa hai ke…` | You can talk about possibilities | uk-life |
| 155 | If it rains… | Real conditions: `agar … to` with future/subjunctive | You can make plans that depend on something | uk-life |
| 156 | If I had money… | Unreal conditions: `agar … hotaa to … hotaa` | You can talk about hypotheticals and regrets | media |
| 157 | May God keep you happy | Blessings and wishes: `xudaa aapko xush rakhe`, Eid / wedding / new-baby greetings | You can give the right blessing at the right moment | family |
| 158 | I wish… | `kaash` + past/subjunctive in songs and talk | You can express wishes and longing | media |
| 159 | It would be better if… | Polite advice: `behtar hai ke aap…`, `agar maiN aapkii jagah hotaa` | You can give tactful advice | uk-life |
| 160 | Review: Unit 16 | Mixed review; dialogue: deciding where to go for a family holiday | You can discuss options and decide | family |

## Unit 17 — The one who…: relative clauses and reported speech · low B2

**Can-do:** describe people and things with clauses, generalise, pass on what people said and asked.
**Vocab themes:** people descriptions, gossip and news, explaining lyrics, admin problems.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 161 | The boy who came | `jo … wo`: `jo laRkaa aayaa thaa, wo meraa bhaaii hai` | You can identify people with "who/which" | family |
| 162 | The house where… | Oblique relatives: `jis, jin, jinhoN ne` | You can use "whose/in which/who (did)" | uk-life |
| 163 | Where…there, as…so | `jahaaN … wahaaN`, `jab … tab`, `jaisaa … waisaa` | You can link places, times and manners | media |
| 164 | Whoever, whenever | `jo bhii, jab bhii, jahaaN bhii, jaise bhii` | You can generalise | uk-life |
| 165 | She said that she'd come | Reported speech keeps the original words: `us ne kahaa ke maiN aauungii` | You can pass on what someone said | family |
| 166 | He asked if… | Reported questions and commands: `puuchhaa ke…`, `kahaa ke ruko` | You can report questions and requests | family |
| 167 | Have you heard about…? | Family news and gossip with relatives and reporting | You can share and react to news | family |
| 168 | What does this lyric mean? | Explaining a song or scene using relatives and reporting | You can explain a lyric or scene | media |
| 169 | The letter that came | Explaining an admin problem (council, landlord, GP) | You can explain a problem clearly | uk-life |
| 170 | Review: Unit 17 | Mixed review; dialogue: a family WhatsApp drama, retold | You can relay a complicated story | family |

## Unit 18 — Getting things done and sounding natural · low B2

**Can-do:** have things done, understand passives, code-switch naturally, use particles, fillers and idioms.
**Vocab themes:** services and repairs, English-in-Urdu verbs, particles, idioms, complaints.

| # | Title | Grammar point | Can-do | Context |
|---|---|---|---|---|
| 171 | I had the car fixed | Causatives: `karnaa → karwaanaa`, `banaanaa → banwaanaa` | You can say you had something done | uk-life |
| 172 | It broke vs I broke it | Verb pairs: `khulnaa / kholnaa`, `TuuTnaa / toRnaa`, `bannaa / banaanaa` | You can choose between "it happened" and "I did it" | family |
| 173 | It is said… | Passive: perfective + `jaanaa` (`ye kaam kiyaa jaataa hai`); where you'll meet it | You can understand passive sentences in news and signs | media |
| 174 | "Miss karnaa", "book karnaa" | Code-switching: English verbs + `karnaa / honaa`, English nouns in Urdu grammar | You can mix English in naturally, the way UK speakers do | uk-life |
| 175 | yaar, matlab, acchaa… | Fillers and softeners: `yaar, matlab, acchaa, na, to` | You can sound relaxed and natural | uk-life |
| 176 | Only, also, as for | Emphatic particles `hii, bhii, to` in depth | You can add emphasis like a native speaker | family |
| 177 | Chaae-shaae and slowly-slowly | Echo words and reduplication (`chaae-shaae, dhiire dhiire, kabhii kabhii`) | You can use and understand echo words | family |
| 178 | Idioms you'll hear | Common idioms and proverbs from films and family talk | You can understand everyday idioms | media |
| 179 | Making a complaint politely | Extended conversation: polite complaint and negotiation | You can resolve a problem politely in Urdu | uk-life |
| 180 | Final review | Mixed review across the course; long dialogue | You can hold a 10-minute conversation on familiar topics | family |

---

## Notes for content generation

- **One unit per pass** (≤ 10 lessons, ≤ 80 items). Validate and hand-check genders, plurals, obliques, perfectives and `takes_ne`, then continue.
- **Chunks before grammar.** Some phrases appear unanalysed before their grammar lesson (e.g. `aaiye, baiThiye` in 009 before imperatives in Unit 8; `mujhe bhuukh lagii hai` in 095 before perfectives in Unit 11). Their exercises test meaning only, never form. The coverage checker's allowlist marks them as chunks.
- **Hindi–Urdu**: in `media` lessons, words with a common Hindi film alternative get `hindi_variant` (e.g. `shukriyaa` / `dhanyawaad`, `zindagii` / `jiiwan`, `muhabbat` / `prem`).
- **Register**: target everyday spoken Pakistani Urdu. Persian/Arabic-heavy words (`waalid`, `taalluq`) are marked `formal` and paired with the everyday word.
- **Dialogues** rotate through the three contexts and reuse names consistently (a small recurring cast, defined in Unit 1).
