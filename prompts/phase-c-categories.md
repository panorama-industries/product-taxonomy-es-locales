Review es-AR text for every remaining key in scope.

Read AGENTS.md and overrides/es-AR/glossary.yml first. Scope flags: <FLAGS>

Loop until pending returns 0 rows or 10 batches done:
  pnpm --silent run pending <FLAGS> --limit 400 --out /tmp/batch.tsv
  write /tmp/changes.tsv (only rows that change; most batches change few or none)
  pnpm --silent run apply /tmp/batch.tsv /tmp/changes.tsv

Look for: Spain-only terms missing from the glossary, mistranslations vs en (false friends), breadcrumb consistency with parent/sibling categories (keys share prefixes: aa-1-13-8 is a child of aa-1-13). If you find a recurring term missing from the glossary, add it to glossary.yml.

Then: pnpm --silent run check, commit, open a PR titled "es-AR review: <scope>". No narration. If pending still has rows after 10 batches, say so in the PR description.
