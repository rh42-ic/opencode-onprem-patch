#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"

let DEPS_DIR = "dist/onprem-deps"
let TARGET_PLATFORM = "linux-x64"
const RIPGREP_VERSION = "14.1.1"

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
  if (plugins.length === 0) {
    console.log("No plugins configured")
    return {}
  }

  console.log(`\n=== Installing ${plugins.length} plugins ===`)

  const pluginsDir = path.join(DEPS_DIR, "plugins")
  await fs.mkdir(pluginsDir, { recursive: true })

  const pkgJsonPath = path.join(pluginsDir, "package.json")
  await Bun.write(pkgJsonPath, JSON.stringify({ dependencies: {} }, null, 2))

  const versions: Record<string, string> = {}

  for (const plugin of plugins) {
    console.log(`Installing ${plugin.raw}...`)

    const proc = Bun.spawn(["bun", "add", "--cwd", pluginsDir, plugin.raw], {
      stdout: "inherit",
      stderr: "inherit",
    })
    await proc.exited

    if (proc.exitCode !== 0) {
      console.log(`Failed to install ${plugin.raw}, skipping`)
      continue
    }

    const installedPkgJson = await Bun.file(pkgJsonPath).json()
    if (installedPkgJson.dependencies?.[plugin.name]) {
      versions[plugin.name] = installedPkgJson.dependencies[plugin.name]
    }
  }

  console.log(`Installed ${Object.keys(versions).length} plugins`)
  return versions
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url}...`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = await response.arrayBuffer()
  await Bun.write(dest, buffer)
  console.log(`Downloaded to ${dest}`)
}

async function extractTarGz(archivePath: string, destDir: string, stripComponents = 0): Promise<void> {
  const args = ["tar", "-xzf", archivePath, "-C", destDir]
  if (stripComponents > 0) {
    args.push(`--strip-components=${stripComponents}`)
  }
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to extract ${archivePath}`)
  }
}

async function extractTarXz(archivePath: string, destDir: string, stripComponents = 0): Promise<void> {
  const args = ["tar", "-xJf", archivePath, "-C", destDir]
  if (stripComponents > 0) {
    args.push(`--strip-components=${stripComponents}`)
  }
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to extract ${archivePath}`)
  }
}

async function extractZip(archive: string, dir: string) {
  const proc = Bun.spawn(["unzip", "-o", "-q", archive, "-d", dir], {
    stdout: "pipe",
    stderr: "pipe",
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error(`Failed to extract ${archive}`)
  }
}

async function downloadKotlin() {
  console.log("\n=== Downloading Kotlin Language Server ===")

  try {
    const res = await fetch("https://api.github.com/repos/Kotlin/kotlin-lsp/releases/latest")
    if (!res.ok) return
    const release = await res.json() as { name: string }
    const ver = release.name.replace(/^v/, "")
    const url = `https://download-cdn.jetbrains.com/kotlin-lsp/${ver}/kotlin-lsp-${ver}-linux-x64.zip`
    const dist = path.join(DEPS_DIR, "lsp", "kotlin-ls")
    await fs.mkdir(dist, { recursive: true })
    const archive = path.join(DEPS_DIR, "kotlin-ls.zip")
    await downloadFile(url, archive)
    await extractZip(archive, dist)
    await fs.unlink(archive)
    await fs.chmod(path.join(dist, "kotlin-lsp.sh"), 0o755).catch(() => {})
    return ver
  } catch (err) {
    return
  }
}

async function downloadJdtls() {
  console.log("\n=== Downloading JDTLS (Java Language Server) ===")

  try {
    const dist = path.join(DEPS_DIR, "lsp", "jdtls")
    await fs.mkdir(dist, { recursive: true })
    const url = "https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz"
    const archive = path.join(DEPS_DIR, "jdtls.tar.gz")
    await downloadFile(url, archive)
    await extractTarGz(archive, dist)
    await fs.unlink(archive)
    return "latest"
  } catch (err) {
    return
  }
}

