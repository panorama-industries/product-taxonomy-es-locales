import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { dump, load } from "js-yaml"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const UPSTREAM_DIR = join(ROOT, ".upstream")
export const UPSTREAM_REPO = "https://github.com/Shopify/product-taxonomy.git"
const SYNCED_TAG_FILE = join(UPSTREAM_DIR, ".synced-tag")

export const TYPES = ["categories", "attributes", "values", "return_reasons"] as const
export type LocalizationType = (typeof TYPES)[number]

/** Localized fields of one key, e.g. { name, description } */
export type Entry = Record<string, string>
export type Entries = Record<string, Entry>

export type ReviewStatus = "reviewed" | "stale" | "unreviewed"

export const run = (cmd: string, args: ReadonlyArray<string>, cwd = ROOT) => {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`)
}

export const pinnedTag = () => readFileSync(join(ROOT, "UPSTREAM_VERSION"), "utf8").trim()

export const markSynced = (tag: string) => writeFileSync(SYNCED_TAG_FILE, `${tag}\n`)

export const assertSynced = () => {
  const tag = pinnedTag()
  const synced = existsSync(SYNCED_TAG_FILE) ? readFileSync(SYNCED_TAG_FILE, "utf8").trim() : undefined
  if (synced !== tag) throw new Error(`.upstream is at ${synced ?? "nothing"}, expected ${tag}. Run \`pnpm sync\`.`)
}

const readYaml = (path: string): unknown => load(readFileSync(path, "utf8"))

const writeYaml = (path: string, data: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `---\n${dump(data, { lineWidth: -1, forceQuotes: true, quoteStyle: "double" })}`)
}

const isRecord = (u: unknown): u is Record<string, unknown> => typeof u === "object" && u !== null && !Array.isArray(u)

const toEntries = (u: unknown, source: string): Entries => {
  if (u === undefined || u === null) return {}
  if (!isRecord(u)) throw new Error(`${source}: expected a map of keys`)
  for (const [key, entry] of Object.entries(u)) {
    if (!isRecord(entry) || !Object.values(entry).every((v) => typeof v === "string")) {
      throw new Error(`${source}: "${key}" must be a map of string fields`)
    }
  }
  return u as Entries
}

// ---------- locales config ----------

export type LocaleConfig = Record<string, { base: string }>

export const loadLocales = (): LocaleConfig => {
  const raw = readYaml(join(ROOT, "locales.yml"))
  if (!isRecord(raw)) throw new Error("locales.yml: expected a map")
  const config: LocaleConfig = {}
  for (const [locale, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.base !== "string") throw new Error(`locales.yml: ${locale}.base is required`)
    config[locale] = { base: value.base }
  }
  return config
}

/** Upstream locales that must be downloaded: en + every base not defined in locales.yml */
export const upstreamLocales = (config = loadLocales()) => [
  ...new Set(["en", ...Object.values(config).map((c) => c.base).filter((b) => !(b in config))]),
]

// ---------- upstream + overrides ----------

const cache = new Map<string, Entries>()
const cached = (id: string, load: () => Entries) => {
  let value = cache.get(id)
  if (!value) cache.set(id, (value = load()))
  return value
}

const upstreamPath = (type: LocalizationType, locale: string) =>
  join(UPSTREAM_DIR, "data", "localizations", type, `${locale}.yml`)

export const upstreamEntries = (locale: string, type: LocalizationType) =>
  cached(`upstream:${locale}:${type}`, () => {
    const path = upstreamPath(type, locale)
    if (!existsSync(path)) throw new Error(`Missing ${path}. Is "${locale}" a Shopify locale? Run \`pnpm sync\`.`)
    const doc = readYaml(path)
    return toEntries(isRecord(doc) && isRecord(doc[locale]) ? doc[locale][type] : undefined, path)
  })

/** English entries: the source of truth for which keys exist */
export const sourceEntries = (type: LocalizationType) => upstreamEntries("en", type)

export const overridesPath = (locale: string, type: LocalizationType) => join(ROOT, "overrides", locale, `${type}.yml`)

export const overrideEntries = (locale: string, type: LocalizationType) =>
  cached(`overrides:${locale}:${type}`, () => {
    const path = overridesPath(locale, type)
    if (!existsSync(path)) return {}
    const doc = readYaml(path)
    return toEntries(isRecord(doc) && isRecord(doc[locale]) ? doc[locale][type] : undefined, path)
  })

export const writeOverrides = (locale: string, type: LocalizationType, entries: Entries) => {
  writeYaml(overridesPath(locale, type), { [locale]: { [type]: entries } })
  cache.delete(`overrides:${locale}:${type}`)
}

/** Full localization for a locale: base resolved recursively, then overrides field by field, limited to en keys */
export const resolveEntries = (locale: string, type: LocalizationType, config = loadLocales(), seen: Array<string> = []): Entries => {
  if (seen.includes(locale)) throw new Error(`locales.yml: base cycle ${[...seen, locale].join(" → ")}`)
  const localeConfig = config[locale]
  if (!localeConfig) return upstreamEntries(locale, type)

  return cached(`resolved:${locale}:${type}`, () => {
    const base = resolveEntries(localeConfig.base, type, config, [...seen, locale])
    const overrides = overrideEntries(locale, type)
    const resolved: Entries = {}
    for (const key of Object.keys(sourceEntries(type))) {
      resolved[key] = { ...base[key], ...overrides[key] }
    }
    return resolved
  })
}

export const writeUpstreamLocalization = (locale: string, type: LocalizationType, entries: Entries) =>
  writeYaml(upstreamPath(type, locale), { [locale]: { [type]: entries } })

// ---------- review tracking ----------

const hashEntry = (entry: Entry | undefined) =>
  entry === undefined
    ? "none"
    : createHash("sha256")
        .update(JSON.stringify(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))))
        .digest("hex")
        .slice(0, 10)

const reviewedPath = (locale: string, type: LocalizationType) => join(ROOT, "overrides", locale, "reviewed", `${type}.json`)

/** key → "<en hash>:<base hash>" at the time the key was reviewed */
export const loadReviewed = (locale: string, type: LocalizationType): Record<string, string> => {
  const path = reviewedPath(locale, type)
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}
}

export const writeReviewed = (locale: string, type: LocalizationType, reviewed: Record<string, string>) => {
  const sorted = Object.fromEntries(Object.entries(reviewed).sort(([a], [b]) => a.localeCompare(b)))
  mkdirSync(dirname(reviewedPath(locale, type)), { recursive: true })
  writeFileSync(reviewedPath(locale, type), `${JSON.stringify(sorted, null, 2)}\n`)
}

export const reviewStamp = (locale: string, type: LocalizationType, key: string, config = loadLocales()) => {
  const localeConfig = config[locale]
  if (!localeConfig) throw new Error(`Unknown locale ${locale}`)
  const base = resolveEntries(localeConfig.base, type, config)
  return `${hashEntry(sourceEntries(type)[key])}:${hashEntry(base[key])}`
}

export const reviewStatuses = (locale: string, type: LocalizationType, config = loadLocales()) => {
  const reviewed = loadReviewed(locale, type)
  const statuses: Record<string, ReviewStatus> = {}
  for (const key of Object.keys(sourceEntries(type))) {
    const stamp = reviewed[key]
    statuses[key] = stamp === undefined ? "unreviewed" : stamp === reviewStamp(locale, type, key, config) ? "reviewed" : "stale"
  }
  return statuses
}
