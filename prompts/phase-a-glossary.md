Build the es-AR glossary from the base (es) vocabulary.

Read AGENTS.md first. Scope: words <OFFSET> to <OFFSET + 8000>.

Loop, 2000 words per chunk:
  pnpm --silent run vocab --offset <n> --limit 2000 --out /tmp/vocab.tsv
  read /tmp/vocab.tsv; append terms to overrides/es-AR/glossary.yml

Add a term only when the es word is not what Argentines use in e-commerce for that meaning (Spain-only words, words with another meaning or vulgar sense in Argentina). List every inflection found in the vocabulary in `match` (singular/plural, gender). `use` = es-AR word(s). `note` only for gender changes, ambiguity or exceptions (e.g. brand names that contain the word).
When unsure what a word means here, check with: pnpm --silent run pending --match '<word>' --status all --limit 20
Skip words already marked ✓ (the glossary has seed terms). Add missing inflections to the existing entry instead of a new one. Don't add neutral words that are fine in Argentina.

When done: keep glossary.yml valid YAML (run pnpm --silent run check), commit, open a PR titled "Glossary words <OFFSET>–<OFFSET + 8000>". No narration.
