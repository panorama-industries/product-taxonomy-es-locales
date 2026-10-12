// Downloads the pinned Shopify release into .upstream/: only data/, dev/ and the localization files we need.
import { rmSync } from "node:fs"
import { ROOT, UPSTREAM_DIR, UPSTREAM_REPO, markSynced, pinnedTag, run, upstreamLocales } from "./lib.ts"

const tag = pinnedTag()
const locales = upstreamLocales()

rmSync(UPSTREAM_DIR, { recursive: true, force: true })
run("git", ["-c", "advice.detachedHead=false", "clone", "--quiet", "--depth=1", "--filter=blob:none", "--sparse", "--single-branch", `--branch=${tag}`, UPSTREAM_REPO, UPSTREAM_DIR], ROOT)
run("git", [
  "-C", UPSTREAM_DIR, "sparse-checkout", "set", "--no-cone",
  "/*", "!/*/",
  "/data/", "!/data/localizations/*/*.yml",
  ...locales.map((l) => `/data/localizations/*/${l}.yml`),
  "/dev/",
])
markSynced(tag)
console.log(`Synced Shopify/product-taxonomy ${tag} (locales: ${locales.join(", ")})`)
