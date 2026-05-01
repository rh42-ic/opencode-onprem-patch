#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { execSync } from "child_process"

let DEPS_DIR = "dist/onprem-deps"
let TARGET_PLATFORM = "linux-x64"
let LIBC_TARGET = "musl"
const RIPGREP_VERSION = "15.1.0"
const CLANGD_VERSION = "22.1.0"

// Tree-sitter WASM versions and sources
const TREE_SITTER_PARSERS = [
  { name: "python", repo: "tree-sitter/tree-sitter-python", version: "v0.23.6" },
  { name: "rust", repo: "tree-sitter/tree-sitter-rust", version: "v0.24.0" },
  { name: "go", repo: "tree-sitter/tree-sitter-go", version: "v0.25.0" },
  { name: "cpp", repo: "tree-sitter/tree-sitter-cpp", version: "v0.23.4" },
  { name: "csharp", repo: "tree-sitter/tree-sitter-c-sharp", version: "v0.23.1", wasmName: "tree-sitter-c_sharp" },
  { name: "bash", repo: "tree-sitter/tree-sitter-bash", version: "v0.25.0" },
  { name: "c", repo: "tree-sitter/tree-sitter-c", version: "v0.24.1" },
  { name: "java", repo: "tree-sitter/tree-sitter-java", version: "v0.23.5" },
  { name: "kotlin", repo: "fwcd/tree-sitter-kotlin", version: "0.3.8" },
  { name: "ruby", repo: "tree-sitter/tree-sitter-ruby", version: "v0.23.1" },
  { name: "php", repo: "tree-sitter/tree-sitter-php", version: "v0.24.2" },
  { name: "scala", repo: "tree-sitter/tree-sitter-scala", version: "v0.24.0" },
  { name: "html", repo: "tree-sitter/tree-sitter-html", version: "v0.23.2" },
  { name: "hcl", repo: "tree-sitter-grammars/tree-sitter-hcl", version: "v1.2.0" },
  { name: "json", repo: "tree-sitter/tree-sitter-json", version: "v0.24.8" },
  { name: "yaml", repo: "tree-sitter-grammars/tree-sitter-yaml", version: "v0.7.2" },
  { name: "haskell", repo: "tree-sitter/tree-sitter-haskell", version: "v0.23.1" },
  { name: "css", repo: "tree-sitter/tree-sitter-css", version: "v0.25.0" },
  { name: "julia", repo: "tree-sitter/tree-sitter-julia", version: "v0.23.1" },
  { name: "lua", repo: "tree-sitter-grammars/tree-sitter-lua", version: "v0.5.0" },
  { name: "ocaml", repo: "tree-sitter/tree-sitter-ocaml", version: "v0.24.2" },
  { name: "clojure", repo: "anomalyco/tree-sitter-clojure", version: "v0.0.1" },
  { name: "swift", repo: "alex-pinkus/tree-sitter-swift", version: "0.7.1" },
  { name: "toml", repo: "tree-sitter-grammars/tree-sitter-toml", version: "v0.7.0" },
  { name: "nix", repo: "ast-grep/ast-grep.github.io", version: "static", wasmPath: "website/public/parsers/tree-sitter-nix.wasm", assetCommit: "40b84530640aa83a0d34a20a2b0623d7b8e5ea97" },
]

// Tree-sitter query sources
const TREE_SITTER_QUERIES: Record<string, { highlights: string[]; locals?: string[] }> = {
  python: {
    highlights: ["https://github.com/tree-sitter/tree-sitter-python/raw/refs/heads/master/queries/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/python/locals.scm"],
  },
  rust: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/rust/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/rust/locals.scm"],
  },
  go: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/go/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/go/locals.scm"],
  },
  cpp: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/cpp/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/cpp/locals.scm"],
  },
  csharp: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c_sharp/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c_sharp/locals.scm"],
  },
  bash: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/bash/highlights.scm"],
  },
  c: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c/locals.scm"],
  },
  java: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/java/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/java/locals.scm"],
  },
  kotlin: {
    highlights: ["https://raw.githubusercontent.com/fwcd/tree-sitter-kotlin/0.3.8/queries/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/master/queries/kotlin/locals.scm"],
  },
  ruby: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/ruby/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/ruby/locals.scm"],
  },
  php: {
    highlights: ["https://github.com/tree-sitter/tree-sitter-php/raw/refs/heads/master/queries/highlights.scm"],
  },
  scala: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/scala/highlights.scm"],
  },
  html: {
    highlights: ["https://github.com/tree-sitter/tree-sitter-html/raw/refs/heads/master/queries/highlights.scm"],
  },
  hcl: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/master/queries/hcl/highlights.scm"],
  },
  json: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/json/highlights.scm"],
  },
  yaml: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/yaml/highlights.scm"],
  },
  haskell: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/haskell/highlights.scm"],
  },
  css: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/css/highlights.scm"],
  },
  julia: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/julia/highlights.scm"],
  },
  lua: {
    highlights: ["https://raw.githubusercontent.com/tree-sitter-grammars/tree-sitter-lua/v0.5.0/queries/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/tree-sitter-grammars/tree-sitter-lua/v0.5.0/queries/locals.scm"],
  },
  ocaml: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/ocaml/highlights.scm"],
  },
  clojure: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/clojure/highlights.scm"],
  },
  swift: {
    highlights: ["https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/main/queries/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/swift/locals.scm"],
  },
  toml: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/master/queries/toml/highlights.scm"],
  },
  nix: {
    highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/nix/highlights.scm"],
    locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/nix/locals.scm"],
  },
}

