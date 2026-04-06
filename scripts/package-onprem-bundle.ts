#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"

// Dynamic based on platform
let DEPS_DIR = ""
let BUNDLE_BASE_NAME = ""

type BuildVariant = "normal" | "baseline"

async function buildAll(): Promise<void> {
  // Build handles all targets implicitly
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

async function findBuildDir(platform: string, variant: BuildVariant): Promise<string> {
  const distDir = "packages/opencode/dist"
  const entries = await fs.readdir(distDir)
  const baseName = platform === "windows-x64" ? "windows-x64" : "linux-x64"
  const targetName = variant === "baseline" ? `${baseName}-baseline` : baseName
  const matchDir = entries.find(e => 
    e.includes(targetName) && !e.includes("musl")
  )

  if (!matchDir) {
    throw new Error(`Could not find ${targetName} build output. Available: ${entries.join(", ")}`)
  }

  return path.join(distDir, matchDir)
}

async function createBundle(buildDir: string, platform: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = `${BUNDLE_BASE_NAME}${suffix}`
  const bundlePath = path.join("dist", BUNDLE_DIR)

  console.log(`\n=== Creating bundle (${variant}) ===`)

  await fs.rm(bundlePath, { recursive: true, force: true })
  await fs.mkdir(path.join(bundlePath, "bin"), { recursive: true })
  await fs.mkdir(path.join(bundlePath, "deps"), { recursive: true })

  console.log("Copying opencode binary...")
  const binName = platform === "windows-x64" ? "opencode.exe" : "opencode"
  const binaryPath = path.join(buildDir, "bin", binName)
  await fs.copyFile(binaryPath, path.join(bundlePath, "bin", binName))
  if (platform !== "windows-x64") await fs.chmod(path.join(bundlePath, "bin", binName), 0o755)

  console.log("Copying dependencies...")
  await $`cp -rL ${DEPS_DIR}/* ${path.join(bundlePath, "deps")}/`

  console.log("Copying OpenTUI native library...")
  const globPattern = platform === "windows-x64"
    ? "node_modules/.bun/@opentui+core-win32-x64@*/node_modules/@opentui/core-win32-x64/opentui.dll"
    : "node_modules/.bun/@opentui+core-linux-x64@*/node_modules/@opentui/core-linux-x64/libopentui.so"
  const opentuiGlob = new Bun.Glob(globPattern)
  const opentuiMatches = Array.from(opentuiGlob.scanSync({ dot: true }))
  if (opentuiMatches.length === 0) {
    throw new Error(`Could not find OpenTUI native library - ensure @opentui/core for ${platform} is installed`)
  }
  const opentuiSoPath = opentuiMatches[0]
  console.log(`Found OpenTUI at: ${opentuiSoPath}`)
  await fs.mkdir(path.join(bundlePath, "deps", "opentui"), { recursive: true })
  const soName = platform === "windows-x64" ? "opentui.dll" : "libopentui.so"
  await fs.copyFile(opentuiSoPath, path.join(bundlePath, "deps", "opentui", soName))

  console.log("Creating manifest...")
  const manifestContent = await fs.readFile(path.join(DEPS_DIR, "manifest.json"), "utf-8")
  const manifest = JSON.parse(manifestContent)
  manifest.baseline = variant === "baseline"
  await Bun.write(path.join(bundlePath, "manifest.json"), JSON.stringify(manifest, null, 2))

  console.log("Bundle created")
}

async function createWrapperScript(platform: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = path.join("dist", `${BUNDLE_BASE_NAME}${suffix}`)

  
  console.log("Creating wrapper script...")

  if (platform === "windows-x64") {
    const wrapperScript = `@echo off
REM OpenCode Onprem Wrapper Script
REM Sets up environment variables for onprem mode and runs opencode

set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

set OPENCODE_ONPREM_MODE=true
set OPENCODE_ONPREM_DEPS_PATH=%SCRIPT_DIR%\\deps
set OPENCODE_DISABLE_AUTOUPDATE=true
set OPENCODE_DISABLE_LSP_DOWNLOAD=true
set OPENCODE_DISABLE_MODELS_FETCH=true

"%SCRIPT_DIR%\\bin\\opencode.exe" %*
`
    await Bun.write(path.join(BUNDLE_DIR, "opencode-onprem.bat"), wrapperScript)
  } else {
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
}


async function createEnvFile(platform: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = path.join("dist", `${BUNDLE_BASE_NAME}${suffix}`)

  console.log("Creating env file...")

  if (platform === "windows-x64") return // No simple env file for Windows batch yet

  const envContent = `# OpenCode Onprem Environment Variables
# Source this file before running opencode:
#   source opencode-onprem.env
#   ./bin/opencode [args...]

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

export OPENCODE_ONPREM_MODE=true
export OPENCODE_ONPREM_DEPS_PATH="\$SCRIPT_DIR/deps"
export OPENCODE_DISABLE_AUTOUPDATE=true
export OPENCODE_DISABLE_LSP_DOWNLOAD=true
export OPENCODE_DISABLE_MODELS_FETCH=true
`

  await Bun.write(path.join(BUNDLE_DIR, "opencode-onprem.env"), envContent)
}

async function createReadme(platform: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = path.join("dist", `${BUNDLE_BASE_NAME}${suffix}`)

  console.log("Creating README...")

  const variantNote = variant === "baseline" 
    ? "\nThis is the **baseline** version for CPUs without AVX2 support.\n"
    : ""

const readme = `# OpenCode Onprem Bundle

This is a self-contained onprem bundle of OpenCode for ${platform}.
${variantNote}
## Contents

- \`bin/opencode\` - Main OpenCode binary
- \`deps/\` - Pre-bundled dependencies
  - \`ripgrep/\` - Ripgrep binary for fast file searching
  - \`lsp/\` - Language server binaries
    - \`clangd/\` - C/C++ language server
    - \`rust-analyzer/\` - Rust language server
    - \`zls/\` - Zig language server
    - \`lua-language-server/\` - Lua language server
    - \`terraform-ls/\` - Terraform language server
    - \`texlab/\` - LaTeX language server
    - \`tinymist/\` - Typst language server
    - \`kotlin-ls/\` - Kotlin language server
    - \`jdtls/\` - Java language server
    - \`vscode-eslint/\` - ESLint server
    - \`elixir-ls-master/\` - Elixir language server
  - \`node_modules/\` - npm packages for language servers
  - \`tree-sitter/\` - Tree-sitter parsers for syntax highlighting
    - \`wasm/\` - WASM parser files
    - \`queries/\` - Query files for highlights/locals
  - \`plugins/\` - Pre-installed plugins (optional)
    - \`package.json\`
    - \`node_modules/\`
  - \`app/\` - Pre-built web UI
  - \`models.json\` - Model metadata
  - \`opentui/\` - OpenTUI native library
- \`manifest.json\` - Version information for all bundled components
- \`opencode-onprem\` - Wrapper script that sets up the environment
- \`opencode-onprem.env\` - Environment file for sourcing into shell

## Usage

### Option 1: Use the wrapper script (recommended)

\`\`\`bash
./opencode-onprem
\`\`\`

### Option 2: Source environment file

\`\`\`bash
source opencode-onprem.env
./bin/opencode
\`\`\`

This is useful when you want to:
- Set additional environment variables before running
- Run opencode multiple times without restarting the shell
- Integrate with existing shell scripts or workflows

### Option 3: Set environment variables manually

\`\`\`bash
export OPENCODE_ONPREM_MODE=true
export OPENCODE_ONPREM_DEPS_PATH=/path/to/deps
./bin/opencode
\`\`\`

### Web UI

To start the web interface (served locally from the bundled app):

\`\`\`bash
./opencode-onprem web
# or
source opencode-onprem.env && ./bin/opencode web
\`\`\`

## Supported Languages

### Pre-bundled LSP (work offline)

These language servers are included and work without network access:

| Language | LSP |
|----------|-----|
| Python | Pyright |
| TypeScript/JavaScript | typescript-language-server |
| Vue | @vue/language-server |
| Svelte | svelte-language-server |
| Astro | @astrojs/language-server |
| PHP | intelephense |
| Bash | bash-language-server |
| YAML | yaml-language-server |
| Dockerfile | dockerfile-language-server-nodejs |
| C/C++ | clangd |
| Rust | rust-analyzer |
| Zig | zls |
| Lua | lua-language-server |
| Terraform/HCL | terraform-ls |
| LaTeX | texlab |
| Typst | tinymist |
| Kotlin | kotlin-ls |
| Java | jdtls |
| ESLint | vscode-eslint |
| Elixir | elixir-ls |
| Oxlint | oxlint |
| Biome | biome |
| Prisma | prisma |

### Requires language runtime

These LSPs require their respective language runtimes to be installed on the system:

| Language | LSP | Runtime Required |
|----------|-----|------------------|
| Go | gopls | Go |
| Java | jdtls | Java 21+ |
| Ruby | ruby-lsp/rubocop | Ruby |
| Elixir | elixir-ls | Elixir + mix |
| C# | csharp-ls | .NET SDK |
| F# | fsautocomplete | .NET SDK |
| Kotlin | kotlin-lsp | Kotlin |
| Dart | dart | Dart SDK |
| OCaml | ocamllsp | opam |
| Haskell | haskell-language-server | GHCup |
| Gleam | gleam | Gleam |
| Clojure | clojure-lsp | Clojure |
| Nix | nixd | Nix |

## Tree-sitter Parsers

This bundle includes tree-sitter WASM parsers for syntax highlighting:

\`\`\`
python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby,php, scala, html, hcl, json, yaml, haskell, css, julia, lua,ocaml, clojure, swift, toml, nix
\`\`\`

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`OPENCODE_ONPREM_MODE\` | Set to \`true\` to enable onprem mode |
| \`OPENCODE_ONPREM_DEPS_PATH\` | Path to the deps directory |
| \`OPENCODE_DISABLE_AUTOUPDATE\` | Set to \`true\` to disable auto-updates |
| \`OPENCODE_DISABLE_LSP_DOWNLOAD\` | Set to \`true\` to prevent LSP downloads |
| \`OPENCODE_DISABLE_MODELS_FETCH\` | Set to \`true\` to prevent fetching models from models.dev |

## Troubleshooting

### /tmp mounted with noexec
This bundle includes a pre-extracted OpenTUI native library in \`deps/opentui/\`.
When \`OPENCODE_ONPREM_DEPS_PATH\` is set (done automatically by the wrapper script),
the application will load this library directly, bypassing the /tmp extraction
that would otherwise fail on systems with noexec /tmp.

### Language server not found
Ensure the deps directory contains the required language server:
- Binary LSPs should be in \`deps/lsp/<name>/\`
- npm-based LSPs should be in \`deps/node_modules/<package>/\`

### Missing tree-sitter parser
Tree-sitter WASM files should be in \`deps/tree-sitter/wasm/\`.
Query files should be in \`deps/tree-sitter/queries/<language>/\`.
`

  await Bun.write(path.join(BUNDLE_DIR, "README.md"), readme)
}

async function createTarball(platform: string, variant: BuildVariant): Promise<void> {
  const suffix = variant === "baseline" ? "-baseline" : ""
  const BUNDLE_DIR = `${BUNDLE_BASE_NAME}${suffix}`
  
  const isWindows = platform === "windows-x64"
  const ext = isWindows ? ".7z" : ".tar.zst"
  const TARBALL_NAME = `${BUNDLE_DIR}${ext}`

  console.log(`\n=== Creating archive (${variant}) ===`)

  const tarballPath = path.join("dist", TARBALL_NAME)
  await fs.unlink(tarballPath).catch(() => {})

  const args = isWindows 
    ? ["7z", "a", "-t7z", "-mmt=on", TARBALL_NAME, BUNDLE_DIR]
    : ["tar", "--zstd", "-cf", TARBALL_NAME, BUNDLE_DIR]

  const proc = Bun.spawn(args, {
    cwd: "dist",
    stdout: "inherit",
    stderr: "inherit",
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error("Failed to create archive")
  }

  const stats = await fs.stat(tarballPath)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

  console.log(`Archive: dist/${TARBALL_NAME} (${sizeMB} MB)`)
}


async function main() {
  const args = process.argv.slice(2)
  const platformsArg = args.find(a => a.startsWith("--platforms="))
  const platforms = platformsArg ? platformsArg.split("=")[1].split(",") : ["linux-x64", "windows-x64"]

  console.log("=== OpenCode Onprem Bundle Packager ===")
  console.log(`Target platforms: ${platforms.join(", ")}`)

  // Verify all deps exist first
  for (const p of platforms) {
    const platform = p
    const depsDir = `dist/onprem-deps-${platform}`
    const depsExist = await fs.stat(depsDir).catch(() => null)
    if (!depsExist) {
      console.error(`Error: Dependencies not found at ${depsDir}`)
      console.error(`Please run 'bun run script/download-onprem-deps.ts --platforms=${p}' first`)
      process.exit(1)
    }
  }

  await buildAll()

  const variants: BuildVariant[] = ["normal", "baseline"]

  for (const p of platforms) {
    const platform = p
    BUNDLE_BASE_NAME = `opencode-onprem-${platform}`
    DEPS_DIR = `dist/onprem-deps-${platform}`

    for (const variant of variants) {
      const buildDir = await findBuildDir(platform, variant)
      console.log(`\nFound ${variant} build for ${platform}: ${buildDir}`)
      await createBundle(buildDir, platform, variant)
      await createWrapperScript(platform, variant)
      await createEnvFile(platform, variant)
      await createReadme(platform, variant)
      await createTarball(platform, variant)
    }
  }

  console.log("\n=== Packaging complete ===")
  console.log("\nBundles created:")
  for (const p of platforms) {
    const platform = p
    const baseName = `opencode-onprem-${platform}`
    const ext = platform === "windows-x64" ? ".7z" : ".tar.zst"
    for (const variant of variants) {
      const suffix = variant === "baseline" ? "-baseline" : ""
      const stats = await fs.stat(`dist/${baseName}${suffix}${ext}`).catch(() => null)
      if (stats) {
        const sizeMB = stats.size / (1024 * 1024)
        console.log(`  dist/${baseName}${suffix}${ext} (${sizeMB.toFixed(2)} MB)`)
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})