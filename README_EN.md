[中文](README.md) | [English](README_EN.md)

---

# OpenCode On-Premises Version

This directory contains **git patch files**, scripts, and documentation required to modify the original opencode into an on-premises (offline) version.

## Directory Structure

```
opencode-onprem/
├── manifest.json           # Modification manifest
├── WORKFLOW.md             # Detailed build guide
├── README.md               # This file
├── patches/
│   ├── 0001-add-onprem-module-and-scripts.patch  # Newfiles│   ├── 0002-modify-source-files.patch            # Source modifications (base)
│   ├── lsp-server-onprem.patch                   # LSP server offline support
│   └── parsers-config-onprem.patch                # Tree-sitter offline support
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
/path/to/opencode-onprem/scripts/apply-patches.sh .

# Method 2: Manually apply git patches
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem/patches/parsers-config-onprem.patch
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

### 3. Package Bundle

```bash
OPENCODE_VERSION=1.2.27 bun run script/package-onprem-bundle.ts
```

> **Note:** The `OPENCODE_VERSION` environment variable sets the compiled version number.

After packaging, two versions are generated:
- `opencode-onprem-linux-x64.tar.zst` - Standard version (requires AVX2 support)
- `opencode-onprem-linux-x64-baseline.tar.zst` - Compatible version (no AVX2 required, for older CPUs)

### 4. Deploy to Offline Environment

```bash
# Standard version (requires AVX2)
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# Or compatible version (no AVX2 required)
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem
```

## Patch File Descriptions

### 0001-add-onprem-module-and-scripts.patch

New files:
- `packages/opencode/src/onprem/index.ts` - Core onprem module
- `script/download-onprem-deps.ts` - Pre-download script
- `script/package-onprem-bundle.ts` - Packaging script

### 0002-modify-source-files.patch

Modified files:
- `packages/opencode/src/flag/flag.ts` - Add environment variables
- `packages/opencode/src/file/ripgrep.ts` - Offline ripgrep
- `packages/opencode/src/provider/models.ts` - Offline models.json
- `packages/opencode/src/server/server.ts` - Web UI static serving

### lsp-server-onprem.patch

Adds offline support for the following LSPs:

**Binary LSPs (8):**
- clangd, rust-analyzer, zls, lua-language-server
- terraform-ls, texlab, tinymist

**NPM-based LSPs (6):**
- typescript-language-server, pyright
- svelte-language-server, @astrojs/language-server
- yaml-language-server, dockerfile-language-server-nodejs

### parsers-config-onprem.patch

Supports offline loading of tree-sitter parsers for 21 languages.

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

### NPM-based LSPs

| LSP | Language |
|-----|----------|
| typescript-language-server | TypeScript/JavaScript |
| pyright | Python |
| svelte-language-server | Svelte |
| @astrojs/language-server | Astro |
| yaml-language-server | YAML |
| dockerfile-language-server-nodejs | Dockerfile |

### Tree-sitter Parsers

Syntax parsers for 21 languages:
python, rust, go, cpp, csharp, bash, c, java, ruby, php, scala, html, json, yaml, haskell, css, julia, ocaml, clojure, swift, nix

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
│   └── tinymist/bin/tinymist
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
│   └── dockerfile-language-server-nodejs/
├── models.json                      # Model metadata
├── app/                             # Web UI
└── manifest.json                    # Bundle manifest
```

## Comparison with opencode-offline

| Feature | opencode-offline | opencode-onprem |
|---------|------------------|-----------------|
| Environment variables | `OPENCODE_OFFLINE_*` | `OPENCODE_ONPREM_*` |
| Patch format | Manual modifications | git patch files |
| LSP support | 5 core LSPs | 15 LSPs |
| Tree-sitter | None | 21 languages |
| Target users | Fully offline environments | Intranets with mirror sources |

## Version Upgrade Process

When opencode releases a new version:

```bash
# 1. Download new version
git clone https://github.com/anomalyco/opencode.git opencode-new-ver

# 2. Try to apply patches
cd opencode-new-ver
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem/patches/parsers-config-onprem.patch

# 3. If there are conflicts, resolve manually
# Search for "// onprem-fork:" markers to confirm modification locations

# 4. Test build
bun install
bun run script/download-onprem-deps.ts
OPENCODE_VERSION=x.x.x bun run script/package-onprem-bundle.ts

# 5. Update patch files (if modified)
git add -A && git commit -m "onprem modifications"
git diff HEAD~1 HEAD -- packages/opencode/src/onprem/ script/ > patches/0001-add-onprem-module-and-scripts.patch
# ... other patch files
```

## Reference Documentation

- [WORKFLOW_EN.md](./WORKFLOW_EN.md) - Detailed build guide
- [manifest.json](./manifest.json) - Modification manifest