[中文](WORKFLOW.md) | [English](WORKFLOW_EN.md)

---

# OpenCode Onprem Version Build Guide

This document describes how to apply modifications to a new opencode version and generate the corresponding onprem version.

## Applying Modifications with Git Patch (Recommended)

### Quick Apply (for 1.14.31)

```bash
# 1. Download new version source
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# 2. Initialize git (if not already a git repo)
git init && git add -A && git commit -m "init"

# 3. Apply patch
git apply /path/to/opencode-onprem-patch/patches/onprem-1.14.31.patch

# 4. If conflicts occur
# Check .rej files and merge manually
# Search for "// onprem-fork:" markers to confirm modification locations
```

### Or use the script

```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch File Descriptions

### onprem-1.14.31.patch

Consolidated patch for version 1.14.31, covering new functional modules, source modifications, and LSP/Tree-sitter offline support.

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
```

### 3. Package Offline Bundle

```bash
OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts
```

### 4. Deploy on an Offline Machine

```bash
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem
```

## Regenerating Patches After Version Upgrade

```bash
# In the modified repository
git add -A
git commit -m "onprem modifications for version x.x.x"

# Generate consolidated patch
git format-patch -1 --stdout > onprem-x.x.x.patch
```
