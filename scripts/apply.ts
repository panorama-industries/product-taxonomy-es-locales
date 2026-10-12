// Applies a changes file to a batch from `pnpm pending`, then marks every key in the batch reviewed.
//   pnpm apply /tmp/batch.tsv /tmp/changes.tsv
//   pnpm apply /tmp/batch.tsv            (no changes: base text is right for every key)
// changes.tsv rows: type⇥keys⇥field⇥text  (keys copied from the batch row; text "-" removes the override)
// Text equal to the base text removes the override. Nothing is written if any row is invalid.
import { existsSync } from "node:fs"
import { parseArgs } from "node:util"
import {
  type LocalizationType,
  assertSynced,
  isType,
  loadLocales,
  loadReviewed,
  overrideEntries,
  pickLocale,
  readTsv,
  resolveEntries,
  reviewStamp,
  sourceEntries,
  tsvUnescape,
  writeOverrides,
  writeReviewed,
} from "./lib.ts"

const { values: flags, positionals } = parseArgs({ allowPositionals: true, options: { locale: { type: "string" } } })
const [batchPath, changesPath] = positionals
if (!batchPath || positionals.length > 2) throw new Error("Usage: pnpm apply <batch.tsv> [changes.tsv]")

assertSynced()
const config = loadLocales()
const locale = pickLocale(flags.locale, config)
const errors: Array<string> = []

const batch = new Map<LocalizationType, Set<string>>()
for (const { line, cells } of readTsv(batchPath)) {
  const [type, keys] = cells
  if (!isType(type) || !keys) {
    errors.push(`${batchPath}:${line}: not a pending row`)
    continue
  }
  const set = batch.get(type) ?? new Set()
  for (const key of keys.split(",")) set.add(key)
  batch.set(type, set)
}

const edits = new Map<LocalizationType, Map<string, Record<string, string | null>>>()
if (changesPath && existsSync(changesPath)) {
  for (const { line, cells } of readTsv(changesPath)) {
    const where = `${changesPath}:${line}`
    if (cells.length !== 4) {
      errors.push(`${where}: expected 4 tab-separated columns (type, keys, field, text), got ${cells.length}`)
      continue
    }
    const [type, keys, field, rawText] = cells
    if (!isType(type)) {
      errors.push(`${where}: unknown type "${type}"`)
      continue
    }
    const text = tsvUnescape(rawText).trim()
    if (text === "") {
      errors.push(`${where}: empty text (use "-" to remove an override)`)
      continue
    }
    const base = resolveEntries(config[locale].base, type, config)
    for (const key of keys.split(",")) {
      if (!batch.get(type)?.has(key)) {
        errors.push(`${where}: ${type} "${key}" is not in the batch`)
      } else if (!(field in sourceEntries(type)[key])) {
        errors.push(`${where}: ${type} "${key}" has no field "${field}"`)
      } else {
        const byKey = edits.get(type) ?? new Map()
        const fields = byKey.get(key) ?? {}
        fields[field] = text === "-" || text === base[key]?.[field] ? null : text
        byKey.set(key, fields)
        edits.set(type, byKey)
      }
    }
  }
} else if (changesPath) {
  errors.push(`${changesPath} not found`)
}

if (errors.length > 0) {
  console.error(errors.join("\n"))
  console.error(`\n${errors.length} errors, nothing written`)
  process.exit(1)
}

let set = 0
let removed = 0
let reviewedCount = 0
for (const [type, keys] of batch) {
  const overrides = { ...overrideEntries(locale, type) }
  for (const [key, fields] of edits.get(type) ?? []) {
    const entry = { ...overrides[key] }
    for (const [field, text] of Object.entries(fields)) {
      if (text === null) {
        if (field in entry) removed++
        delete entry[field]
      } else {
        entry[field] = text
        set++
      }
    }
    if (Object.keys(entry).length > 0) overrides[key] = entry
    else delete overrides[key]
  }
  if (edits.has(type)) writeOverrides(locale, type, overrides)

  const reviewed = loadReviewed(locale, type)
  for (const key of keys) reviewed[key] = reviewStamp(locale, type, key, config)
  writeReviewed(locale, type, reviewed)
  reviewedCount += keys.size
}

console.log(`${locale}: ${set} fields overridden, ${removed} removed, ${reviewedCount} keys marked reviewed`)
