[中文](WORKFLOW.md) | [English](WORKFLOW_EN.md)

---

# OpenCode Onprem Version Build Guide

This document describes how to apply modifications to a new opencode version and generate the corresponding onprem version.

## Applying Modifications with Git Patch (Recommended)

### Quick Apply

```bash
# 1. Download new version source
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# 2. Initialize git (if not already a git repo)
git init && git add -A && git commit -m "init"

# 3. Apply patches
git apply /path/to/opencode-onprem-patch/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem-patch/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem-patch/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/parsers-config-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/plugins-onprem.patch

# 4. If conflicts occur
# Check .rej files and merge manually
# Search for "// onprem-fork:" markers to confirm modification locations
```

### Or use the script

```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch File Descriptions

### 0001-add-onprem-module-and-scripts.patch

New files, including core onprem module, pre-download and packaging scripts.

### 0002-modify-source-files.patch

Core source modifications, including environment variables, ripgrep, model loading, and Web UI serving.

### lsp-server-onprem.patch

Offline support for LSP servers.

### parsers-config-onprem.patch

Offline loading for Tree-sitter WASM and query files.

### plugins-onprem.patch

Offline plugin detection.

## Search Markers

All modifications use the `// onprem-fork:` comment prefix for easy discovery during future synchronizations:

```bash
grep -rn "onprem-fork" packages/opencode/src/
```

## Detailed Modification Descriptions (Reference for Manual Application)

### flag.ts

```typescript
// onprem-fork: onprem mode flags
export const OPENCODE_ONPREM_MODE = truthy("OPENCODE_ONPREM_MODE")
export const OPENCODE_ONPREM_DEPS_PATH = process.env["OPENCODE_ONPREM_DEPS_PATH"]
```

### onprem/index.ts

Core module providing:
- `isEnabled()` - Check if onprem mode is enabled
- `getDepsPath()` - Get dependency directory path
- `resolveBinary()` - Resolve binary file path
- `getOnpremBin()` - Map LSP/Binary names to their offline paths
- `tryServeStaticFile()` - Attempt to serve a static file

### ripgrep.ts

```typescript
// onprem-fork: check offline deps for bundled ripgrep binary
const onpremBin = Onprem.resolveBinary("rg" + (process.platform === "win32" ? ".exe" : ""), "ripgrep")
if (onpremBin) return { filepath: onpremBin }
```

### models.ts

Insert onprem check in `Data()` loading logic:
```typescript
// onprem-fork: try deps models.json from onprem bundle
if (Onprem.isOnpremMode()) {
  const depsPath = Onprem.getOnpremDepsPath()
  if (depsPath) {
    const offlineResult = await Filesystem.readJson(path.join(depsPath, "models.json")).catch(() => {})
    if (offlineResult) return offlineResult as Record<string, Provider>
  }
}
```

### server/routes/ui.ts

```typescript
// onprem-fork: serve bundled web app in onprem mode
const onpremStatic = await Onprem.tryServeStaticFile(c.req.path)
if (onpremStatic) {
  return new Response(onpremStatic.body, { headers: { "Content-Type": onpremStatic.mime } })
}
```

### lsp/server.ts

Add offline path checks for all supported LSPs:
```typescript
// onprem-fork: use offline binary if in onprem mode
if (isOnpremMode()) {
  const onpremBin = getOnpremBin("clangd")
  if (onpremBin) return spawn(onpremBin, args)
}
```

## Build Process

### 1. Configure Offline Plugins (Optional)

Edit `script/onprem-plugins.json`.

### 2. Pre-download Dependencies on a Networked Machine

```bash
cd opencode
bun install
bun run script/download-onprem-deps.ts
# To download dependencies for other target OSs/architectures (e.g. gnu, windows, macOS, arm64), use:
# bun run script/download-onprem-deps.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64,darwin-x64,darwin-arm64,linux-arm64-musl,linux-arm64-gnu
```

### 3. Package Offline Bundle

```bash
OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts
# To package multiple architecture combinations at once, supply them via comma-separated list:
# OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64,darwin-x64,darwin-arm64,linux-arm64-musl,linux-arm64-gnu
```

It is highly recommended to output a statically compiled Linux offline package via `musl` (`--platforms=linux-x64-musl`).

### 4. Deploy on an Offline Machine

```bash
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem
```

## Regenerating Patches after Version Upgrade

It is recommended to use `git format-patch` to regenerate the individual patches after verifying modifications on a new version.