interface Manifest {
  version: string
  created: string
  platform: string
  arch: string
  components: {
    ripgrep: string
    clangd: string
    rustAnalyzer: string
    zls?: string
    luaLs?: string
    terraformLs?: string
    texlab?: string
    tinymist?: string
    kotlin?: string
    jdtls?: string
    vscodeEslint?: string
    elixirLs?: string
    treeSitterWasm: string[]
    npmPackages: Record<string, string>
    plugins?: Record<string, string>
  }
}

interface PluginSpec {
  name: string
  version: string
  raw: string
}

async function loadPluginsConfig(): Promise<PluginSpec[]> {
  const configPath = path.join("script", "onprem-plugins.json")
  const config = await Bun.file(configPath).json().catch(() => ({ plugins: [] }))
  return parsePluginSpecifiers(config.plugins || [])
}

function parsePluginSpecifiers(specifiers: string[]): PluginSpec[] {
  const plugins: PluginSpec[] = []
  for (const spec of specifiers) {
    if (spec.startsWith("github:")) {
      const repo = spec.slice(7)
      plugins.push({ name: repo, version: spec, raw: spec })
      continue
    }
    const atIndex = spec.lastIndexOf("@")
    if (atIndex > 0) {
      const name = spec.slice(0, atIndex)
      const version = spec.slice(atIndex + 1)
      plugins.push({ name, version, raw: spec })
    } else {
      plugins.push({ name: spec, version: "latest", raw: spec + "@latest" })
    }
  }
  return plugins
}

async function installPlugins(plugins: PluginSpec[]): Promise<Record<string, string>> {
  if (plugins.length === 0) return {}
  console.log(`\n=== Installing ${plugins.length} plugins ===`)
  const pluginsDir = path.join(DEPS_DIR, "plugins")
  await fs.mkdir(pluginsDir, { recursive: true })
  const pkgJsonPath = path.join(pluginsDir, "package.json")
  await Bun.write(pkgJsonPath, JSON.stringify({ dependencies: {} }, null, 2))
  const versions: Record<string, string> = {}
  for (const plugin of plugins) {
    console.log(`Installing ${plugin.raw}...`)
    const proc = Bun.spawn(["bun", "add", "--cwd", pluginsDir, plugin.raw], { stdout: "inherit", stderr: "inherit" })
    await proc.exited
    const installedPkgJson = await Bun.file(pkgJsonPath).json()
    if (installedPkgJson.dependencies?.[plugin.name]) {
      versions[plugin.name] = installedPkgJson.dependencies[plugin.name]
    }
  }
  return versions
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url}...`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  await Bun.write(dest, await response.arrayBuffer())
}

async function extractTarGz(archivePath: string, destDir: string, stripComponents = 0): Promise<void> {
  const args = ["tar", "-xzf", archivePath, "-C", destDir]
  if (stripComponents > 0) args.push(`--strip-components=${stripComponents}`)
  const proc = Bun.spawn(args)
  await proc.exited
}

async function extractTarXz(archivePath: string, destDir: string, stripComponents = 0): Promise<void> {
  const args = ["tar", "-xJf", archivePath, "-C", destDir]
  if (stripComponents > 0) args.push(`--strip-components=${stripComponents}`)
  const proc = Bun.spawn(args)
  await proc.exited
}

async function extractZip(archive: string, dir: string) {
  const proc = Bun.spawn(["unzip", "-o", "-q", archive, "-d", dir])
  await proc.exited
}

async function downloadKotlin() {
  console.log("\n=== Downloading Kotlin Language Server ===")
  const ver = "262.4739.0"
  let url: string
  let ext: string
  if (TARGET_PLATFORM === "windows-x64") {
    url = `https://download-cdn.jetbrains.com/kotlin-lsp/${ver}/kotlin-server-${ver}.win.zip`
    ext = ".zip"
  } else if (TARGET_PLATFORM.includes("darwin")) {
    url = `https://download-cdn.jetbrains.com/kotlin-lsp/${ver}/kotlin-server-${ver}${TARGET_PLATFORM.includes("arm64") ? "-aarch64" : ""}.sit`
    ext = ".sit"
  } else {
    url = `https://download-cdn.jetbrains.com/kotlin-lsp/${ver}/kotlin-server-${ver}${TARGET_PLATFORM.includes("arm64") ? "-aarch64" : ""}.tar.gz`
    ext = ".tar.gz"
  }
  
  const dist = path.join(DEPS_DIR, "lsp", "kotlin-ls")
  await fs.mkdir(dist, { recursive: true })
  const archive = path.join(DEPS_DIR, `kotlin-ls${ext}`)
  try {
    await downloadFile(url, archive)
    if (ext === ".zip") await extractZip(archive, dist)
    else if (ext === ".tar.gz") await extractTarGz(archive, dist)
    else {
      // .sit is a StuffIt archive, but on macOS it might be handled by something else.
      // Actually, Standalone archives for macOS are .sit.
      // For onprem purposes, we might need a different approach for .sit if tar doesn't handle it.
      // But let's assume tar -xf might work if it's just a renamed archive or if we use a different tool.
      // Wait, .sit is NOT a standard unix format.
      console.log("WARNING: .sit archive format for macOS Kotlin LSP might require manual extraction.")
    }
    await fs.unlink(archive)
    const binName = TARGET_PLATFORM.includes("windows") ? "bin/intellij-server.exe" : "bin/intellij-server"
    if (!TARGET_PLATFORM.includes("windows")) {
      const binPath = path.join(dist, binName)
      if (await fs.stat(binPath).catch(() => null)) await fs.chmod(binPath, 0o755)
    }
    return ver
  } catch (err) {
    console.log(`Failed to download Kotlin LSP: ${err}`)
    return
  }
}

