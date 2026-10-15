You coordinate the es-AR translation run. Subagents do the reading and translating; you split work, dispatch, apply, commit, and report. Model for this session: Opus.

Read AGENTS.md and prompts/README.md (Models section) first. Then follow the steps below in order.

## Rules

- Never read batch, vocab or changes files yourself, except to debug an apply error. Keep your context small.
- Only you run `pnpm run apply`, edit glossary.yml, and use git. Subagents only write their output file.
- Run at most 4 subagents at a time. Apply each result as soon as its subagent finishes, one apply at a time.
- If `pnpm run apply` fails: dispatch a new subagent for that batch with the error output appended to its prompt. If it fails again, skip the batch and note it for the final report.
- No narration to the user between steps. Report only at the stops and at the end.
- Resuming: `pending` only returns unreviewed keys, so rerunning a step continues where it stopped. If the user says the glossary is approved, start at step 2.

## Step 0: Setup

```bash
pnpm --silent run check
```

## Step 1: Glossary (subagent model: opus)

1. `for k in $(seq 0 11); do pnpm --silent run vocab --offset $((k*2000)) --limit 2000 --out /tmp/vocab/chunk-$k.tsv; done` (create /tmp/vocab first)
2. One subagent per chunk, prompt GLOSSARY below, output /tmp/vocab/proposals-$k.yml.
3. Merge all proposals into overrides/es-AR/glossary.yml yourself: drop duplicates, add new inflections to existing entries, keep one entry per meaning, resolve conflicting `use` values. Keep the existing file's comments and order (append new terms under the matching section).
4. `pnpm --silent run check` (must pass). Commit "es-AR glossary", push, open a draft PR "es-AR translation run".
5. For each term with matches, count them: `pnpm --silent run pending --match '<regex of its match forms>' --status all --limit 0 --format keys | wc -l`.
6. **STOP.** Send the user: number of terms added, then every new term as one line `match → use (N keys) — note`, then the 10 terms with most matches. Ask them to approve or edit. Apply their edits, commit, push. Continue only after they approve.

## Step 2: Glossary matches (subagent model: sonnet)

```bash
pnpm --silent run pending --match-glossary --dedupe --out-dir /tmp/b
```

One subagent per batch file, prompt TRANSLATE with MODE = "Every row contains a glossary term. Apply the glossary unless the term's note or the context says to keep base." Output /tmp/b/changes-NNN.tsv. Apply each:

```bash
pnpm --silent run apply /tmp/b/batch-NNN.tsv /tmp/b/changes-NNN.tsv
```

When all are applied: `pnpm --silent run check`, commit "es-AR glossary matches", push.

## Step 3: QA glossary kept (subagent model: sonnet)

```bash
pnpm --silent run pending --glossary-kept --dedupe --out-dir /tmp/qa1
```

Same as step 2 with MODE = "Every row was reviewed but its current text (override if any, else base) still contains a glossary term. Keep base only for another meaning, a brand/model name or an exception the term's note lists; otherwise write the es-AR text." If a keep reason repeats across many rows, add it to that term's note in glossary.yml. Commit "es-AR QA glossary kept", push. Skip the step when pending writes 0 batches.

## Step 4: Full pass on categories and return reasons (subagent model: sonnet)

```bash
pnpm --silent run pending --type categories,return_reasons --out-dir /tmp/c1
```

Same dispatch with MODE = "Review every row. Most rows need no change. Look for Spain-only terms missing from the glossary, mistranslations vs en (false friends), and consistency with parent/sibling categories in the batch (aa-1-13-8 is a child of aa-1-13)." Commit and push after every 10 applied batches ("es-AR categories review (n/N)").

## Step 4b: Harvest new glossary terms (subagent model: opus)

Reviewers fix Spain-only words row by row, and those fixes only reach other keys through the glossary. Find the swaps the glossary doesn't cover yet:

```bash
pnpm --silent run harvest --out /tmp/harvest.tsv
```

Skip to step 4c when it writes 0 rows. Otherwise dispatch one subagent with prompt HARVEST below. Merge its proposals: terms into glossary.yml (as in step 1.3), ignore entries into overrides/es-AR/harvest-ignore.yml. Then:

