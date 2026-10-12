# Translation sessions

**Recommended: one coordinator session.** Start an Opus session with [coordinator.md](coordinator.md). It runs every phase below with subagents (Opus for the glossary, Sonnet for batches; one fresh subagent per batch), commits each phase to one PR, and stops twice for you: to approve the glossary and to approve bulk-marking attributes/values.

The rest of this file is for running phases by hand, or one slice at a time.

## Manual phases

Run phases in order. One session per row; sessions in the same phase can run in parallel (disjoint scopes, no merge conflicts) except Phase A. Merge each PR before starting the next phase.

| Phase | Prompt | Model | Sessions |
|---|---|---|---|
| A. Glossary | [phase-a-glossary.md](phase-a-glossary.md) | Opus | 3, sequential: words `0`, `8000`, `16000` |
| — | Review `overrides/es-AR/glossary.yml` yourself | — | — |
| B. Glossary matches | [phase-b-glossary-matches.md](phase-b-glossary-matches.md) | Sonnet | Scopes below |
| QA after B | [phase-qa-glossary-kept.md](phase-qa-glossary-kept.md) | Sonnet | 1 |
| C1. Full pass: categories + return reasons | [phase-c-categories.md](phase-c-categories.md) | Sonnet | 4 scopes below |
| QA after C1 | [phase-qa-glossary-kept.md](phase-qa-glossary-kept.md) | Sonnet | 1 |
| C2. Bulk-mark the rest | [phase-c-bulk.md](phase-c-bulk.md) | none (command) | — |

The glossary starts with 53 seed terms (clothing, home, electronics, food). Phase A extends it.

## Models

Don't use Haiku. On a 300-row apparel test batch, Haiku changed 92 rows and Sonnet 144, using about the same number of tokens. Haiku skipped faldas→polleras (12/12 rows), calcetines→medias (14/15), tights mistranslated as "mallas" (swimsuit in AR), leggings→calzas, polos→chombas, and introduced a Spain-only term ("Ropa de estar por casa"). Skipped rows don't show in a PR diff.

`pnpm check` column **glossary kept** counts reviewed keys whose base still contains a glossary term without an override. Some are deliberate (other meaning, brand names); the QA session checks them.

Check how many keys a scope has before splitting:

```bash
pnpm --silent pending --type values --match-glossary --dedupe --limit 0 --format keys | wc -l
```

## Phase B scopes

With the seed glossary: ~1,500 deduped rows (categories 591, attributes 375, values 549, return reasons 9). Recount after Phase A and split further if a scope exceeds ~2,000 rows.

```
--type categories,return_reasons
--type attributes,values
```

## Phase C1 scopes (~3,500–4,600 keys each, no overlap)

```
--type categories --key '^(aa|ae|ap|bi|bt|bu|co)(-|$)'
--type categories --key '^(el|fb|fr|gc|ha)(-|$)'
--type categories --key '^(hb|hg|lb|ma|me|na|os)(-|$)'
--type categories,return_reasons --key '^(pa|rc|se|sg|so|tg|vp)(-|$)|^[a-z_]{3,}$'
```

The last scope's `^[a-z_]{3,}$` matches return reason keys (no dashes, 3+ chars; category roots are 2 chars).
