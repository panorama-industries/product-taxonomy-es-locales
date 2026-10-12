// Stamps keys as reviewed against the current en + base text. Run after deciding each key (override or keep base).
//   pnpm run mark-reviewed --locale es-AR --type values key1 key2 ...
//   pnpm run mark-reviewed --locale es-AR --type values -      (keys from stdin, one per line)
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { type LocalizationType, TYPES, assertSynced, loadLocales, loadReviewed, reviewStamp, sourceEntries, writeReviewed } from "./lib.ts"

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: { locale: { type: "string" }, type: { type: "string" } },
})

assertSynced()
const config = loadLocales()
const locales = Object.keys(config)
const locale = flags.locale ?? (locales.length === 1 ? locales[0] : undefined)
if (!locale || !config[locale]) throw new Error(`--locale must be one of: ${locales.join(", ")}`)
if (!TYPES.includes(flags.type as LocalizationType)) throw new Error(`--type must be one of: ${TYPES.join(", ")}`)
const type = flags.type as LocalizationType

const keys = (positionals.length === 1 && positionals[0] === "-" ? readFileSync(0, "utf8").split("\n") : positionals)
  .map((k) => k.trim())
  .filter(Boolean)
if (keys.length === 0) throw new Error("No keys given")

const unknown = keys.filter((key) => !sourceEntries(type)[key])
if (unknown.length > 0) throw new Error(`Unknown ${type} keys: ${unknown.join(", ")}`)

const reviewed = loadReviewed(locale, type)
for (const key of keys) reviewed[key] = reviewStamp(locale, type, key, config)
writeReviewed(locale, type, reviewed)
console.log(`Marked ${keys.length} ${type} keys reviewed for ${locale}`)
