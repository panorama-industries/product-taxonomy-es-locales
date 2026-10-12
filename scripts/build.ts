// Resolves each locale, feeds it to Shopify's own dist generator and copies the output to dist/<locale>/.
import { cpSync, rmSync } from "node:fs"
import { join } from "node:path"
import { ROOT, TYPES, UPSTREAM_DIR, assertSynced, loadLocales, resolveEntries, run, writeUpstreamLocalization } from "./lib.ts"

assertSynced()
const config = loadLocales()
const locales = Object.keys(config)
const devDir = join(UPSTREAM_DIR, "dev")

for (const locale of locales) {
  for (const type of TYPES) writeUpstreamLocalization(locale, type, resolveEntries(locale, type, config))
}

run("bundle", ["install", "--quiet"], devDir)
run("bundle", ["exec", "bin/product_taxonomy", "dist", "--locales", ...locales], devDir)

rmSync(join(ROOT, "dist"), { recursive: true, force: true })
for (const locale of locales) {
  cpSync(join(UPSTREAM_DIR, "dist", locale), join(ROOT, "dist", locale), { recursive: true })
}
console.log(`Built dist/ for ${locales.join(", ")}`)