async function downloadJdtls() {
  console.log("\n=== Downloading JDTLS ===")
  const version = "1.58.0"
  const timestamp = "202604151538"
  const dist = path.join(DEPS_DIR, "lsp", "jdtls")
  await fs.mkdir(dist, { recursive: true })
  const url = `https://download.eclipse.org/jdtls/milestones/${version}/jdt-language-server-${version}-${timestamp}.tar.gz`
  const archive = path.join(DEPS_DIR, "jdtls.tar.gz")
  await downloadFile(url, archive)
  await extractTarGz(archive, dist)
  await fs.unlink(archive)
  return version
}

async function downloadEslint() {
  console.log("\n=== Downloading VS Code ESLint server ===")
  const version = "3.0.24" // Hardcoded stable version
  const url = `https://open-vsx.org/api/dbaeumer/vscode-eslint/${version}/file/dbaeumer.vscode-eslint-${version}.vsix`
  const archive = path.join(DEPS_DIR, "eslint.zip")
  await downloadFile(url, archive)
  const tempDir = path.join(DEPS_DIR, "lsp", "vscode-eslint-temp")
  await fs.mkdir(tempDir, { recursive: true })
  await extractZip(archive, tempDir)
  await fs.unlink(archive)
  const dist = path.join(DEPS_DIR, "lsp", "vscode-eslint")
  await fs.rename(path.join(tempDir, "extension"), dist)
  await fs.rm(tempDir, { recursive: true, force: true })
  return version
}

async function downloadElixir() {
  console.log("\n=== Downloading ElixirLS ===")
  const version = "v0.30.0"
  const url = `https://github.com/elixir-lsp/elixir-ls/releases/download/${version}/elixir-ls-${version}.zip`
  const archive = path.join(DEPS_DIR, "elixir-ls.zip")
  try {
    await downloadFile(url, archive)
    const dist = path.join(DEPS_DIR, "lsp", "elixir-ls-master")
    await fs.mkdir(dist, { recursive: true })
    await extractZip(archive, dist)
    await fs.unlink(archive)
    return version
  } catch (err) { return }
}

async function downloadLuaLanguageServer(): Promise<string | undefined> {
  console.log("\n=== Downloading Lua Language Server ===")
  let assetName: string
  if (TARGET_PLATFORM === "windows-x64") assetName = "win32-x64"
  else if (TARGET_PLATFORM === "darwin-x64") assetName = "darwin-x64"
  else if (TARGET_PLATFORM === "darwin-arm64") assetName = "darwin-arm64"
  else if (TARGET_PLATFORM === "linux-arm64") assetName = "linux-arm64"
  else assetName = "linux-x64"
  const ext = TARGET_PLATFORM.includes("windows") ? ".zip" : ".tar.gz"
  const tag = "3.18.2"
  const downloadUrl = `https://github.com/LuaLS/lua-language-server/releases/download/${tag}/lua-language-server-${tag}-${assetName}${ext}`
  const luaLsDir = path.join(DEPS_DIR, "lsp", "lua-language-server")
  try {
    await fs.mkdir(luaLsDir, { recursive: true })
    const archivePath = path.join(DEPS_DIR, `lua-ls${ext}`)
    await downloadFile(downloadUrl, archivePath)
    if (ext === ".zip") await extractZip(archivePath, luaLsDir)
    else await extractTarGz(archivePath, luaLsDir, 1)
    const binName = TARGET_PLATFORM.includes("windows") ? "lua-language-server.exe" : "lua-language-server"
    const binPath = path.join(luaLsDir, "bin", binName)
    if (!TARGET_PLATFORM.includes("windows") && await fs.stat(binPath).catch(() => null)) await fs.chmod(binPath, 0o755)
    await fs.unlink(archivePath)
    return tag
  } catch (err) { return }
}