async function downloadEslint() {
  console.log("\n=== Downloading VS Code ESLint server ===")

  try {
    const url = "https://open-vsx.org/api/dbaeumer/vscode-eslint/linux-x64/2.4.4/file" // fallback or dynamic, let's use the main latest vsix
    const res = await fetch("https://open-vsx.org/api/dbaeumer/vscode-eslint/latest")
    const data = await res.json()
    const downloadUrl = data.files.download
    const archive = path.join(DEPS_DIR, "eslint.zip")
    await downloadFile(downloadUrl, archive)
    const tempDir = path.join(DEPS_DIR, "lsp", "vscode-eslint-temp")
    await fs.mkdir(tempDir, { recursive: true })
    await extractZip(archive, tempDir)
    await fs.unlink(archive)
    const dist = path.join(DEPS_DIR, "lsp", "vscode-eslint")
    await fs.rename(path.join(tempDir, "extension"), dist)
    await fs.rm(tempDir, { recursive: true, force: true })
    return data.version
  } catch (err) {
    return
  }
}

async function downloadElixir() {
  console.log("\n=== Downloading ElixirLS ===")

  try {
    const res = await fetch("https://api.github.com/repos/elixir-lsp/elixir-ls/releases/latest")
    if (!res.ok) return
    const release = await res.json()
    const asset = release.assets.find((a: any) => a.name.endsWith(".zip"))
    if (!asset) return
    const archive = path.join(DEPS_DIR, "elixir-ls.zip")
    await downloadFile(asset.browser_download_url, archive)
    const dist = path.join(DEPS_DIR, "lsp", "elixir-ls-master")
    await fs.mkdir(dist, { recursive: true })
    await extractZip(archive, dist)
    await fs.unlink(archive)
    return release.tag_name
  } catch (err) {
    return
  }
}

