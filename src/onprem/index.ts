import path from "path"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Filesystem } from "@/util/filesystem"

export function isEnabled(): boolean {
  return Flag.OPENCODE_ONPREM_MODE
}

export function isOnpremMode(): boolean {
  return isEnabled() || process.env["OPENCODE_ONPREM_MODE"] === "true" || process.env["OPENCODE_ONPREM_MODE"] === "1"
}

export function getDepsPath(): string | undefined {
  return Flag.OPENCODE_ONPREM_DEPS_PATH
}

export function resolveBinary(name: string, subpath: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, subpath, name)
}

export function resolveNpmPackage(pkg: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "node_modules", pkg)
}

export function resolveLspBinary(lspName: string, binaryPath: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "lsp", lspName, binaryPath)
}

export function resolveAppDist(): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "app")
}

export async function tryServeStaticFile(reqPath: string): Promise<{ body: ReturnType<typeof Bun.file>; mime: string } | undefined> {
  const appDir = resolveAppDist()
  if (!appDir) return undefined
  const filePath = reqPath === "/" ? "/index.html" : reqPath
  const file = Bun.file(path.join(appDir, filePath))
  if (await file.exists()) return { body: file, mime: await Filesystem.mimeType(filePath) }
  const index = Bun.file(path.join(appDir, "index.html"))
  if (await index.exists()) return { body: index, mime: "text/html; charset=utf-8" }
  return undefined
}

export function resolveParserWasm(name: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "tree-sitter", "wasm", `${name}.wasm`)
}

export function resolveParserQuery(lang: string, filename: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "tree-sitter", "queries", lang, filename)
}

export async function parserWasmExists(name: string): Promise<boolean> {
  const wasmPath = resolveParserWasm(name)
  if (!wasmPath) return false
  return Filesystem.exists(wasmPath)
}

export async function parserQueryExists(lang: string, filename: string): Promise<boolean> {
  const queryPath = resolveParserQuery(lang, filename)
  if (!queryPath) return false
  return Filesystem.exists(queryPath)
}

export function resolvePlugin(pkg: string): string | undefined {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return undefined
  return path.join(depsPath, "plugins", "node_modules", pkg)
}

export async function pluginExists(pkg: string): Promise<boolean> {
  const pluginPath = resolvePlugin(pkg)
  if (!pluginPath) return false
  return Filesystem.exists(pluginPath)
}

export function getOnpremBin(name: string): string | null {
  const depsPath = getDepsPath()
  if (!isEnabled() || !depsPath) return null
  const ext = process.platform === "win32" ? ".exe" : ""
  const cmd = process.platform === "win32" ? ".cmd" : ""

  switch (name) {
    case "rg":
    case "ripgrep":
      return path.join(depsPath, "ripgrep", "rg" + ext)
    case "deno":
      return path.join(depsPath, "lsp", "deno", "deno" + ext)
    case "clangd":
      return path.join(depsPath, "lsp", "clangd", "bin", "clangd" + ext)
    case "rust-analyzer":
      return path.join(depsPath, "lsp", "rust-analyzer", "bin", "rust-analyzer" + ext)
    case "zls":
      return path.join(depsPath, "lsp", "zls", "bin", "zls" + ext)
    case "lua-language-server":
      return path.join(depsPath, "lsp", "lua-language-server", "bin", "lua-language-server" + ext)
    case "terraform-ls":
      return path.join(depsPath, "lsp", "terraform-ls", "terraform-ls" + ext)
    case "texlab":
      return path.join(depsPath, "lsp", "texlab", "bin", "texlab" + ext)
    case "tinymist":
      return path.join(depsPath, "lsp", "tinymist", "bin", "tinymist" + ext)
    case "kotlin-language-server":
      return path.join(depsPath, "lsp", "kotlin-ls")
    case "jdtls":
      return path.join(depsPath, "lsp", "jdtls")
    case "vscode-eslint":
      return path.join(depsPath, "lsp", "vscode-eslint", "server", "out", "eslintServer.js")
    case "elixir-ls":
      return path.join(
        depsPath,
        "lsp",
        "elixir-ls-master",
        "release",
        process.platform === "win32" ? "language_server.bat" : "language_server.sh",
      )
    case "java":
      return path.join(depsPath, "lsp", "java", "bin", "java" + ext)
    case "tsserver":
      return path.join(depsPath, "node_modules", "typescript", "lib", "tsserver.js")
    case "typescript-language-server":
    case "vue-language-server":
    case "svelte-language-server":
    case "astro-ls":
    case "yaml-language-server":
    case "docker-langserver":
    case "pyright-langserver":
    case "intelephense":
    case "bash-language-server":
    case "oxlint":
    case "oxc_language_server":
    case "biome":
    case "prisma-language-server":
    case "gopls": {
      const binName =
        name === "astro-ls"
          ? "@astrojs/language-server"
          : name === "docker-langserver"
            ? "docker-langserver"
            : name === "pyright-langserver"
              ? "pyright-langserver"
              : name === "prisma-language-server"
                ? "prisma"
                : name === "oxc_language_server"
                  ? "oxc_language_server"
                  : name
      return path.join(depsPath, "node_modules", ".bin", binName + cmd)
    }
    default:
      return null
  }
}

export * as Onprem from "."
