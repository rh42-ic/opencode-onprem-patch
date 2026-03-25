[中文](WORKFLOW.md) | [English](WORKFLOW_EN.md)

---

# OpenCode On-Premises Build Guide

This document describes how to apply modifications to a new opencode version and generate the corresponding on-premises version.

## Applying Modifications Using Git Patches (Recommended)

### Quick Apply

```bash
# 1. Download new version source
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# 2. Initialize git (if source is not a git repository)
git init && git add -A && git commit -m "init"

# 3. Apply patches
git apply /path/to/opencode-onprem-patch/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem-patch/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem-patch/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/parsers-config-onprem.patch

# 4. If there are conflicts
# Check .rej files, merge manually
# Search for "// onprem-fork:" markers to confirm modification locations
```

### Or Use the Script

```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch File Descriptions

### 0001-add-onprem-module-and-scripts.patch

New files:
| File Path | Function |
|-----------|----------|
| `packages/opencode/src/onprem/index.ts` | Core onprem module, provides offline resource resolution |
| `script/download-onprem-deps.ts` | Pre-download dependencies script |
| `script/package-onprem-bundle.ts` | Packaging script |

### 0002-modify-source-files.patch

Modified files:
| File Path | Modification |
|-----------|--------------|
| `packages/opencode/src/flag/flag.ts` | Add `OPENCODE_ONPREM_MODE` and `OPENCODE_ONPREM_DEPS_PATH` flags |
| `packages/opencode/src/file/ripgrep.ts` | Add offline ripgrep path check |
| `packages/opencode/src/provider/models.ts` | Add loading model data from deps/models.json with dual fallback and logging |
| `packages/opencode/src/server/server.ts` | Add Web UI static file serving |

### lsp-server-onprem.patch

Modifies `packages/opencode/src/lsp/server.ts`, adding offline path checks for the following LSPs:

**Binary LSPs:**
- clangd
- rust-analyzer
- zls (Zig Language Server)
- lua-language-server
- terraform-ls
- texlab (LaTeX)
- tinymist (Typst)

**NPM-based LSPs:**
- typescript-language-server
- pyright
- svelte-language-server
- @astrojs/language-server
- yaml-language-server
- dockerfile-language-server-nodejs

### parsers-config-onprem.patch

Modifies `packages/opencode/parsers-config.ts` to support loading tree-sitter WASM and query files from local deps directory.

## Search Markers

All modifications use `// onprem-fork:` comment markers for easy location during synchronization:

```bash
grep -rn "onprem-fork" packages/opencode/src/
```

## Detailed Modification Reference (For Manual Application)

### flag.ts

```typescript
// onprem-fork: onprem mode flags
export const OPENCODE_ONPREM_MODE = truthy("OPENCODE_ONPREM_MODE")
export const OPENCODE_ONPREM_DEPS_PATH = process.env["OPENCODE_ONPREM_DEPS_PATH"]
```

### onprem/index.ts

Create core module providing the following functions:
- `isEnabled()` - Check if onprem mode is enabled
- `getDepsPath()` - Get dependencies directory path
- `resolveBinary()` - Resolve binary file path
- `resolveNpmPackage()` - Resolve npm package path
- `resolveLspBinary()` - Resolve LSP binary path
- `resolveAppDist()` - Resolve Web App directory
- `resolveParserWasm()` - Resolve tree-sitter WASM path
- `resolveParserQuery()` - Resolve tree-sitter query file path
- `parserWasmExists()` - Check if WASM file exists
- `parserQueryExists()` - Check if query file exists
- `resolvePlugin()` - Resolve offline plugin path
- `pluginExists()` - Check if offline plugin exists
- `tryServeStaticFile()` - Try to serve static file

### ripgrep.ts

In the `state()` function, after system path check and before download, add:

```typescript
// onprem-fork: check offline deps for bundled ripgrep binary
if (Onprem.isEnabled()) {
  const offlinePath = Onprem.resolveBinary("rg" + (process.platform === "win32" ? ".exe" : ""), "ripgrep")
  if (offlinePath) {
    const offlineFile = Bun.file(offlinePath)
    if (await offlineFile.exists()) {
      log.info("using onprem ripgrep", { path: offlinePath })
      return { filepath: offlinePath }
    }
  }
  log.warn("onprem mode enabled but ripgrep not found in deps")
}
```

### models.ts

1. Add import:
```typescript
import { Onprem } from "../onprem"
```

