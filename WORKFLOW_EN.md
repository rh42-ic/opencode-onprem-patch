[中文](WORKFLOW.md) | [English](WORKFLOW_EN.md)

---

# OpenCode Onprem Build Guide

This document describes how to apply modifications to new OpenCode versions.

## Core Principles (Minimizing Upstream Touchpoints)

1. **Centralized Logic**: All core Onprem logic is located in `packages/opencode/src/onprem/`.
2. **Minimal Intrusion**: Add only a small amount of Guard code to the original source, marked with `// onprem-fork:`.
3. **Additive First**: Prefer implementing features via new files to minimize direct modifications to original files and reduce merge conflicts.

## Patch Application Workflow

### 1. Prepare Source
Ensure the `opencode` source is in a clean Git state.

### 2. Run Application Script
```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .
```
This script will:
- Copy new modules from `src/` to `packages/opencode/src/onprem/`.
- Copy build scripts to `script/`.
- Apply the Git patch from `patches/`.

## Development and Maintenance

### Updating Patches (When Upstream Changes)
1. Complete and verify modifications in the upstream directory.
2. Ensure all modifications are marked with the `// onprem-fork:` prefix.
3. Regenerate the patch: `git format-patch main --stdout > 0001-onprem-combined.patch`.
4. Sync `onprem/index.ts` to the `src/` directory.
5. Sync `download-onprem-deps.ts` and other scripts to the `scripts/` directory.

## Build Verification
```bash
# linux-x64-musl is recommended for best offline compatibility
bun run script/build.ts --platform=linux-x64-musl
```