async function downloadTerraformLs(): Promise<string | undefined> {
  console.log("\n=== Downloading Terraform LS ===")
  const version = "0.38.6"
  let os = TARGET_PLATFORM.includes("windows") ? "windows" : (TARGET_PLATFORM.includes("darwin") ? "darwin" : "linux")
  let arch = TARGET_PLATFORM.includes("arm64") ? "arm64" : "amd64"
  const url = `https://releases.hashicorp.com/terraform-ls/${version}/terraform-ls_${version}_${os}_${arch}.zip`
  const tfLsDir = path.join(DEPS_DIR, "lsp", "terraform-ls")
  try {
    await fs.mkdir(tfLsDir, { recursive: true })
    const archivePath = path.join(DEPS_DIR, "terraform-ls.zip")
    await downloadFile(url, archivePath)
    await extractZip(archivePath, tfLsDir)
    const binName = TARGET_PLATFORM.includes("windows") ? "terraform-ls.exe" : "terraform-ls"
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(tfLsDir, binName), 0o755)
    await fs.unlink(archivePath)
    return version
  } catch (err) { return }
}

async function downloadDeno(): Promise<string | undefined> {
  console.log("\n=== Downloading Deno ===")
  const version = "v2.7.14"
  let platform: string
  if (TARGET_PLATFORM === "windows-x64") platform = "x86_64-pc-windows-msvc"
  else if (TARGET_PLATFORM === "darwin-x64") platform = "x86_64-apple-darwin"
  else if (TARGET_PLATFORM === "darwin-arm64") platform = "aarch64-apple-darwin"
  else if (TARGET_PLATFORM === "linux-arm64") platform = "aarch64-unknown-linux-gnu"
  else platform = "x86_64-unknown-linux-gnu"
  const url = `https://github.com/denoland/deno/releases/download/${version}/deno-${platform}.zip`
  const archive = path.join(DEPS_DIR, "deno.zip")
  await downloadFile(url, archive)
  const dist = path.join(DEPS_DIR, "lsp", "deno")
  await fs.mkdir(dist, { recursive: true })
  await extractZip(archive, dist)
  await fs.unlink(archive)
  const binName = TARGET_PLATFORM.includes("windows") ? "deno.exe" : "deno"
  if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(dist, binName), 0o755).catch(() => {})
  return version
}

async function downloadRipgrep(): Promise<string> {
  console.log("\n=== Downloading ripgrep ===")
  const arch = TARGET_PLATFORM.includes("arm64") ? "aarch64" : "x86_64"
  const patterns = []
  if (TARGET_PLATFORM.includes("windows")) {
    patterns.push(`ripgrep-${RIPGREP_VERSION}-${arch}-pc-windows-msvc.zip`)
  } else if (TARGET_PLATFORM.includes("darwin")) {
    patterns.push(`ripgrep-${RIPGREP_VERSION}-${arch}-apple-darwin.tar.gz`)
    if (arch === "aarch64") patterns.push(`ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`)
  } else {
    const libc = LIBC_TARGET
    const otherLibc = libc === "musl" ? "gnu" : "musl"
    patterns.push(`ripgrep-${RIPGREP_VERSION}-${arch}-unknown-linux-${libc}.tar.gz`)
    patterns.push(`ripgrep-${RIPGREP_VERSION}-${arch}-unknown-linux-${otherLibc}.tar.gz`)
  }

  const ripgrepDir = path.join(DEPS_DIR, "ripgrep")
  await fs.mkdir(ripgrepDir, { recursive: true })

  for (const filename of patterns) {
    const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${filename}`
    const archivePath = path.join(DEPS_DIR, filename)
    try {
      await downloadFile(url, archivePath)
      if (filename.endsWith(".zip")) await extractZip(archivePath, ripgrepDir)
      else await extractTarGz(archivePath, ripgrepDir, 1)
      await fs.unlink(archivePath)
      if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(ripgrepDir, "rg"), 0o755)
      return RIPGREP_VERSION
    } catch (err) {
      console.log(`Failed to download ${filename}, trying next...`)
    }
  }
  throw new Error(`Failed to download ripgrep for ${TARGET_PLATFORM}`)
}

async function downloadClangd(): Promise<string> {
  console.log("\n=== Downloading clangd ===")
  const tag = CLANGD_VERSION
  if (TARGET_PLATFORM.includes("arm64") && !TARGET_PLATFORM.includes("darwin") && !TARGET_PLATFORM.includes("windows")) {
    console.log("WARNING: Official clangd does not provide arm64 linux binaries. Skipping.")
    return "skipped"
  }
  const targetName = TARGET_PLATFORM.includes("windows") ? "windows" : (TARGET_PLATFORM.includes("darwin") ? "mac" : "linux")
  const assetName = `clangd-${targetName}-${tag}.zip`
  const downloadUrl = `https://github.com/clangd/clangd/releases/download/${tag}/${assetName}`
  const archivePath = path.join(DEPS_DIR, assetName)
  const lspDir = path.join(DEPS_DIR, "lsp")
  try {
    await downloadFile(downloadUrl, archivePath)
    await extractZip(archivePath, lspDir)
    await fs.unlink(archivePath)
    const finalDir = path.join(lspDir, "clangd")
    await fs.rm(finalDir, { recursive: true, force: true })
    await fs.rename(path.join(lspDir, `clangd_${tag}`), finalDir)
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(finalDir, "bin", "clangd"), 0o755)
    return tag
  } catch (err) {
    console.log(`Failed to download clangd: ${err}. Skipping.`)
    return "skipped"
  }
}

