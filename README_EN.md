[中文](README.md) | [English](README_EN.md)

---

# OpenCode On-Premises Version

This directory contains **git patch files**, scripts, and documentation required to modify the original opencode into an on-premises (offline) version.

If patching fails, the descriptive documentation should be sufficient for an AI Coding Agent to resolve conflicts. You can start by saying:

```
Read the instructions in @/path/to/opencode-onprem-patch, apply patches to @/path/to/opencode-1.x.xx, and resolve any conflicts that occur.
```

## Directory Structure

```
opencode-onprem-patch/
├── manifest.json           # Modification manifest
├── WORKFLOW.md             # Detailed build guide
├── README.md               # This file
├── patches/
│   ├── 0001-add-onprem-module-and-scripts.patch  # New files
│   ├── 0002-modify-source-files.patch            # Source modifications (base)
│   ├── lsp-server-onprem.patch                   # LSP server offline support
│   ├── parsers-config-onprem.patch                # Tree-sitter offline support
│   └── plugins-onprem.patch                      # Plugin offline support
├── src/
│   ├── onprem-index.ts         # Onprem module source
│   ├── onprem-plugins.json      # Plugin config template
│   └── onprem-plugins.schema.json # Config Schema
└── scripts/
    ├── download-onprem-deps.ts    # Pre-download dependencies script
    ├── package-onprem-bundle.ts   # Packaging script
    ├── opencode-onprem            # Startup script template
    └── apply-patches.sh           # Auto-apply patches script
```

## Quick Start

### 1. Apply Patches to New Version

```bash
# Download new version of opencode source
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# Method 1: Use script to auto-apply (recommended)
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .

# Method 2: Manually apply git patches
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem-patch/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem-patch/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem-patch/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/parsers-config-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/plugins-onprem.patch
```

### 2. Pre-download Dependencies

Run this in a networked environment:

```bash
cd opencode-new
bun install
bun run script/download-onprem-deps.ts
```

Optional environment variables:
- `MODELS_URL` - Mirror URL for models.json
- `RUST_ANALYZER_MIRROR_URL` - Mirror URL for rust-analyzer
- `SKIP_WEB_APP_BUILD=true` - Skip Web App build

Download plugins only (for testing):
```bash
bun run script/download-onprem-deps.ts --plugins-only
```

### 3. Package Bundle

```bash
OPENCODE_VERSION=1.3.9 bun run script/package-onprem-bundle.ts
```

> **Note:** By default, dependencies for all platforms are bundled together. You can use the `--platforms=windows-x64` parameter to restrict the target platform for packaging.

> **Note:** The `OPENCODE_VERSION` environment variable sets the compiled version number.

After packaging, the following platform-specific archive versions will be generated:
- `opencode-onprem-linux-x64.tar.zst` - Linux standard version (requires AVX2 support)
- `opencode-onprem-linux-x64-baseline.tar.zst` - Linux compatible version (no AVX2 required, for older CPUs)
- `opencode-onprem-windows-x64.7z` - Windows standard version (requires AVX2 support)
- `opencode-onprem-windows-x64-baseline.7z` - Windows compatible version (no AVX2 required, for older CPUs)

### 4. Deploy to Offline Environment

```bash
# Linux standard version (requires AVX2)
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# Or Linux compatible version (no AVX2 required)
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem

# Windows version
# Extract opencode-onprem-windows-x64.7z using a tool like 7z
cd opencode-onprem-windows-x64
opencode-onprem.bat
```

## Patch File Descriptions

### 0001-add-onprem-module-and-scripts.patch

New files:
- `packages/opencode/src/onprem/index.ts` - Core onprem module
- `script/download-onprem-deps.ts` - Pre-download script
- `script/package-onprem-bundle.ts` - Packaging script
- `script/onprem-plugins.json` - Plugin configuration file
- `script/onprem-plugins.schema.json` - JSON Schema

### 0002-modify-source-files.patch

Modified files:
- `packages/opencode/src/flag/flag.ts` - Add environment variables
- `packages/opencode/src/file/ripgrep.ts` - Offline ripgrep
- `packages/opencode/src/provider/models.ts` - Offline models.json
- `packages/opencode/src/server/instance.ts` - Web UI static serving

### lsp-server-onprem.patch

Adds offline support for the following LSPs:

**Binary LSPs (11):**
- clangd, rust-analyzer, zls, lua-language-server
- terraform-ls, texlab, tinymist, kotlin-ls
- jdtls, vscode-eslint, elixir-ls

