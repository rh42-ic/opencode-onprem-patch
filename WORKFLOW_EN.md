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
git apply /path/to/opencode-onprem-patch/patches/plugins-onprem.patch

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
| `script/onprem-plugins.json` | Plugin configuration file |
| `script/onprem-plugins.schema.json` | JSON Schema |

### 0002-modify-source-files.patch

Modified files:
| File Path | Modification |
|-----------|--------------|
| `packages/opencode/package.json` | Add opentui dependency |
| `packages/opencode/src/flag/flag.ts` | Add `OPENCODE_ONPREM_MODE` and `OPENCODE_ONPREM_DEPS_PATH` flags |
| `packages/opencode/src/file/ripgrep.ts` | Add offline ripgrep path check |
| `packages/opencode/src/provider/models.ts` | Add loading model data from deps/models.json |
| `packages/opencode/src/server/routes/ui.ts` | Add Web UI static file serving |
 
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
 - kotlin-ls (Kotlin)
 - jdtls (Java)
 - vscode-eslint (ESLint)
 - elixir-ls (Elixir)
 - deno (Deno)
 - gopls (Go)

**NPM-based LSPs:**
- typescript-language-server
- pyright
- svelte-language-server
- @astrojs/language-server
- yaml-language-server
- dockerfile-language-server-nodejs
- @vue/language-server
- intelephense (PHP)
- bash-language-server
- oxlint
- biome
- prisma

### parsers-config-onprem.patch

Modifies `packages/opencode/parsers-config.ts` to support loading tree-sitter WASM and query files from local deps directory.

Supports 25 languages:
python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php, scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml, clojure, swift, toml, nix

### plugins-onprem.patch

Modifies `packages/opencode/src/plugin/shared.ts`, adding offline plugin detection to `resolvePluginTarget()`.

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

**Model Loading Priority (onprem mode):**
1. Cache file (`~/.cache/opencode/models.json` or `OPENCODE_MODELS_PATH`)
2. onprem deps directory (`OPENCODE_ONPREM_DEPS_PATH/models.json`)
3. Bundled snapshot (`models-snapshot.ts`)
4. Network fetch (if `OPENCODE_DISABLE_MODELS_FETCH` is not set)

### server/routes/ui.ts
 
 ```typescript
 // onprem-fork: serve bundled web app in onprem mode
 const onpremStatic = await Onprem.tryServeStaticFile(c.req.path)
 if (onpremStatic) {
   return new Response(onpremStatic.body, { headers: { "Content-Type": onpremStatic.mime } })
 }
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
 OPENCODE_VERSION=1.14.22 bun run script/package-onprem-bundle.ts
 ```
 
 > **Note:** The `OPENCODE_VERSION` environment variable sets the compiled version number. The packaging format for Linux has been updated to `tar.zst`, using `zstd -19 --long` for maximum compression.

 > **Note:** By default, the baseline version is no longer generated automatically. To include it, use the `--baseline` flag: `bun run script/package-onprem-bundle.ts --baseline`.
  
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
git diff HEAD~1 HEAD -- script/download-onprem-deps.ts script/package-onprem-bundle.ts packages/opencode/src/onprem/index.ts script/onprem-plugins.json script/onprem-plugins.schema.json > patches/0001-add-onprem-module-and-scripts.patch
 git diff HEAD~1 HEAD -- packages/opencode/src/flag/flag.ts packages/opencode/src/file/ripgrep.ts packages/opencode/src/provider/models.ts packages/opencode/src/server/routes/ui.ts packages/opencode/package.json > patches/0002-modify-source-files.patch
 git diff HEAD~1 HEAD -- packages/opencode/src/lsp/server.ts > patches/lsp-server-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/parsers-config.ts > patches/parsers-config-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/src/plugin/shared.ts > patches/plugins-onprem.patch
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
| TexLab | GitHub Releases | `deps/lsp/texlab/bin/texlab` |
| Tinymist | GitHub Releases | `deps/lsp/tinymist/bin/tinymist` |
| Kotlin-LS | GitHub Releases | `deps/lsp/kotlin-ls/bin/kotlin-lsp.sh` |
| JDTLS | Eclipse Downloads | `deps/lsp/jdtls/` |
| VSCode-ESLint | GitHub Releases | `deps/lsp/vscode-eslint/server/out/eslintServer.js` |
| Elixir-LS | GitHub Releases | `deps/lsp/elixir-ls-master/release/language_server.sh` |

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
| Vue LSP | `deps/node_modules/@vue/language-server/` |
| Intelephense (PHP) | `deps/node_modules/intelephense/` |
| Bash LSP | `deps/node_modules/bash-language-server/` |
| Oxlint | `deps/node_modules/oxlint/` |
| Biome | `deps/node_modules/@biomejs/biome/` |
| Prisma | `deps/node_modules/prisma/` |

### Tree-sitter Parsers (WASM)

Supports tree-sitter parsers for 25 languages:
- python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php
- scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml
- clojure, swift, toml, nix

Storage path: `deps/tree-sitter/wasm/`

### Tree-sitter Query Files

Query files (highlights.scm, locals.scm) for each language:
Storage path: `deps/tree-sitter/queries/{lang}/`

### Other Resources

| Component | Storage Path |
|------------|--------------|
| models.json | `deps/models.json` |
| Web App | `deps/app/` |
| OpenTUI | `deps/opentui/libopentui.so` |

### Offline Plugins

Configured via `script/onprem-plugins.json`, supports:
- npm packages (e.g., `opencode-anthropic-auth@0.0.13`)
- Git repositories (e.g., `superpowers@git+https://github.com/obra/superpowers.git`)

Storage path: `deps/plugins/node_modules/`

The manifest.json records installed plugin version information.

## Skipped LSPs

The following LSPs are skipped due to complex runtime environment dependencies or lack of auto-download implementation:

| LSP | Reason |
|-----|--------|
| Haskell LS | Requires GHC |
| Gleam LS | Requires gleam installation |
| Clojure LS | Requires clojure-lsp installation |
| Nixd | Requires nixd installation |
| JuliaLS | Requires Julia installation |
