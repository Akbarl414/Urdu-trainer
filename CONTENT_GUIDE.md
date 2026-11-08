# Content guide (notes)

Working notes for writing lessons. The full guide comes in Phase 6 (BRIEF §11). The rules in `CLAUDE.md` and `PLAN.md` apply throughout.

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
