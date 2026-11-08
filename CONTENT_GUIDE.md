# Content guide (notes)

Working notes for writing lessons. The full guide comes in Phase 6 (BRIEF §11). The rules in `CLAUDE.md` and `PLAN.md` apply throughout.

## Practice sentences (PLAN D36)

Each lesson can list 6–8 `practice_sentences` for Sentence sprint and Listen & type. Keep them short (3–8 tiles, ideally 5 or fewer so Listen & type can use them), and use only Urdu taught up to and including that lesson. They never become SRS cards. List every other natural word order in `alt_orders`; a valid order missing from the list would be marked wrong. Add `learner_f` when the learner speaks about themselves with a gendered word. Don't repeat another practice sentence or a reorder exercise exactly: the validator rejects it.

## Distractor rule (PLAN D33)

Every wrong option must be **unambiguously wrong**. That means one of:

- wrong gender agreement (`ye meraa behen hai`)
- wrong person (`maiN Thiik haiN`)
- wrong meaning
- wrong word (the reply where a greeting is needed)

**Never mark a politeness or register variant as wrong.** The respectful plural `haiN` for an elder brother and `hai` for one's own mum are both acceptable.

This covers dialogue options, `multiple-choice` and `choose-form` options, `error-spot` sentences and typed answers. An `error-spot` sentence must contain a real error, not a less polite way of saying something.

Where the register choice matters, accept both and explain the difference after answering:

| Where | How to accept the variant | Where the difference is explained |
|---|---|---|
| `multiple-choice`, `choose-form` | `acceptIndexes` | `explanation` |
| Dialogue option | `"accept": true` | the option's `en` |
| `fill-blank`, `error-spot` | `altAnswers` | `explanation` |
| `translate`, `transform` | an extra entry in `answers` | `explanation` |

A question may still ask directly which word is the respectful one (`aap`), because then the other words have the wrong meaning for what was asked.