2. Modify the `Data()` function to add onprem check after cache read and before snapshot import:
```typescript
export const Data = lazy(async () => {
  const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
  if (result) return result
  // onprem-fork: try deps models.json from onprem bundle before snapshot
  if (Onprem.isEnabled()) {
    const depsPath = Onprem.getDepsPath()
    if (depsPath) {
      const offlineResult = await Filesystem.readJson(path.join(depsPath, "models.json")).catch(() => {})
      if (offlineResult) {
        log.info("loaded models from onprem deps", { path: depsPath })
        return offlineResult as Record<string, Provider>
      }
      log.warn("onprem enabled but deps models.json not found", { path: depsPath })
    }
  }
  // @ts-ignore
  const snapshot = await import("./models-snapshot")
    .then((m) => m.snapshot as Record<string, unknown>)
    .catch(() => undefined)
  if (snapshot) return snapshot
  if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return {}
  const json = await fetch(`${url()}/api.json`).then((x) => x.text())
  return JSON.parse(json)
})
```

3. Modify the beginning of `get()` function with improved error logging:
```typescript
export async function get() {
  // onprem-fork: in onprem mode, try bundled models from deps first
  if (Onprem.isEnabled()) {
    const depsPath = Onprem.getDepsPath()
    if (depsPath) {
      const modelsPath = path.join(depsPath, "models.json")
      const offlineResult = await Filesystem.readJson(modelsPath).catch((e) => {
        log.warn("failed to read onprem models.json", { path: modelsPath, error: String(e) })
        return undefined
      })
      if (offlineResult) return offlineResult as Record<string, Provider>
    }
  }

  const result = await Data()
  return result as Record<string, Provider>
}
```

4. Modify refresh logic to skip onprem mode:
```typescript
// onprem-fork: skip models refresh in onprem mode
if (!Onprem.isEnabled() && !Flag.OPENCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
  ModelsDev.refresh()
  // ...
}
```

**Model Loading Priority (onprem mode):**
1. Cache file (`~/.cache/opencode/models.json` or `OPENCODE_MODELS_PATH`)
2. onprem deps directory (`OPENCODE_ONPREM_DEPS_PATH/models.json`)
3. Bundled snapshot (`models-snapshot.ts`)
4. Network fetch (if `OPENCODE_DISABLE_MODELS_FETCH` is not set)

**Log Output:**
- Successfully loaded from onprem deps: `log.info("loaded models from onprem deps", { path: depsPath })`
- deps directory exists but models.json missing: `log.warn("onprem enabled but deps models.json not found", { path: depsPath })`
- Failed to read models.json: `log.warn("failed to read onprem models.json", { path: modelsPath, error: String(e) })`

### server/server.ts

1. Add import:
```typescript
import { Onprem } from "../onprem"
```

2. Add at the beginning of `.all("/*", ...)` route:
```typescript
// onprem-fork: serve bundled web app in onprem mode
const onpremStatic = await Onprem.tryServeStaticFile(c.req.path)
if (onpremStatic) {
  return new Response(onpremStatic.body, { headers: { "Content-Type": onpremStatic.mime } })
}
```

### lsp/server.ts

1. Add import:
```typescript
import { Onprem } from "../onprem"
```

2. Add offline path check in each LSP's spawn() function (refer to patch file).

### bun/index.ts

1. Add import:
```typescript
import { Onprem } from "../onprem"
```

2. Add offline plugin detection at the beginning of `BunProc.install()` function:
```typescript
// onprem-fork: check offline plugins directory first
if (Onprem.isEnabled()) {
  const pluginPath = Onprem.resolvePlugin(pkg)
  if (pluginPath && await Onprem.pluginExists(pkg)) {
    log.info("using onprem plugin", { pkg, path: pluginPath })
    return pluginPath
  }
}
```

## Build Process

### 1. Configure Offline Plugins (Optional)

Edit `script/onprem-plugins.json` to configure plugins for offline use:

```json
{
  "$schema": "./onprem-plugins.schema.json",
  "plugins": [
    "opencode-anthropic-auth@0.0.13",
    "superpowers@git+https://github.com/obra/superpowers.git",
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest",
    "github:JRedeker/opencode-morph-fast-apply"
  ]
}
```

Configuration formats:
- `package@version` - Specific version of npm package
- `package@latest` - Latest version of npm package
- `@scope/package@version` - Scoped package
- `package@git+https://...` - Git repository source
- `package@git+ssh://...` - Git SSH source
- `github:user/repo` - GitHub shorthand format

### 2. Pre-download Dependencies on Networked Machine

```bash
cd opencode
bun install
bun run script/download-onprem-deps.ts
```

