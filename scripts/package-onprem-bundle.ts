#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"

const DEPS_DIR = "dist/onprem-deps"
const BUNDLE_BASE_NAME = "opencode-onprem-linux-x64"

type BuildVariant = "normal" | "baseline"

async function buildAll(): Promise<void> {
  console.log("\n=== Building opencode (all targets) ===")

  console.log("Installing dependencies...")
  const installProc = Bun.spawn(["bun", "install"], {
    cwd: "packages/opencode",
    stdout: "inherit",
    stderr: "inherit",
  })
  await installProc.exited
  if (installProc.exitCode !== 0) {
    throw new Error("Failed to install dependencies")
  }

  const proc = Bun.spawn(["bun", "run", "./script/build.ts"], {
    cwd: "packages/opencode",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
    },
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error("Failed to build opencode")
  }

  console.log("Build complete")
}

async function findBuildDir(variant: BuildVariant): Promise<string> {
  const distDir = "packages/opencode/dist"
  const entries = await fs.readdir(distDir)
  const targetName = variant === "baseline" ? "linux-x64-baseline" : "linux-x64"
  const matchDir = entries.find(e => 
    e.includes(targetName) && !e.includes("musl")
  )

  if (!matchDir) {
    throw new Error(`Could not find ${targetName} build output. Available: ${entries.join(", ")}`)
  }

  return path.join(distDir, matchDir)
}

async function createBundle(buildDir: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = `${BUNDLE_BASE_NAME}${suffix}`
  const bundlePath = path.join("dist", BUNDLE_DIR)

  console.log(`\n=== Creating bundle (${variant}) ===`)

  await fs.rm(bundlePath, { recursive: true, force: true })
  await fs.mkdir(path.join(bundlePath, "bin"), { recursive: true })
  await fs.mkdir(path.join(bundlePath, "deps"), { recursive: true })

  console.log("Copying opencode binary...")
  const binaryPath = path.join(buildDir, "bin", "opencode")
  await fs.copyFile(binaryPath, path.join(bundlePath, "bin", "opencode"))
  await fs.chmod(path.join(bundlePath, "bin", "opencode"), 0o755)

  console.log("Copying dependencies...")
  await $`cp -r ${DEPS_DIR}/* ${path.join(bundlePath, "deps")}/`

  console.log("Copying OpenTUI native library...")
  const opentuiGlob = new Bun.Glob("node_modules/.bun/@opentui+core-linux-x64@*/node_modules/@opentui/core-linux-x64/libopentui.so")
  const opentuiMatches = Array.from(opentuiGlob.scanSync({ dot: true }))
  if (opentuiMatches.length === 0) {
    throw new Error("Could not find OpenTUI native library - ensure @opentui/core-linux-x64 is installed")
  }
  const opentuiSoPath = opentuiMatches[0]
  console.log(`Found OpenTUI at: ${opentuiSoPath}`)
  await fs.mkdir(path.join(bundlePath, "deps", "opentui"), { recursive: true })
  await fs.copyFile(opentuiSoPath, path.join(bundlePath, "deps", "opentui", "libopentui.so"))

  console.log("Creating manifest...")
  const manifestContent = await fs.readFile(path.join(DEPS_DIR, "manifest.json"), "utf-8")
  const manifest = JSON.parse(manifestContent)
  manifest.baseline = variant === "baseline"
  await Bun.write(path.join(bundlePath, "manifest.json"), JSON.stringify(manifest, null, 2))

  console.log("Bundle created")
}

async function createWrapperScript(variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = path.join("dist", `${BUNDLE_BASE_NAME}${suffix}`)

  console.log("Creating wrapper script...")

  const wrapperScript = `#!/bin/bash
# OpenCode Onprem Wrapper Script
# Sets up environment variables for onprem mode and runs opencode

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

export OPENCODE_ONPREM_MODE=true
export OPENCODE_ONPREM_DEPS_PATH="\$SCRIPT_DIR/deps"
export OPENCODE_DISABLE_AUTOUPDATE=true
export OPENCODE_DISABLE_LSP_DOWNLOAD=true
export OPENCODE_DISABLE_MODELS_FETCH=true

exec "\$SCRIPT_DIR/bin/opencode" "\$@"
`

  await Bun.write(path.join(BUNDLE_DIR, "opencode-onprem"), wrapperScript)
  await fs.chmod(path.join(BUNDLE_DIR, "opencode-onprem"), 0o755)
}

