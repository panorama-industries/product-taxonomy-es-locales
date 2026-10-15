QA: find es-AR fixes that were skipped.

Read AGENTS.md and overrides/es-AR/glossary.yml first.

Loop until pending returns 0 rows or 10 batches done:
  pnpm --silent run pending --glossary-kept --status reviewed --dedupe --limit 400 --out /tmp/batch.tsv
  write /tmp/changes.tsv (only rows that need an override)
  pnpm --silent run apply /tmp/batch.tsv /tmp/changes.tsv

Every row has a reviewed key whose current text (override if any, else base) still contains a glossary term. Check each one against the term's `note`: keep base only for another meaning, a brand/model name, or an exception the note lists. Otherwise write the es-AR text.

Rows you keep stay in this list on purpose. If a keep is common (e.g. "malla" meaning mesh), add the exception to that term's `note` in glossary.yml so future sessions skip it faster.

Then: pnpm --silent run check, commit, open a PR titled "es-AR QA: glossary kept". No narration.