async function downloadRustAnalyzer(): Promise<string> {
  console.log("\n=== Downloading rust-analyzer ===")
  const version = "2026-04-27"
  const arch = TARGET_PLATFORM.includes("arm64") ? "aarch64" : "x86_64"
  const patterns = []
  if (TARGET_PLATFORM === "windows-x64") patterns.push("rust-analyzer-x86_64-pc-windows-msvc.zip")
  else if (TARGET_PLATFORM.includes("darwin")) {
    patterns.push(`rust-analyzer-${arch}-apple-darwin.gz`)
    if (arch === "aarch64") patterns.push(`rust-analyzer-x86_64-apple-darwin.gz`)
  } else {
    const libc = LIBC_TARGET
    const otherLibc = libc === "musl" ? "gnu" : "musl"
    patterns.push(`rust-analyzer-${arch}-unknown-linux-${libc}.gz`)
    patterns.push(`rust-analyzer-${arch}-unknown-linux-${otherLibc}.gz`)
    if (arch === "aarch64") patterns.push(`rust-analyzer-x86_64-unknown-linux-${libc}.gz`)
  }

  const raDir = path.join(DEPS_DIR, "lsp", "rust-analyzer", "bin")
  await fs.mkdir(raDir, { recursive: true })

  for (const assetName of patterns) {
    const downloadUrl = `https://github.com/rust-lang/rust-analyzer/releases/download/${version}/${assetName}`
    const archivePath = path.join(DEPS_DIR, assetName)
    try {
      await downloadFile(downloadUrl, archivePath)
      if (assetName.endsWith(".zip")) await extractZip(archivePath, raDir)
      else {
        const proc = Bun.spawn(["gunzip", "-c", archivePath], { stdout: "pipe" })
        await Bun.write(path.join(raDir, "rust-analyzer"), await Bun.readableStreamToArrayBuffer(proc.stdout))
        await proc.exited
      }
      const binName = TARGET_PLATFORM.includes("windows") ? "rust-analyzer.exe" : "rust-analyzer"
      if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(raDir, binName), 0o755)
      await fs.unlink(archivePath)
      return version
    } catch (err) {
      console.log(`Failed to download ${assetName}, trying next...`)
    }
  }
  throw new Error(`Failed to download rust-analyzer for ${TARGET_PLATFORM}`)
}

async function downloadZls(): Promise<string | undefined> {
  console.log("\n=== Downloading ZLS ===")
  const version = "0.16.0"
  let assetName: string
  if (TARGET_PLATFORM === "windows-x64") assetName = `zls-x86_64-windows.zip`
  else if (TARGET_PLATFORM === "darwin-x64") assetName = `zls-x86_64-macos.tar.xz`
  else if (TARGET_PLATFORM === "darwin-arm64") assetName = `zls-aarch64-macos.tar.xz`
  else if (TARGET_PLATFORM === "linux-arm64") assetName = `zls-aarch64-linux.tar.xz`
  else assetName = `zls-x86_64-linux.tar.xz`
  const zlsDir = path.join(DEPS_DIR, "lsp", "zls", "bin")
  await fs.mkdir(zlsDir, { recursive: true })
  const archivePath = path.join(DEPS_DIR, assetName.endsWith(".zip") ? "zls.zip" : "zls.tar.xz")
  const downloadUrl = `https://github.com/zigtools/zls/releases/download/${version}/${assetName}`
  try {
    await downloadFile(downloadUrl, archivePath)
    if (assetName.endsWith(".zip")) await extractZip(archivePath, path.join(DEPS_DIR, "lsp", "zls"))
    else await extractTarXz(archivePath, path.join(DEPS_DIR, "lsp", "zls"))
    const binName = TARGET_PLATFORM.includes("windows") ? "zls.exe" : "zls"
    const finalPath = path.join(zlsDir, binName)
    const extractedPath = path.join(DEPS_DIR, "lsp", "zls", binName)
    if (await fs.stat(extractedPath).catch(() => null)) await fs.rename(extractedPath, finalPath)
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(finalPath, 0o755)
    await fs.unlink(archivePath)
    return version
  } catch (err) { return }
}