async function createReadme(variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = path.join("dist", `${BUNDLE_BASE_NAME}${suffix}`)

  console.log("Creating README...")

  const variantNote = variant === "baseline" 
    ? "\nThis is the **baseline** version for CPUs without AVX2 support.\n"
    : ""

  const readme = `# OpenCode Onprem Bundle

This is a self-contained onprem bundle of OpenCode for Linux x64.
${variantNote}
## Contents

- \`bin/opencode\` - Main OpenCode binary
- \`deps/\` - Pre-bundled dependencies
  - \`ripgrep/\` - Ripgrep binary for fast file searching
  - \`lsp/\` - Language server binaries
  - \`node_modules/\` - npm packages (pyright, typescript-language-server, etc.)
  - \`tree-sitter/\` - Tree-sitter parsers
  - \`app/\` - Pre-built web UI
  - \`models.json\` - Model metadata
  - \`opentui/\` - OpenTUI native library
- \`manifest.json\` - Version information for all bundled components
- \`opencode-onprem\` - Wrapper script that sets up the environment

## Usage

### Option 1: Use the wrapper script (recommended)

\`\`\`bash
./opencode-onprem
\`\`\`

### Web UI

To start the web interface (served locally from the bundled app):

\`\`\`bash
./opencode-onprem web
\`\`\`

### Option 2: Set environment variables manually

\`\`\`bash
export OPENCODE_ONPREM_MODE=true
export OPENCODE_ONPREM_DEPS_PATH=/path/to/deps
./bin/opencode
\`\`\`

## Supported Languages

This bundle includes LSP support for:
- **Python** - via Pyright
- **TypeScript/JavaScript** - via typescript-language-server
- **C/C++** - via clangd
- **Rust** - via rust-analyzer
- **Zig** - via zls
- **Lua** - via lua-language-server
- **Terraform** - via terraform-ls
- **LaTeX** - via texlab
- **Typst** - via tinymist
- And more...

## Environment Variables

- \`OPENCODE_ONPREM_MODE\` - Set to \`true\` to enable onprem mode
- \`OPENCODE_ONPREM_DEPS_PATH\` - Path to the deps directory
- \`OPENCODE_DISABLE_AUTOUPDATE\` - Set to \`true\` to disable auto-updates
- \`OPENCODE_DISABLE_LSP_DOWNLOAD\` - Set to \`true\` to prevent LSP downloads
- \`OPENCODE_DISABLE_MODELS_FETCH\` - Set to \`true\` to prevent fetching models from models.dev

## Troubleshooting

### /tmp mounted with noexec
This bundle includes a pre-extracted OpenTUI native library in \`deps/opentui/\`.
When \`OPENCODE_ONPREM_DEPS_PATH\` is set (done automatically by the wrapper script),
the application will load this library directly, bypassing the /tmp extraction
that would otherwise fail on systems with noexec /tmp.
`

  await Bun.write(path.join(BUNDLE_DIR, "README.md"), readme)
}

async function createTarball(variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = `${BUNDLE_BASE_NAME}${suffix}`
  const TARBALL_NAME = `${BUNDLE_DIR}.tar.zst`

  console.log(`\n=== Creating tarball (${variant}) ===`)

  const tarballPath = path.join("dist", TARBALL_NAME)
  await fs.unlink(tarballPath).catch(() => {})

  const proc = Bun.spawn(
    ["tar", "-I", "zstd -15 -T0", "-cf", TARBALL_NAME, BUNDLE_DIR],
    {
      cwd: "dist",
      stdout: "inherit",
      stderr: "inherit",
    }
  )
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error("Failed to create tarball")
  }

  const stats = await fs.stat(tarballPath)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

  console.log(`Tarball: dist/${TARBALL_NAME} (${sizeMB} MB)`)
}

async function main() {
  console.log("=== OpenCode Onprem Bundle Packager ===")

  const depsExist = await fs.stat(DEPS_DIR).catch(() => null)
  if (!depsExist) {
    console.error(`Error: Dependencies not found at ${DEPS_DIR}`)
    console.error("Please run 'bun run script/download-onprem-deps.ts' first")
    process.exit(1)
  }

  await buildAll()

  const variants: BuildVariant[] = ["normal", "baseline"]

  for (const variant of variants) {
    const buildDir = await findBuildDir(variant)
    console.log(`\nFound ${variant} build: ${buildDir}`)
    await createBundle(buildDir, variant)
    await createWrapperScript(variant)
    await createReadme(variant)
    await createTarball(variant)
  }

  console.log("\n=== Packaging complete ===")
  console.log("\nBundles created:")
  for (const variant of variants) {
    const suffix = variant === "baseline" ? "-baseline" : ""
    const sizeMB = (await fs.stat(`dist/${BUNDLE_BASE_NAME}${suffix}.tar.zst`)).size / (1024 * 1024)
    console.log(`  dist/${BUNDLE_BASE_NAME}${suffix}.tar.zst (${sizeMB.toFixed(2)} MB)`)
  }
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})