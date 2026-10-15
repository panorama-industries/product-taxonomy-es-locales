# Bulk-mark remaining attributes and values

Run after every earlier phase is merged, including the harvest. Marks every pending attribute/value key with no glossary match as reviewed with base text unchanged: these keys were screened by the glossary, not read one by one. Keys still matching the glossary stay pending.

That is only safe when the glossary covers every word reviewers replaced, so `mark-reviewed` refuses while `pnpm run harvest` has open candidates. Run [phase-harvest.md](phase-harvest.md) first if `pnpm run check` reports any.

```bash
for t in attributes values; do
  pnpm --silent run pending --type $t --exclude-glossary --limit 0 --format keys | pnpm --silent run mark-reviewed --type $t -
done
pnpm --silent run check
```

Later upstream bumps make changed keys stale again; review those with Phase B/C prompts (they only pick up pending keys).

Optional full pass instead: run phase-c-categories.md with `--type attributes` or `--type values --dedupe` scopes.
