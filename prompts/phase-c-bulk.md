# Bulk-mark remaining attributes and values

Run after Phases A and B are merged. Marks every pending attribute/value key with no glossary match as reviewed with base text unchanged: these keys were screened by the glossary, not read one by one. Keys still matching the glossary stay pending.

```bash
for t in attributes values; do
  pnpm --silent pending --type $t --exclude-glossary --limit 0 --format keys | pnpm --silent mark-reviewed --type $t -
done
pnpm --silent check
```

Later upstream bumps make changed keys stale again; review those with Phase B/C prompts (they only pick up pending keys).

Optional full pass instead: run phase-c-categories.md with `--type attributes` or `--type values --dedupe` scopes.
