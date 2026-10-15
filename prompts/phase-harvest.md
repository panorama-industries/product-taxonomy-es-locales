Turn word swaps made by reviewers into glossary terms, so a fix made in one batch reaches every key that uses the same word.

Read AGENTS.md and overrides/es-AR/glossary.yml first.

  pnpm --silent run harvest --out /tmp/harvest.tsv

Each row is a word (or phrase) some override replaced that other keys still contain. Columns: removed, replacements (count), swaps, residual keys, status, examples. Decide every row:
- Regional word choice (Spain-only, other or vulgar meaning in Argentina, false friend): add a glossary term with every inflection in `match`, `use`, and a `note` for senses to keep. Check usage with: pnpm --silent run pending --match '<word>' --status all --limit 20
- One-off fix (mistranslation of one key, context-specific wording, rewording, spelling variant): add it to overrides/es-AR/harvest-ignore.yml as `- match: ["<removed>"]` with a one-line `note`.

Repeat until `pnpm --silent run harvest --format count` prints 0. Commit, open a PR titled "es-AR harvest: glossary terms", and list each new term as `match → use (N residual keys)` in the PR description. No narration.

After the PR is reviewed and merged, review the new terms' matches (keys already reviewed are included):

  pnpm --silent run pending --glossary-kept --match '<regex of the new terms' match forms>' --dedupe --limit 400 --out /tmp/batch.tsv

then follow phase-qa-glossary-kept.md for those batches.