**NPM-based LSPs (12):**
- typescript-language-server, pyright
- svelte-language-server, @astrojs/language-server
- yaml-language-server, dockerfile-language-server-nodejs
- @vue/language-server, intelephense, bash-language-server
- oxlint, biome, prisma

### parsers-config-onprem.patch

Supports offline loading of tree-sitter parsers for 25 languages.

### plugins-onprem.patch

Modified files:
- `packages/opencode/src/bun/index.ts` - Add offline plugin detection at start of `BunProc.install()`

## Supported Offline Components

### Binary LSPs

| LSP | Language | Source |
|-----|----------|--------|
| clangd | C/C++ | GitHub Releases |
| rust-analyzer | Rust | GitHub Releases |
| zls | Zig | GitHub Releases |
| lua-language-server | Lua | GitHub Releases |
| terraform-ls | Terraform | HashiCorp Releases |
| texlab | LaTeX | GitHub Releases |
| tinymist | Typst | GitHub Releases |
| kotlin-ls | Kotlin | GitHub Releases |
| jdtls | Java | Eclipse Downloads |
| vscode-eslint | ESLint | GitHub Releases |
| elixir-ls | Elixir | GitHub Releases |

### NPM-based LSPs

| LSP | Language |
|-----|----------|
| typescript-language-server | TypeScript/JavaScript |
| pyright | Python |
| svelte-language-server | Svelte |
| @astrojs/language-server | Astro |
| yaml-language-server | YAML |
| dockerfile-language-server-nodejs | Dockerfile |
| @vue/language-server | Vue |
| intelephense | PHP |
| bash-language-server | Bash |
| oxlint | Oxlint |
| biome | Biome |
| prisma | Prisma |

### Tree-sitter Parsers

Syntax parsers for 25 languages:
python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php, scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml, clojure, swift, toml, nix

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCODE_ONPREM_MODE` | Set to `true` to enable onprem mode |
| `OPENCODE_ONPREM_DEPS_PATH` | Dependencies directory path |
| `OPENCODE_DISABLE_AUTOUPDATE` | Set to `true` to disable auto-updates |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | Set to `true` to disable LSP downloads |
| `OPENCODE_DISABLE_MODELS_FETCH` | Set to `true` to disable models.dev fetch |

## Directory Structure (deps/)

```
deps/
├── ripgrep/
│   └── rg                           # Ripgrep binary
├── lsp/
│   ├── clangd/bin/clangd
│   ├── rust-analyzer/bin/rust-analyzer
│   ├── zls/bin/zls
│   ├── lua-language-server/bin/lua-language-server
│   ├── terraform-ls/terraform-ls
│   ├── texlab/bin/texlab
│   ├── tinymist/bin/tinymist
│   ├── kotlin-ls/bin/kotlin-lsp.sh
│   ├── jdtls/plugins/
│   ├── vscode-eslint/server/out/eslintServer.js
│   └── elixir-ls-master/release/language_server.sh
├── tree-sitter/
│   ├── wasm/                        # WASM parsers
│   │   ├── tree-sitter-python.wasm
│   │   ├── tree-sitter-rust.wasm
│   │   └── ...
│   └── queries/                     # Query files
│       ├── python/
│       │   ├── highlights.scm
│       │   └── locals.scm
│       └── ...
├── node_modules/
│   ├── typescript/
│   ├── typescript-language-server/
│   ├── pyright/
│   ├── svelte-language-server/
│   ├── @astrojs/language-server/
│   ├── yaml-language-server/
│   ├── dockerfile-language-server-nodejs/
│   ├── @vue/language-server/
│   ├── intelephense/
│   ├── bash-language-server/
│   ├── oxlint/
│   ├── @biomejs/biome/
│   └── prisma/
├── plugins/                         # Offline plugins directory (optional)
│   ├── package.json                # Generated by bun install
│   └── node_modules/
│       └── opencode-anthropic-auth/ # Example plugin
├── opentui/                         # OpenTUI native library
│   └── libopentui.so
├── models.json                      # Model metadata
├── app/                             # Web UI
└── manifest.json                    # Bundle manifest
```

## Plugin Offline Configuration

Before downloading dependencies, edit `script/onprem-plugins.json` to configure plugins for offline use:

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

### Plugins Only Download (Testing)

```bash
bun run script/download-onprem-deps.ts --plugins-only
```

When running the full download, configured plugins are automatically installed to `deps/plugins/node_modules/`.

In onprem mode, `BunProc.install()` checks the offline plugins directory first and uses the offline version if found.

## Reference Documentation

- [WORKFLOW_EN.md](./WORKFLOW_EN.md) - Detailed build guide
- [manifest.json](./manifest.json) - Modification manifest