async function downloadLuaLanguageServer(): Promise<string | undefined> {
  console.log("\n=== Downloading Lua Language Server ===")
  let assetName: string
  if (TARGET_PLATFORM === "windows-x64") assetName = "win32-x64"
  else if (TARGET_PLATFORM === "darwin-x64") assetName = "darwin-x64"
  else if (TARGET_PLATFORM === "darwin-arm64") assetName = "darwin-arm64"
  else if (TARGET_PLATFORM === "linux-arm64") assetName = "linux-arm64"
  else assetName = "linux-x64"
  const ext = TARGET_PLATFORM.includes("windows") ? ".zip" : ".tar.gz"
  const tag = "3.18.2"
  const downloadUrl = `https://github.com/LuaLS/lua-language-server/releases/download/${tag}/lua-language-server-${tag}-${assetName}${ext}`
  const luaLsDir = path.join(DEPS_DIR, "lsp", "lua-language-server")
  try {
    await fs.mkdir(luaLsDir, { recursive: true })
    const archivePath = path.join(DEPS_DIR, `lua-ls${ext}`)
    await downloadFile(downloadUrl, archivePath)
    if (ext === ".zip") await extractZip(archivePath, luaLsDir)
    else await extractTarGz(archivePath, luaLsDir, 1)
    const binName = TARGET_PLATFORM.includes("windows") ? "lua-language-server.exe" : "lua-language-server"
    const binPath = path.join(luaLsDir, "bin", binName)
    if (!TARGET_PLATFORM.includes("windows") && await fs.stat(binPath).catch(() => null)) await fs.chmod(binPath, 0o755)
    await fs.unlink(archivePath)
    return tag
  } catch (err) { return }
}

async function downloadElixir() {
  console.log("\n=== Downloading ElixirLS ===")
  const version = "v0.30.0"
  const url = `https://github.com/elixir-lsp/elixir-ls/releases/download/${version}/elixir-ls-${version}.zip`
  const archive = path.join(DEPS_DIR, "elixir-ls.zip")
  try {
    await downloadFile(url, archive)
    const dist = path.join(DEPS_DIR, "lsp", "elixir-ls-master")
    await fs.mkdir(dist, { recursive: true })
    await extractZip(archive, dist)
    await fs.unlink(archive)
    return version
  } catch (err) { return }
}

async function downloadTerraformLs(): Promise<string | undefined> {
  console.log("\n=== Downloading Terraform LS ===")
  const version = "0.38.6"
  let os = TARGET_PLATFORM.includes("windows") ? "windows" : (TARGET_PLATFORM.includes("darwin") ? "darwin" : "linux")
  let arch = TARGET_PLATFORM.includes("arm64") ? "arm64" : "amd64"
  const url = `https://releases.hashicorp.com/terraform-ls/${version}/terraform-ls_${version}_${os}_${arch}.zip`
  const tfLsDir = path.join(DEPS_DIR, "lsp", "terraform-ls")
  try {
    await fs.mkdir(tfLsDir, { recursive: true })
    const archivePath = path.join(DEPS_DIR, "terraform-ls.zip")
    await downloadFile(url, archivePath)
    await extractZip(archivePath, tfLsDir)
    const binName = TARGET_PLATFORM.includes("windows") ? "terraform-ls.exe" : "terraform-ls"
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(tfLsDir, binName), 0o755)
    await fs.unlink(archivePath)
    return version
  } catch (err) { return }
}

async function downloadTexlab(): Promise<string | undefined> {
  console.log("\n=== Downloading TexLab ===")
  const version = "5.25.1"
  let assetName: string
  if (TARGET_PLATFORM.includes("windows")) assetName = `texlab-x86_64-windows.zip`
  else if (TARGET_PLATFORM === "darwin-x64") assetName = `texlab-x86_64-macos.tar.gz`
  else if (TARGET_PLATFORM === "darwin-arm64") assetName = `texlab-aarch64-macos.tar.gz`
  else if (TARGET_PLATFORM === "linux-arm64") assetName = `texlab-aarch64-linux.tar.gz`
  else assetName = LIBC_TARGET === "musl" ? `texlab-x86_64-alpine.tar.gz` : `texlab-x86_64-linux.tar.gz`
  const downloadUrl = `https://github.com/latex-lsp/texlab/releases/download/v${version}/${assetName}`
  const texlabDir = path.join(DEPS_DIR, "lsp", "texlab", "bin")
  try {
    await fs.mkdir(texlabDir, { recursive: true })
    const ext = assetName.endsWith(".zip") ? ".zip" : ".tar.gz"
    const archivePath = path.join(DEPS_DIR, `texlab${ext}`)
    await downloadFile(downloadUrl, archivePath)
    const tempDir = path.join(DEPS_DIR, "texlab_temp")
    await fs.mkdir(tempDir, { recursive: true })
    if (ext === ".zip") await extractZip(archivePath, tempDir)
    else await extractTarGz(archivePath, tempDir)
    const binName = TARGET_PLATFORM.includes("windows") ? "texlab.exe" : "texlab"
    const extractedBinary = path.join(tempDir, binName)
    if (await fs.stat(extractedBinary).catch(() => null)) await fs.rename(extractedBinary, path.join(texlabDir, binName))
    await fs.rm(tempDir, { recursive: true, force: true })
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(texlabDir, binName), 0o755)
    await fs.unlink(archivePath)
    return version
  } catch (err) { return }
}