Optional environment variables:
- `MODELS_URL` - Mirror source for models.json
- `RUST_ANALYZER_MIRROR_URL` - Mirror source for rust-analyzer
- `SKIP_WEB_APP_BUILD=true` - Skip Web App build

Download plugins only (for testing):
```bash
bun run script/download-onprem-deps.ts --plugins-only
```

### 3. Package Offline Bundle

```bash
OPENCODE_VERSION=1.2.27 bun run script/package-onprem-bundle.ts
```

> **Note:** The `OPENCODE_VERSION` environment variable sets the compiled version number.

### 4. Deploy on Offline Machine

```bash
# Standard version (requires AVX2)
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# Or compatible version (no AVX2 required, for older CPUs)
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem
```

## Regenerating Patches After Version Upgrade

```bash
# In the modified repository
git add -A
git commit -m "onprem modifications for version x.x.x"

# Generate new patches
git diff HEAD~1 HEAD -- packages/opencode/src/onprem/index.ts script/ > patches/0001-add-onprem-module-and-scripts.patch
git diff HEAD~1 HEAD -- packages/opencode/src/flag/flag.ts packages/opencode/src/file/ripgrep.ts packages/opencode/src/provider/models.ts packages/opencode/src/server/server.ts packages/opencode/src/installation/index.ts > patches/0002-modify-source-files.patch
git diff HEAD~1 HEAD -- packages/opencode/src/lsp/server.ts > patches/lsp-server-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/parsers-config.ts > patches/parsers-config-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/src/bun/index.ts packages/opencode/src/onprem/index.ts script/download-onprem-deps.ts script/onprem-plugins.json script/onprem-plugins.schema.json > patches/plugins-onprem.patch
```

## Pre-downloaded Resources Manifest

### Binary LSPs

| Component | Source | Storage Path |
|-----------|--------|--------------|
| Ripgrep | GitHub Releases | `deps/ripgrep/rg` |
| Clangd | GitHub Releases | `deps/lsp/clangd/bin/clangd` |
| Rust-analyzer | GitHub Releases | `deps/lsp/rust-analyzer/bin/rust-analyzer` |
| ZLS | GitHub Releases | `deps/lsp/zls/bin/zls` |
| LuaLS | GitHub Releases | `deps/lsp/lua-language-server/bin/lua-language-server` |
| Terraform-LS | HashiCorp Releases | `deps/lsp/terraform-ls/terraform-ls` |
|TexLab | GitHub Releases | `deps/lsp/texlab/bin/texlab` |
| Tinymist | GitHub Releases | `deps/lsp/tinymist/bin/tinymist` |

### NPM-based LSPs

| Component | Storage Path |
|-----------|--------------|
| TypeScript | `deps/node_modules/typescript/` |
| TypeScript LSP | `deps/node_modules/typescript-language-server/` |
| Pyright | `deps/node_modules/pyright/` |
| Svelte LSP | `deps/node_modules/svelte-language-server/` |
| Astro LSP | `deps/node_modules/@astrojs/language-server/` |
| YAML LSP | `deps/node_modules/yaml-language-server/` |
| Dockerfile LSP | `deps/node_modules/dockerfile-language-server-nodejs/` |

### Tree-sitter Parsers (WASM)

Supports tree-sitter parsers for 21 languages:
- python, rust, go, cpp, csharp, bash, c, java, ruby, php
- scala, html, json, yaml, haskell, css, julia, ocaml
- clojure, swift, nix

Storage path: `deps/tree-sitter/wasm/`

### Tree-sitter Query Files

Query files (highlights.scm, locals.scm) for each language:
Storage path: `deps/tree-sitter/queries/{lang}/`

### Other Resources

| Component | Storage Path |
|------------|--------------|
| models.json | `deps/models.json` |
| Web App | `deps/app/` |

### Offline Plugins

Configured via `script/onprem-plugins.json`, supports:
- npm packages (e.g., `opencode-anthropic-auth@0.0.13`)
- Git repositories (e.g., `superpowers@git+https://github.com/obra/superpowers.git`)

Storage path: `deps/plugins/node_modules/`

The manifest.json records installed plugin version information.

## Skipped LSPs

The following LSPs are skipped due to complex runtime environment dependencies:

| LSP | Reason |
|-----|--------|
| ElixirLS | Requires Elixir runtime |
| Kotlin LSP | Requires JetBrains CDN |
| jdtls | Requires Java 21+ |
| Haskell LS | Requires GHC |
| Gleam LS | Requires gleam installation |
| Clojure LS | Requires clojure-lsp installation |
| Nixd | Requires nixd installation |
| JuliaLS | Requires Julia installation |