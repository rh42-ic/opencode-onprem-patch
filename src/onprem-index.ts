import path from "path"
import { Flag } from "../flag/flag"
import { Filesystem } from "../util/filesystem"

export namespace Onprem {
  export function isEnabled(): boolean {
    return Flag.OPENCODE_ONPREM_MODE
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

  export function resolveLspBinary(lspName: string, binaryName: string): string | undefined {
    const depsPath = getDepsPath()
    if (!isEnabled() || !depsPath) return undefined
    return path.join(depsPath, "lsp", lspName, "bin", binaryName)
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
    if (await file.exists()) return { body: file, mime: Filesystem.mimeType(filePath) }
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
}