async function downloadTinymist(): Promise<string | undefined> {
  console.log("\n=== Downloading Tinymist ===")
  const version = "v0.14.16"
  let assetName: string
  if (TARGET_PLATFORM.includes("windows")) assetName = `tinymist-x86_64-pc-windows-msvc.zip`
  else if (TARGET_PLATFORM === "darwin-x64") assetName = `tinymist-x86_64-apple-darwin.tar.gz`
  else if (TARGET_PLATFORM === "darwin-arm64") assetName = `tinymist-aarch64-apple-darwin.tar.gz`
  else if (TARGET_PLATFORM === "linux-arm64") assetName = `tinymist-aarch64-unknown-linux-${LIBC_TARGET}.tar.gz`
  else assetName = `tinymist-x86_64-unknown-linux-${LIBC_TARGET}.tar.gz`
  const downloadUrl = `https://github.com/Myriad-Dreamin/tinymist/releases/download/${version}/${assetName}`
  const tinymistDir = path.join(DEPS_DIR, "lsp", "tinymist", "bin")
  try {
    await fs.mkdir(tinymistDir, { recursive: true })
    const ext = assetName.endsWith(".zip") ? ".zip" : ".tar.gz"
    const archivePath = path.join(DEPS_DIR, `tinymist${ext}`)
    await downloadFile(downloadUrl, archivePath)
    const tempDir = path.join(DEPS_DIR, "tinymist_temp")
    await fs.mkdir(tempDir, { recursive: true })
    if (ext === ".zip") await extractZip(archivePath, tempDir)
    else await extractTarGz(archivePath, tempDir, 1)
    const binName = TARGET_PLATFORM.includes("windows") ? "tinymist.exe" : "tinymist"
    const extractedBinary = path.join(tempDir, binName)
    if (await fs.stat(extractedBinary).catch(() => null)) await fs.rename(extractedBinary, path.join(tinymistDir, binName))
    await fs.rm(tempDir, { recursive: true, force: true })
    if (!TARGET_PLATFORM.includes("windows")) await fs.chmod(path.join(tinymistDir, binName), 0o755)
    await fs.unlink(archivePath)
    return version
  } catch (err) { return }
}

async function downloadTreeSitterWasm(): Promise<string[]> {
  console.log("\n=== Downloading Tree-sitter WASM files ===")
  const wasmDir = path.join(DEPS_DIR, "tree-sitter", "wasm")
  await fs.mkdir(wasmDir, { recursive: true })
  const downloaded: string[] = []
  for (const parser of TREE_SITTER_PARSERS) {
    try {
      const wasmName = parser.wasmName || `tree-sitter-${parser.name}`
      const url = parser.wasmPath ? `https://github.com/${parser.repo}/raw/${parser.assetCommit}/${parser.wasmPath}` : `https://github.com/${parser.repo}/releases/download/${parser.version}/${wasmName}.wasm`
      await downloadFile(url, path.join(wasmDir, `${wasmName}.wasm`))
      downloaded.push(parser.name)
    } catch (err) { console.log(`Failed to download ${parser.name} WASM, skipping`) }
  }
  return downloaded
}

async function downloadTreeSitterQueries(): Promise<void> {
  console.log("\n=== Downloading Tree-sitter query files ===")
  for (const [lang, queries] of Object.entries(TREE_SITTER_QUERIES)) {
    const langDir = path.join(DEPS_DIR, "tree-sitter", "queries", lang)
    await fs.mkdir(langDir, { recursive: true })
    for (const url of queries.highlights || []) try { await downloadFile(url, path.join(langDir, "highlights.scm")) } catch (err) {}
    for (const url of queries.locals || []) try { await downloadFile(url, path.join(langDir, "locals.scm")) } catch (err) {}
  }
}

async function installNpmPackages(): Promise<Record<string, string>> {
  console.log("\n=== Installing npm packages ===")
  const pkgJsonPath = path.join(DEPS_DIR, "package.json")
  await Bun.write(pkgJsonPath, JSON.stringify({ dependencies: {} }, null, 2))
  const packages = ["pyright", "typescript", "typescript-language-server", "svelte-language-server", "@astrojs/language-server", "yaml-language-server", "dockerfile-language-server-nodejs", "@vue/language-server", "intelephense", "bash-language-server", "oxlint", "@biomejs/biome", "prisma"]
  const installCmd = ["bun", "add", "--cwd", DEPS_DIR]
  if (TARGET_PLATFORM === "windows-x64") installCmd.push("--os=win32", "--cpu=x64")
  else if (TARGET_PLATFORM.includes("darwin")) installCmd.push("--os=darwin", `--cpu=${TARGET_PLATFORM.includes("arm64") ? "arm64" : "x64"}`)
  else installCmd.push("--os=linux", `--cpu=${TARGET_PLATFORM.includes("arm64") ? "arm64" : "x64"}`)
  installCmd.push(...packages)
  const proc = Bun.spawn(installCmd, { stdout: "inherit", stderr: "inherit" })
  await proc.exited
  const pkgJson = await Bun.file(pkgJsonPath).json()
  const versions: Record<string, string> = {}
  for (const [pkg, version] of Object.entries(pkgJson.dependencies || {})) versions[pkg] = version as string
  return versions
}