async function downloadRipgrep(): Promise<string> {
  console.log("\n=== Downloading ripgrep ===")
  const platform = TARGET_PLATFORM === "windows-x64" ? "x86_64-pc-windows-msvc" : "x86_64-unknown-linux-musl"
  const filename = TARGET_PLATFORM === "windows-x64" 
    ? `ripgrep-${RIPGREP_VERSION}-${platform}.zip`
    : `ripgrep-${RIPGREP_VERSION}-${platform}.tar.gz`
  const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${filename}`

  const ripgrepDir = path.join(DEPS_DIR, "ripgrep")
  await fs.mkdir(ripgrepDir, { recursive: true })

  const archivePath = path.join(DEPS_DIR, filename)
  await downloadFile(url, archivePath)

  if (TARGET_PLATFORM === "windows-x64") {
    await extractZip(archivePath, ripgrepDir)
  } else {
    await extractTarGz(archivePath, ripgrepDir, 1)
  }
  await fs.unlink(archivePath)

  if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(path.join(ripgrepDir, "rg"), 0o755)

  console.log("Ripgrep downloaded successfully")
  return RIPGREP_VERSION
}

async function downloadClangd(): Promise<string> {
  console.log("\n=== Downloading clangd ===")

  const releaseResponse = await fetch("https://api.github.com/repos/clangd/clangd/releases/latest")
  if (!releaseResponse.ok) {
    throw new Error("Failed to fetch clangd release info")
  }
  const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
  const tag = release.tag_name

  const targetName = TARGET_PLATFORM === "windows-x64" ? "windows" : "linux"
  const asset = release.assets.find(a => a.name.includes(targetName) && a.name.includes(tag) && a.name.endsWith(".zip"))
  if (!asset) {
    throw new Error(`Could not find clangd ${targetName} asset`)
  }

  const clangdDir = path.join(DEPS_DIR, "lsp", "clangd")
  await fs.mkdir(clangdDir, { recursive: true })

  const archivePath = path.join(DEPS_DIR, asset.name)
  await downloadFile(asset.browser_download_url, archivePath)

  await extractZip(archivePath, path.join(DEPS_DIR, "lsp"))
  await fs.unlink(archivePath)

  const extractedDir = path.join(DEPS_DIR, "lsp", `clangd_${tag}`)
  const finalDir = path.join(DEPS_DIR, "lsp", "clangd")

  await fs.rm(finalDir, { recursive: true, force: true })
  await fs.rename(extractedDir, finalDir)

  if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(path.join(finalDir, "bin", "clangd"), 0o755)

  console.log(`Clangd ${tag} downloaded successfully`)
  return tag
}

async function downloadRustAnalyzer(): Promise<string> {
  console.log("\n=== Downloading rust-analyzer ===")

  const mirrorUrl = process.env.RUST_ANALYZER_MIRROR_URL
  let downloadUrl: string
  let tag: string

  if (mirrorUrl) {
    downloadUrl = mirrorUrl
    tag = "mirror"
  } else {
    const releaseResponse = await fetch("https://api.github.com/repos/rust-lang/rust-analyzer/releases/latest")
    if (!releaseResponse.ok) {
      throw new Error("Failed to fetch rust-analyzer release info")
    }
    const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    tag = release.tag_name

    const assetName = TARGET_PLATFORM === "windows-x64" ? "rust-analyzer-x86_64-pc-windows-msvc.zip" : "rust-analyzer-x86_64-unknown-linux-gnu.gz"
    const asset = release.assets.find(a => a.name === assetName)
    if (!asset) {
      throw new Error(`Could not find rust-analyzer ${assetName} asset`)
    }
    downloadUrl = asset.browser_download_url
  }

  const raDir = path.join(DEPS_DIR, "lsp", "rust-analyzer", "bin")
  await fs.mkdir(raDir, { recursive: true })

  const archiveExt = TARGET_PLATFORM === "windows-x64" ? ".zip" : ".gz"
  const archivePath = path.join(DEPS_DIR, `rust-analyzer${archiveExt}`)
  await downloadFile(downloadUrl, archivePath)

  if (TARGET_PLATFORM === "windows-x64") {
    await extractZip(archivePath, raDir)
  } else {
    const proc = Bun.spawn(["gunzip", "-c", archivePath], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const binaryData = await Bun.readableStreamToArrayBuffer(proc.stdout)
    await proc.exited
    if (proc.exitCode !== 0) {
      throw new Error("Failed to extract rust-analyzer")
    }

    const binaryPath = path.join(raDir, "rust-analyzer")
    await Bun.write(binaryPath, binaryData)
  }

  const binaryPath = path.join(raDir, TARGET_PLATFORM === "windows-x64" ? "rust-analyzer.exe" : "rust-analyzer")
  if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(binaryPath, 0o755)

  await fs.unlink(archivePath)

  console.log(`rust-analyzer ${tag} downloaded successfully`)
  return tag
}

async function downloadZls(): Promise<string | undefined> {
  console.log("\n=== Downloading ZLS (Zig Language Server) ===")

  try {
    const releaseResponse = await fetch("https://api.github.com/repos/zigtools/zls/releases/latest")
    if (!releaseResponse.ok) {
      console.log("Failed to fetch zls release info, skipping")
      return undefined
    }
    const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const tag = release.tag_name

    const assetName = TARGET_PLATFORM === "windows-x64" ? "zls-x86_64-windows.zip" : "zls-x86_64-linux.tar.xz"
    const asset = release.assets.find((a: any) => a.name === assetName)
    if (!asset) {
      console.log(`Could not find ZLS ${assetName} asset, skipping`)
      return undefined
    }

    const zlsDir = path.join(DEPS_DIR, "lsp", "zls", "bin")
    await fs.mkdir(zlsDir, { recursive: true })

    const archiveExt = TARGET_PLATFORM === "windows-x64" ? ".zip" : ".tar.xz"
    const archivePath = path.join(DEPS_DIR, `zls${archiveExt}`)
    await downloadFile(asset.browser_download_url, archivePath)

    if (TARGET_PLATFORM === "windows-x64") {
      await extractZip(archivePath, path.join(DEPS_DIR, "lsp", "zls"))
    } else {
      await extractTarXz(archivePath, path.join(DEPS_DIR, "lsp", "zls"))
    }

    const binaryPath = path.join(DEPS_DIR, "lsp", "zls", TARGET_PLATFORM === "windows-x64" ? "zls.exe" : "zls")
    const finalPath = path.join(zlsDir, TARGET_PLATFORM === "windows-x64" ? "zls.exe" : "zls")
    
    if (await fs.stat(binaryPath).catch(() => null)) {
      await fs.rename(binaryPath, finalPath)
    }
    
    if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(finalPath, 0o755)
    await fs.unlink(archivePath)

    console.log(`ZLS ${tag} downloaded successfully`)
    return tag
  } catch (err) {
    console.log(`ZLS download failed, skipping: ${err}`)
    return undefined
  }
}

async function downloadLuaLanguageServer(): Promise<string | undefined> {
  console.log("\n=== Downloading Lua Language Server ===")

  try {
    const releaseResponse = await fetch("https://api.github.com/repos/LuaLS/lua-language-server/releases/latest")
    if (!releaseResponse.ok) {
      console.log("Failed to fetch lua-language-server release info, skipping")
      return undefined
    }
    const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const tag = release.tag_name

    const assetName = TARGET_PLATFORM === "windows-x64" ? "win32-x64" : "linux-x64"
    const assetExt = TARGET_PLATFORM === "windows-x64" ? ".zip" : ".tar.gz"
    const asset = release.assets.find((a: any) => a.name.includes(assetName) && a.name.endsWith(assetExt))
    if (!asset) {
      console.log(`Could not find Lua LS ${assetName} asset, skipping`)
      return undefined
    }

    const luaLsDir = path.join(DEPS_DIR, "lsp", "lua-language-server")
    await fs.mkdir(luaLsDir, { recursive: true })

    const archivePath = path.join(DEPS_DIR, `lua-language-server${assetExt}`)
    await downloadFile(asset.browser_download_url, archivePath)

    if (TARGET_PLATFORM === "windows-x64") {
      await extractZip(archivePath, luaLsDir)
    } else {
      await extractTarGz(archivePath, luaLsDir, 1)
    }

    // The binary is at root level, make it executable
    const binName = TARGET_PLATFORM === "windows-x64" ? "lua-language-server.exe" : "lua-language-server"
    const binPath = path.join(luaLsDir, "bin", binName)
    const rootBinaryPath = path.join(luaLsDir, binName)
    
    // Check both locations for the binary
    if (TARGET_PLATFORM !== "windows-x64" && await fs.stat(binPath).catch(() => null)) {
      if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(binPath, 0o755)
    } else if (TARGET_PLATFORM !== "windows-x64" && await fs.stat(rootBinaryPath).catch(() => null)) {
      await fs.chmod(rootBinaryPath, 0o755)
    }

    await fs.unlink(archivePath)

    console.log(`Lua Language Server ${tag} downloaded successfully`)
    return tag
  } catch (err) {
    console.log(`Lua LS download failed, skipping: ${err}`)
    return undefined
  }
}

async function downloadTerraformLs(): Promise<string | undefined> {
  console.log("\n=== Downloading Terraform Language Server ===")

  try {
    const releaseResponse = await fetch("https://api.releases.hashicorp.com/v1/releases/terraform-ls/latest")
    if (!releaseResponse.ok) {
      console.log("Failed to fetch terraform-ls release info, skipping")
      return undefined
    }
    const release = await releaseResponse.json() as { version: string; builds: { arch: string; os: string; url: string }[] }

    const targetOs = TARGET_PLATFORM === "windows-x64" ? "windows" : "linux"
    const build = release.builds.find((b: any) => b.os === targetOs && b.arch === "amd64")
    if (!build) {
      console.log(`Could not find terraform-ls ${targetOs} asset, skipping`)
      return undefined
    }

    const tfLsDir = path.join(DEPS_DIR, "lsp", "terraform-ls")
    await fs.mkdir(tfLsDir, { recursive: true })

    const archivePath = path.join(DEPS_DIR, "terraform-ls.zip")
    await downloadFile(build.url, archivePath)

    await extractZip(archivePath, tfLsDir)

    const binPath = path.join(tfLsDir, TARGET_PLATFORM === "windows-x64" ? "terraform-ls.exe" : "terraform-ls")
    await fs.chmod(binPath, 0o755)

    await fs.unlink(archivePath)

    console.log(`Terraform LS ${release.version} downloaded successfully`)
    return release.version
  } catch (err) {
    console.log(`Terraform LS download failed, skipping: ${err}`)
    return undefined
  }
}

async function downloadTexlab(): Promise<string | undefined> {
  console.log("\n=== Downloading TexLab (LaTeX Language Server) ===")

  try {
    const releaseResponse = await fetch("https://api.github.com/repos/latex-lsp/texlab/releases/latest")
    if (!releaseResponse.ok) {
      console.log("Failed to fetch texlab release info, skipping")
      return undefined
    }
    const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const tag = release.tag_name

    const assetName = TARGET_PLATFORM === "windows-x64" ? "texlab-x86_64-windows.zip" : "texlab-x86_64-linux.tar.gz"
    const asset = release.assets.find((a: any) => a.name === assetName)
    if (!asset) {
      console.log(`Could not find TexLab ${assetName} asset, skipping`)
      return undefined
    }

    const texlabDir = path.join(DEPS_DIR, "lsp", "texlab", "bin")
    await fs.mkdir(texlabDir, { recursive: true })

    const archivePath = path.join(DEPS_DIR, TARGET_PLATFORM === "windows-x64" ? "texlab.zip" : "texlab.tar.gz")
    await downloadFile(asset.browser_download_url, archivePath)

    // Extract to temp dir first
    const tempDir = path.join(DEPS_DIR, "texlab_temp")
    await fs.mkdir(tempDir, { recursive: true })
    if (TARGET_PLATFORM === "windows-x64") {
      await extractZip(archivePath, tempDir)
    } else {
      await extractTarGz(archivePath, tempDir)
    }

    // Move binary to bin directory
    const binName = TARGET_PLATFORM === "windows-x64" ? "texlab.exe" : "texlab"
    const extractedBinary = path.join(tempDir, binName)
    const finalBinary = path.join(texlabDir, binName)
    if (await fs.stat(extractedBinary).catch(() => null)) {
      await fs.rename(extractedBinary, finalBinary)
    }

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true })
    if (TARGET_PLATFORM !== "windows-x64") if (TARGET_PLATFORM !== "windows-x64") await fs.chmod(finalBinary, 0o755)
    await fs.unlink(archivePath)

    console.log(`TexLab ${tag} downloaded successfully`)
    return tag
  } catch (err) {
    console.log(`TexLab download failed, skipping: ${err}`)
    return undefined
  }
}

async function downloadTinymist(): Promise<string | undefined> {
  console.log("\n=== Downloading Tinymist (Typst Language Server) ===")

  try {
    const releaseResponse = await fetch("https://api.github.com/repos/Myriad-Dreamin/tinymist/releases/latest")
    if (!releaseResponse.ok) {
      console.log("Failed to fetch tinymist release info, skipping")
      return undefined
    }
    const release = await releaseResponse.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const tag = release.tag_name

    const assetName = TARGET_PLATFORM === "windows-x64" ? "tinymist-x86_64-pc-windows-msvc.zip" : "tinymist-x86_64-unknown-linux-gnu.tar.gz"
    const asset = release.assets.find((a: any) => a.name === assetName)
    if (!asset) {
      console.log(`Could not find Tinymist ${assetName} asset, skipping`)
      return undefined
    }

    const tinymistDir = path.join(DEPS_DIR, "lsp", "tinymist", "bin")
    await fs.mkdir(tinymistDir, { recursive: true })

    const archivePath = path.join(DEPS_DIR, TARGET_PLATFORM === "windows-x64" ? "tinymist.zip" : "tinymist.tar.gz")
    await downloadFile(asset.browser_download_url, archivePath)

    // Extract to temp dir first
    const tempDir = path.join(DEPS_DIR, "tinymist_temp")
    await fs.mkdir(tempDir, { recursive: true })
    if (TARGET_PLATFORM === "windows-x64") {
      await extractZip(archivePath, tempDir)
    } else {
      await extractTarGz(archivePath, tempDir, 1)
    } // strip-components=1 to get past the tinymist-xxx directory

    // Find and move the binary
    const binName = TARGET_PLATFORM === "windows-x64" ? "tinymist.exe" : "tinymist"
    const extractedBinary = path.join(tempDir, binName)
    const finalBinary = path.join(tinymistDir, binName)
    if (await fs.stat(extractedBinary).catch(() => null)) {
      await fs.rename(extractedBinary, finalBinary)
    }

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true })
    await fs.chmod(finalBinary, 0o755)
    await fs.unlink(archivePath)

    console.log(`Tinymist ${tag} downloaded successfully`)
    return tag
  } catch (err) {
    console.log(`Tinymist download failed, skipping: ${err}`)
    return undefined
  }
}

async function downloadTreeSitterWasm(): Promise<string[]> {
  console.log("\n=== Downloading Tree-sitter WASM files ===")

  const wasmDir = path.join(DEPS_DIR, "tree-sitter", "wasm")
  await fs.mkdir(wasmDir, { recursive: true })

  const downloaded: string[] = []

  for (const parser of TREE_SITTER_PARSERS) {
    try {
      const wasmName = parser.wasmName || `tree-sitter-${parser.name}`
      const destPath = path.join(wasmDir, `${wasmName}.wasm`)

      let url: string
      if (parser.wasmPath) {
        // Special case for nix
        url = `https://github.com/${parser.repo}/raw/${parser.assetCommit}/${parser.wasmPath}`
      } else {
        url = `https://github.com/${parser.repo}/releases/download/${parser.version}/${wasmName}.wasm`
      }

      await downloadFile(url, destPath)
      downloaded.push(parser.name)
    } catch (err) {
      console.log(`Failed to download ${parser.name} WASM, skipping: ${err}`)
    }
  }

  console.log(`Downloaded ${downloaded.length} tree-sitter WASM files`)
  return downloaded
}

