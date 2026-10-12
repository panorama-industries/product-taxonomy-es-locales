// Validates overrides and reports review progress per locale.
//   --fix     drop overrides and review stamps for keys/fields that no longer exist upstream
//   --strict  also fail when keys are stale or unreviewed
// "glossary kept" = reviewed keys whose base still contains a glossary term with no override (deliberate or missed fix);
// list them with `pnpm run pending --glossary-kept`
import { parseArgs } from "node:util"
import {
  type Entries,
  TYPES,
  assertSynced,
  glossaryKeptFields,
  glossaryRegex,
  loadLocales,
  loadReviewed,
  overrideEntries,
  resolveEntries,
  reviewStatuses,
  sourceEntries,
  writeOverrides,
  writeReviewed,
} from "./lib.ts"

const { values: flags } = parseArgs({ options: { fix: { type: "boolean" }, strict: { type: "boolean" } } })

assertSynced()
const config = loadLocales()
const errors: Array<string> = []
let pendingTotal = 0

console.log("| locale | type | overrides | reviewed | stale | unreviewed | glossary kept |")
console.log("|---|---|---:|---:|---:|---:|---:|")

for (const locale of Object.keys(config)) {
  const glossary = glossaryRegex(locale)
  for (const type of TYPES) {
    const source = sourceEntries(type)
    const overrides = overrideEntries(locale, type)
    const fixed: Entries = {}
    let changed = false

    for (const [key, entry] of Object.entries(overrides)) {
      if (!source[key]) {
        errors.push(`${locale}/${type}: override for removed key "${key}"`)
        changed = true
        continue
      }
      const kept: Record<string, string> = {}
      for (const [field, value] of Object.entries(entry)) {
        if (!(field in source[key])) {
          errors.push(`${locale}/${type}: "${key}" has unknown field "${field}"`)
          changed = true
        } else if (value.trim() === "") {
          errors.push(`${locale}/${type}: "${key}.${field}" is empty`)
        } else {
          kept[field] = value
        }
      }
      if (Object.keys(kept).length > 0) fixed[key] = kept
    }

    const reviewed = loadReviewed(locale, type)
    const orphanStamps = Object.keys(reviewed).filter((key) => !source[key])
    for (const key of orphanStamps) errors.push(`${locale}/${type}: review stamp for removed key "${key}"`)

    if (flags.fix && changed) writeOverrides(locale, type, fixed)
    if (flags.fix && orphanStamps.length > 0) {
      for (const key of orphanStamps) delete reviewed[key]
      writeReviewed(locale, type, reviewed)
    }

    const counts = { reviewed: 0, stale: 0, unreviewed: 0 }
    const base = resolveEntries(config[locale].base, type, config)
    let kept = 0
    for (const [key, status] of Object.entries(reviewStatuses(locale, type, config))) {
      counts[status]++
      if (status === "reviewed" && glossaryKeptFields(base[key], overrides[key], glossary).length > 0) kept++
    }
    pendingTotal += counts.stale + counts.unreviewed
    console.log(`| ${locale} | ${type} | ${Object.keys(overrides).length} | ${counts.reviewed} | ${counts.stale} | ${counts.unreviewed} | ${kept} |`)
  }
}

if (errors.length > 0) {
  console.log(`\n${flags.fix ? "Fixed" : "Errors"} (${errors.length}):`)
  for (const e of errors) console.log(`- ${e}`)
  if (!flags.fix) {
    console.log("\nRun `pnpm run check --fix` to drop removed keys/fields. Empty values must be fixed by hand.")
    process.exitCode = 1
  }
}
if (flags.strict && pendingTotal > 0) {
  console.log(`\n${pendingTotal} keys pending review (--strict)`)
  process.exitCode = 1
}
