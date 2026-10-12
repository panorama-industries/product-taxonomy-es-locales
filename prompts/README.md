# Translation sessions

Run phases in order. One session per row; sessions in the same phase can run in parallel (disjoint scopes, no merge conflicts) except Phase A. Merge each PR before starting the next phase.

| Phase | Prompt | Model | Sessions |
|---|---|---|---|
| A. Glossary | [phase-a-glossary.md](phase-a-glossary.md) | Opus | 3, sequential: words `0`, `8000`, `16000` |
| — | Review `overrides/es-AR/glossary.yml` yourself | — | — |
| B. Glossary matches | [phase-b-glossary-matches.md](phase-b-glossary-matches.md) | Sonnet | Scopes below |
| C1. Full pass: categories + return reasons | [phase-c-categories.md](phase-c-categories.md) | Sonnet | 4 scopes below |
| C2. Bulk-mark the rest | [phase-c-bulk.md](phase-c-bulk.md) | none (command) | — |

Check how many keys a scope has before splitting:

```bash
pnpm --silent pending --type values --match-glossary --dedupe --limit 0 --format keys | wc -l
```

## Phase B scopes

Merge small scopes into one session when counts are low (< ~2,000 rows).

```
--type categories,return_reasons
--type attributes
--type values --key '^[0-9a-c]'
--type values --key '^[d-l]'
--type values --key '^[m-r]'
--type values --key '^[s-z]'
```

## Phase C1 scopes (~3,500–4,600 keys each, no overlap)

```
--type categories --key '^(aa|ae|ap|bi|bt|bu|co)(-|$)'
--type categories --key '^(el|fb|fr|gc|ha)(-|$)'
--type categories --key '^(hb|hg|lb|ma|me|na|os)(-|$)'
--type categories,return_reasons --key '^(pa|rc|se|sg|so|tg|vp)(-|$)|^[a-z_]{3,}$'
```

The last scope's `^[a-z_]{3,}$` matches return reason keys (no dashes, 3+ chars; category roots are 2 chars).