async function downloadTreeSitterQueries(): Promise<void> {
  console.log("\n=== Downloading Tree-sitter query files ===")

  for (const [lang, queries] of Object.entries(TREE_SITTER_QUERIES)) {
    const langDir = path.join(DEPS_DIR, "tree-sitter", "queries", lang)
    await fs.mkdir(langDir, { recursive: true })

    for (const url of queries.highlights || []) {
      try {
        const destPath = path.join(langDir, "highlights.scm")
        await downloadFile(url, destPath)
      } catch (err) {
        console.log(`Failed to download ${lang} highlights.scm: ${err}`)
      }
    }

    for (const url of queries.locals || []) {
      try {
        const destPath = path.join(langDir, "locals.scm")
        await downloadFile(url, destPath)
      } catch (err) {
        console.log(`Failed to download ${lang} locals.scm: ${err}`)
      }
    }
  }

  console.log("Tree-sitter query files downloaded")
}

async function installNpmPackages(): Promise<Record<string, string>> {
  console.log("\n=== Installing npm packages ===")

  const nodeModulesDir = path.join(DEPS_DIR, "node_modules")
  await fs.mkdir(nodeModulesDir, { recursive: true })

  const packages = [
    "pyright",
    "typescript",
    "typescript-language-server",
    "svelte-language-server",
    "@astrojs/language-server",
    "yaml-language-server",
    "dockerfile-language-server-nodejs",
    "@vue/language-server",
    "intelephense",
    "bash-language-server",
    "oxlint",
    "@biomejs/biome",
    "prisma",
  ]

  const pkgJsonPath = path.join(DEPS_DIR, "package.json")
  await Bun.write(pkgJsonPath, JSON.stringify({ dependencies: {} }, null, 2))

  const installCmd = ["bun", "add", "--cwd", DEPS_DIR]
  if (TARGET_PLATFORM === "windows-x64") {
    installCmd.push("--os=win32", "--cpu=x64")
  }
  installCmd.push(...packages)
  console.log(`Running: ${installCmd.join(" ")}`)

  const proc = Bun.spawn(installCmd, {
    stdout: "inherit",
    stderr: "inherit",
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error("Failed to install npm packages")
  }

  const versions: Record<string, string> = {}
  const pkgJson = await Bun.file(pkgJsonPath).json()

  for (const [pkg, version] of Object.entries(pkgJson.dependencies || {})) {
    versions[pkg] = version as string
  }

  console.log("npm packages installed successfully")
  return versions
}

async function downloadModelsJson(): Promise<void> {
  console.log("\n=== Downloading models.json ===")

  const modelsUrl = process.env.MODELS_URL || "https://models.dev/api.json"
  const destPath = path.join(DEPS_DIR, "models.json")
  await downloadFile(modelsUrl, destPath)
  console.log("models.json downloaded successfully")
}

async function buildWebApp(): Promise<void> {
  console.log("\n=== Building web app ===")

  const skipBuild = process.env.SKIP_WEB_APP_BUILD === "true"
  if (skipBuild) {
    console.log("Skipping web app build (SKIP_WEB_APP_BUILD=true)")
    return
  }

  const proc = Bun.spawn(["bun", "turbo", "build", "--filter=@opencode-ai/app"], {
    stdout: "inherit",
    stderr: "inherit",
  })
  await proc.exited
  if (proc.exitCode !== 0) {
    throw new Error("Failed to build web app")
  }

  const appDistSrc = "packages/app/dist"
  const appDistDest = path.join(DEPS_DIR, "app")
  await fs.mkdir(appDistDest, { recursive: true })
  await $`cp -r ${appDistSrc}/* ${appDistDest}/`

  console.log("Web app built and copied successfully")
}

async function createManifest(
  ripgrepVersion: string,
  clangdVersion: string,
  rustAnalyzerVersion: string,
  zlsVersion: string | undefined,
  luaLsVersion: string | undefined,
  terraformLsVersion: string | undefined,
  texlabVersion: string | undefined,
  tinymistVersion: string | undefined,
  kotlin: string | undefined,
  jdtls: string | undefined,
  eslint: string | undefined,
  elixir: string | undefined,
  treeSitterWasm: string[],
  npmVersions: Record<string, string>
): Promise<void> {
  console.log("\n=== Creating manifest ===")

  const manifest: Manifest = {
    version: "1.0.0",
    created: new Date().toISOString(),
    platform: "linux",
    arch: "x64",
    components: {
      ripgrep: ripgrepVersion,
      clangd: clangdVersion,
      rustAnalyzer: rustAnalyzerVersion,
      zls: zlsVersion,
      luaLs: luaLsVersion,
      terraformLs: terraformLsVersion,
      texlab: texlabVersion,
      tinymist: tinymistVersion,
      kotlin,
      jdtls,
      vscodeEslint: eslint,
      elixirLs: elixir,
      treeSitterWasm,
      npmPackages: npmVersions,
    },
  }

  await Bun.write(
    path.join(DEPS_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )

  console.log("Manifest created")
}

async function main() {
  const args = process.argv.slice(2)
  const pluginsOnly = args.includes("--plugins-only")
  
  const platformsArg = args.find(a => a.startsWith("--platforms="))
  const platforms = platformsArg ? platformsArg.split("=")[1].split(",") : ["linux-x64", "windows-x64"]

  console.log("=== OpenCode Onprem Dependencies Downloader ===")
  console.log(`Target platforms: ${platforms.join(", ")}`)

  for (const platform of platforms) {
    TARGET_PLATFORM = platform
    DEPS_DIR = `dist/onprem-deps-${TARGET_PLATFORM}`
    console.log(`\n--- Processing platform: ${TARGET_PLATFORM} ---`)
    console.log(`Target directory: ${DEPS_DIR}`)

    if (pluginsOnly) {
      const depsExist = await fs.stat(DEPS_DIR).catch(() => null)
      if (!depsExist) {
        console.error(`Dependencies not found at ${DEPS_DIR}`)
        console.error("Run full download first (without --plugins-only)")
        continue
      }

      const pluginList = await loadPluginsConfig()
      const pluginVersions = await installPlugins(pluginList)
      await updatePluginsManifest(pluginVersions)

      console.log("\n=== Plugins download complete ===")
      if (Object.keys(pluginVersions).length > 0) {
        console.log(`Plugins saved to: ${DEPS_DIR}/plugins/node_modules/`)
      }
      continue
    }

    await fs.rm(DEPS_DIR, { recursive: true, force: true })
    await fs.mkdir(DEPS_DIR, { recursive: true })

    const ripgrepVersion = await downloadRipgrep()
    const clangdVersion = await downloadClangd()
    const rustAnalyzerVersion = await downloadRustAnalyzer()
    
    const zlsVersion = await downloadZls()
    const luaLsVersion = await downloadLuaLanguageServer()
    const terraformLsVersion = await downloadTerraformLs()
    const texlabVersion = await downloadTexlab()
    const tinymistVersion = await downloadTinymist()
    const kotlin = await downloadKotlin()
    const jdtls = await downloadJdtls()
    const eslint = await downloadEslint()
    const elixir = await downloadElixir()
    
    const treeSitterWasm = await downloadTreeSitterWasm()
    await downloadTreeSitterQueries()
    
    const npmVersions = await installNpmPackages()
    await downloadModelsJson()
    await buildWebApp()

    await createManifest(
      ripgrepVersion,
      clangdVersion,
      rustAnalyzerVersion,
      zlsVersion,
      luaLsVersion,
      terraformLsVersion,
      texlabVersion,
      tinymistVersion,
      kotlin,
      jdtls,
      eslint,
      elixir,
      treeSitterWasm,
      npmVersions
    )

    const pluginList = await loadPluginsConfig()
    const pluginVersions = await installPlugins(pluginList)
    
    if (Object.keys(pluginVersions).length > 0) {
      const manifestPath = path.join(DEPS_DIR, "manifest.json")
      const manifest = await Bun.file(manifestPath).json()
      manifest.components.plugins = pluginVersions
      await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
    }

    console.log("\n=== Download complete for " + TARGET_PLATFORM + " ===")
    console.log(`Dependencies saved to: ${DEPS_DIR}`)
  }
}

async function updatePluginsManifest(pluginVersions: Record<string, string>): Promise<void> {
  console.log("\n=== Updating manifest ===")

  const manifestPath = path.join(DEPS_DIR, "manifest.json")
  let manifest: Manifest

  const existing = await Bun.file(manifestPath).json().catch(() => null)
  if (existing) {
    manifest = existing
    manifest.created = new Date().toISOString()
  } else {
    manifest = {
      version: "1.0.0",
      created: new Date().toISOString(),
      platform: "linux",
      arch: "x64",
      components: {
        ripgrep: "",
        clangd: "",
        rustAnalyzer: "",
        treeSitterWasm: [],
        npmPackages: {},
      },
    }
  }

  manifest.components.plugins = Object.keys(pluginVersions).length > 0 ? pluginVersions : undefined

  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
  console.log("Manifest updated with plugins")
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})