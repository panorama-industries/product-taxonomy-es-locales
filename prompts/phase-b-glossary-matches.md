Fix es-AR text for keys whose base contains a glossary term.

Read AGENTS.md and overrides/es-AR/glossary.yml first. Scope flags: <FLAGS>

Loop until pending returns 0 rows or 10 batches done:
  pnpm --silent run pending <FLAGS> --match-glossary --dedupe --limit 400 --out /tmp/batch.tsv
  write /tmp/changes.tsv (only rows that change)
  pnpm --silent run apply /tmp/batch.tsv /tmp/changes.tsv

A glossary match is a hint, not a rule: keep base when the word is used in another sense, is part of a brand/model name, or `note` says so. Rewrite the whole text naturally (gender/number agreement), not a word swap.

Then: pnpm --silent run check, commit, open a PR titled "es-AR glossary matches: <scope>". No narration. If pending still has rows after 10 batches, say so in the PR description.
