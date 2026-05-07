[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem Version

This directory contains **git patch files**, scripts, and source templates required to transform the original OpenCode into the "onprem" version for air-gapped deployments.

## Directory Structure

```
opencode-onprem-patch/
├── WORKFLOW.md             # Detailed build guide (CN)
├── WORKFLOW_EN.md          # Detailed build guide (EN)
├── README.md               # This file (CN)
├── README_EN.md            # This file (EN)
├── patches/
│   └── 0001-onprem-combined.patch  # Git Patch for source modifications (Optimized for 1.14.40)
├── src/
│   ├── onprem/
│   │   └── index.ts            # Core Onprem module (Decoupled)
│   ├── onprem-plugins.json      # Plugin configuration template
│   └── onprem-plugins.schema.json # Configuration Schema
└── scripts/
    ├── download-onprem-deps.ts    # Pre-download dependencies script
    ├── package-onprem-bundle.ts   # Packaging script
    ├── opencode-onprem            # Startup script template
    └── apply-patches.sh           # Patch application tool
```

## Quick Start

### 1. Apply Patches

```bash
# Enter opencode source directory
cd opencode-source

# Use the script to automatically apply patches and add new files
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .
```

### 2. Pre-download Dependencies (Internet Required)

```bash
bun install
bun run script/download-onprem-deps.ts --platforms=linux-x64-musl,linux-x64-gnu
```

### 3. Build & Package

```bash
OPENCODE_VERSION=1.14.40 bun run script/package-onprem-bundle.ts --platforms=linux-x64-musl
```

## Core Patch Changes

- **Flag System**: Introduces `OPENCODE_ONPREM_MODE` control; enabling it automatically disables updates, downloads, and model fetching.
- **Model Loading**: Prioritizes loading from offline `models.json`, compatible with the Effect framework.
- **UI Interception**: Automatically serves frontend static assets without an external Proxy.
- **LSP & Parsers**: Offline binary path mapping for 20+ LSPs including Pyright and Docker.
- **Schema Reference**: Automatically downloads `config.json` to the bundle root for configuration reference.
- **Plugin System**: Bypasses plugin validity checks in offline mode.