async function createManifest(ripgrep: string, clangd: string, rustAnalyzer: string, zls: any, luaLs: any, terraformLs: any, texlab: any, tinymist: any, kotlin: any, jdtls: any, eslint: any, elixir: any, deno: any, treeSitterWasm: string[], npmVersions: any): Promise<void> {
  const manifest: Manifest = {
    version: "1.0.0", created: new Date().toISOString(), platform: TARGET_PLATFORM, arch: TARGET_PLATFORM.includes("arm64") ? "arm64" : "x64",
    components: { ripgrep, clangd, rustAnalyzer, zls, luaLs, terraformLs, texlab, tinymist, kotlin, jdtls, vscodeEslint: eslint, elixirLs: elixir, deno, treeSitterWasm, npmPackages: npmVersions },
  }
  await Bun.write(path.join(DEPS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2))
}

async function main() {
  const args = process.argv.slice(2)
  const pluginsOnly = args.includes("--plugins-only")
  const platformsArg = args.find(a => a.startsWith("--platforms="))
  if (!platformsArg && !pluginsOnly) console.log("No platforms specified. Defaulting to linux-x64-musl and windows-x64")
  const platformSpecs = platformsArg ? platformsArg.split("=")[1].split(",") : (pluginsOnly ? [] : ["linux-x64-musl", "windows-x64"])
  const targets = platformSpecs.map(spec => {
    if (spec === "windows-x64") return { platform: "windows-x64", libc: "msvc", suffix: "-windows-x64" }
    if (spec === "linux-x64-gnu") return { platform: "linux-x64", libc: "gnu", suffix: "-linux-x64-gnu" }
    if (spec === "linux-x64-musl") return { platform: "linux-x64", libc: "musl", suffix: "-linux-x64-musl" }
    if (spec === "linux-arm64-musl") return { platform: "linux-arm64", libc: "musl", suffix: "-linux-arm64-musl" }
    if (spec === "linux-arm64-gnu") return { platform: "linux-arm64", libc: "gnu", suffix: "-linux-arm64-gnu" }
    if (spec === "darwin-x64") return { platform: "darwin-x64", libc: "none", suffix: "-darwin-x64" }
    if (spec === "darwin-arm64") return { platform: "darwin-arm64", libc: "none", suffix: "-darwin-arm64" }
    process.exit(1)
  })

  for (const target of targets) {
    TARGET_PLATFORM = target.platform; LIBC_TARGET = target.libc; DEPS_DIR = `dist/onprem-deps${target.suffix}`
    if (pluginsOnly) {
      const pluginList = await loadPluginsConfig()
      const pluginVersions = await installPlugins(pluginList)
      const manifestPath = path.join(DEPS_DIR, "manifest.json")
      const manifest = await Bun.file(manifestPath).json().catch(() => ({ components: {} }))
      manifest.components.plugins = pluginVersions
      await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
      continue
    }
    await fs.rm(DEPS_DIR, { recursive: true, force: true })
    await fs.mkdir(DEPS_DIR, { recursive: true })
    const rg = await downloadRipgrep(), cd = await downloadClangd(), ra = await downloadRustAnalyzer(), z = await downloadZls(), l = await downloadLuaLanguageServer(), t = await downloadTerraformLs(), tx = await downloadTexlab(), tm = await downloadTinymist(), k = await downloadKotlin(), j = await downloadJdtls(), e = await downloadEslint(), el = await downloadElixir(), d = await downloadDeno(), ts = await downloadTreeSitterWasm()
    await downloadTreeSitterQueries()
    const npm = await installNpmPackages()
    await downloadFile("https://models.dev/api.json", path.join(DEPS_DIR, "models.json"))
    const appProc = Bun.spawn(["bun", "turbo", "build", "--filter=@opencode-ai/app"], { stdout: "inherit", stderr: "inherit" })
    await appProc.exited
    const appDist = path.join(DEPS_DIR, "app")
    await fs.mkdir(appDist, { recursive: true })
    await $`cp -r packages/app/dist/* ${appDist}/`
    await createManifest(rg, cd, ra, z, l, t, tx, tm, k, j, e, el, d, ts, npm)
    const pluginList = await loadPluginsConfig()
    const pluginVersions = await installPlugins(pluginList)
    if (Object.keys(pluginVersions).length > 0) {
      const manifestPath = path.join(DEPS_DIR, "manifest.json")
      const manifest = await Bun.file(manifestPath).json()
      manifest.components.plugins = pluginVersions
      await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
    }
  }
}
main().catch(err => { console.error(err); process.exit(1) })