1. `pnpm --silent run harvest --format count` must print 0. If not, dispatch HARVEST again for the remaining rows.
2. For each new term, count its keys as in step 1.5. **STOP.** Send the user every new term as one line `match → use (N keys) — note`, plus the number of ignore entries. Apply their edits, commit "es-AR harvest", push.
3. Review the new terms' matches (already-reviewed keys included): `pnpm --silent run pending --glossary-kept --match '<regex of the new terms' match forms>' --dedupe --out-dir /tmp/h`, then dispatch as in step 3. Commit "es-AR harvest matches", push.

## Step 4c: QA

Repeat step 3 with --out-dir /tmp/qa2.

## Step 5: Remaining attributes and values

`pnpm --silent run check` must report 0 open harvest candidates (`mark-reviewed` refuses otherwise); if not, run step 4b again. **STOP.** Send the user the check table. Ask: "Mark the remaining N attributes/values without glossary matches as reviewed (base text kept, not read one by one)? yes/no". If yes:

```bash
for t in attributes values; do
  pnpm --silent run pending --type $t --exclude-glossary --limit 0 --format keys | pnpm --silent run mark-reviewed --type $t -
done
```

Commit "es-AR bulk-mark attributes and values", push.

## Step 6: Finish

`pnpm --silent run check`. Update the PR description: the check table, overrides added per type, skipped batches (with reason), glossary terms added. Mark the PR ready for review. Send the user the PR link and the same summary.

---

## Subagent prompts

Fill the placeholders and pass the text as the subagent prompt.

### GLOSSARY

```
Propose es-AR glossary terms. Don't run git or pnpm run apply; don't edit repo files.
Read the "es-AR rules" and "Glossary" sections of AGENTS.md and the whole overrides/es-AR/glossary.yml.
Read <CHUNK> (columns: word, count of texts containing it, shortest example, ✓ if already in the glossary).
Add a term only when the word is not what Argentines use in e-commerce for that meaning: Spain-only words, words with another or vulgar meaning in Argentina. Skip ✓ words and neutral words.
For unclear words check usage: pnpm --silent run pending --match '<word>' --status all --limit 20
Write proposals to <OUT> as YAML in the glossary format (`terms:` list with match, use, note). In match, list every inflection of the word (singular/plural, gender). note: gender changes, other meanings to keep, brand names. Write `terms: []` if none.
Reply only: done <number of terms>
```

### TRANSLATE

```
Review es-AR text for one batch. Don't run git or pnpm run apply; don't edit repo files.
Read the "es-AR rules" section of AGENTS.md and the whole overrides/es-AR/glossary.yml.
Read <BATCH>. Columns: type, keys, field, en, base (current es text), override (current es-AR override, may be empty).
<MODE>
Write <OUT> with only the rows that change, tab-separated, no header:
type⇥keys⇥field⇥new text
Copy type, keys and field exactly from the batch row. "-" as new text deletes an existing override. Write an empty file if nothing changes.
<ERROR>
Reply only: done <number of rows written>
```

`<ERROR>` is empty, or on retry: "The previous attempt failed `pnpm run apply` with: <error output>. Fix those rows."

### HARVEST

```
Propose es-AR glossary terms from word swaps reviewers already made. Don't run git or pnpm run apply; don't edit repo files.
Read the "es-AR rules" and "Glossary" sections of AGENTS.md and the whole overrides/es-AR/glossary.yml.
Read /tmp/harvest.tsv. Each row is a word or phrase some override replaced that other keys still contain. Columns: removed, replacements (count), swaps, residual keys, status, examples.
Decide every row:
- Regional word choice (Spain-only, other or vulgar meaning in Argentina, false friend): propose a glossary term. In match, list every inflection; note: senses to keep, gender changes.
- One-off fix (mistranslation of one key, context-specific wording, rewording, spelling variant): propose an ignore entry.
Check usage when unsure: pnpm --silent run pending --match '<word>' --status all --limit 20
Write /tmp/harvest-terms.yml (`terms:` list in the glossary format) and /tmp/harvest-ignore.yml (`ignore:` list of `match: ["<removed exactly as listed>"]` and `note`).
Reply only: done <terms> terms, <ignores> ignores
```
