[中文](WORKFLOW.md) | [English](WORKFLOW_EN.md)

---

# OpenCode Onprem 版本构建指南

本文档描述如何将修改应用到新的 opencode 版本，生成对应的 onprem 版本。

## 使用 Git Patch 应用修改（推荐）

### 快速应用

```bash
# 1. 下载新版本源码
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# 2. 初始化 git（如果源码不是 git 仓库）
git init && git add -A && git commit -m "init"

# 3. 应用补丁
git apply /path/to/opencode-onprem/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem/patches/parsers-config-onprem.patch

# 4. 如果有冲突
# 查看 .rej 文件，手动合并
# 搜索 "// onprem-fork:" 标记确认修改位置
```

### 或使用脚本

```bash
/path/to/opencode-onprem/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件：
| 文件路径 | 功能 |
|----------|------|
| `packages/opencode/src/onprem/index.ts` | 核心 onprem 模块，提供离线资源解析功能 |
| `script/download-onprem-deps.ts` | 预下载依赖脚本 |
| `script/package-onprem-bundle.ts` | 打包脚本 |

### 0002-modify-source-files.patch

修改文件：
| 文件路径 | 修改内容 |
|----------|----------|
| `packages/opencode/src/flag/flag.ts` | 添加 `OPENCODE_ONPREM_MODE` 和 `OPENCODE_ONPREM_DEPS_PATH` 标志 |
| `packages/opencode/src/file/ripgrep.ts` | 添加离线 ripgrep 路径检查 |
| `packages/opencode/src/provider/models.ts` | 添加从 deps/models.json 加载模型数据，含双重回退和日志 |
| `packages/opencode/src/server/server.ts` | 添加 Web UI 静态文件服务 |

### lsp-server-onprem.patch

修改 `packages/opencode/src/lsp/server.ts`，为以下 LSP 添加离线路径检查：

**Binary LSPs:**
- clangd
- rust-analyzer
- zls (Zig Language Server)
- lua-language-server
- terraform-ls
- texlab (LaTeX)
- tinymist (Typst)

**NPM-based LSPs:**
- typescript-language-server
- pyright
- svelte-language-server
- @astrojs/language-server
- yaml-language-server
- dockerfile-language-server-nodejs

### parsers-config-onprem.patch

修改 `packages/opencode/parsers-config.ts`，支持从本地 deps 目录加载 tree-sitter WASM 和查询文件。

## 搜索标记

所有修改使用 `// onprem-fork:` 注释标记，便于后续同步时查找：

```bash
grep -rn "onprem-fork" packages/opencode/src/
```

## 详细修改说明（手动应用时参考）

### flag.ts

```typescript
// onprem-fork: onprem mode flags
export const OPENCODE_ONPREM_MODE = truthy("OPENCODE_ONPREM_MODE")
export const OPENCODE_ONPREM_DEPS_PATH = process.env["OPENCODE_ONPREM_DEPS_PATH"]
```

### onprem/index.ts

创建核心模块，提供以下函数：
- `isEnabled()` - 检查是否启用 onprem 模式
- `getDepsPath()` - 获取依赖目录路径
- `resolveBinary()` - 解析二进制文件路径
- `resolveNpmPackage()` - 解析 npm 包路径
- `resolveLspBinary()` - 解析 LSP 二进制路径
- `resolveAppDist()` - 解析 Web App 目录
- `resolveParserWasm()` - 解析 tree-sitter WASM 路径
- `resolveParserQuery()` - 解析 tree-sitter 查询文件路径
- `parserWasmExists()` - 检查 WASM 文件是否存在
- `parserQueryExists()` - 检查查询文件是否存在
- `tryServeStaticFile()` - 尝试提供静态文件

### ripgrep.ts

在 `state()` 函数中，系统路径检查之后、下载之前添加：

```typescript
// onprem-fork: check offline deps for bundled ripgrep binary
if (Onprem.isEnabled()) {
  const offlinePath = Onprem.resolveBinary("rg" + (process.platform === "win32" ? ".exe" : ""), "ripgrep")
  if (offlinePath) {
    const offlineFile = Bun.file(offlinePath)
    if (await offlineFile.exists()) {
      log.info("using onprem ripgrep", { path: offlinePath })
      return { filepath: offlinePath }
    }
  }
  log.warn("onprem mode enabled but ripgrep not found in deps")
}
```

### models.ts

1. 添加导入：
```typescript
import { Onprem } from "../onprem"
```

2. 修改 `Data()` 函数，在缓存读取后、快照导入前添加 onprem 检查：
```typescript
export const Data = lazy(async () => {
  const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
  if (result) return result
  // onprem-fork: try deps models.json from onprem bundle before snapshot
  if (Onprem.isEnabled()) {
    const depsPath = Onprem.getDepsPath()
    if (depsPath) {
      const offlineResult = await Filesystem.readJson(path.join(depsPath, "models.json")).catch(() => {})
      if (offlineResult) {
        log.info("loaded models from onprem deps", { path: depsPath })
        return offlineResult as Record<string, Provider>
      }
      log.warn("onprem enabled but deps models.json not found", { path: depsPath })
    }
  }
  // @ts-ignore
  const snapshot = await import("./models-snapshot")
    .then((m) => m.snapshot as Record<string, unknown>)
    .catch(() => undefined)
  if (snapshot) return snapshot
  if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return {}
  const json = await fetch(`${url()}/api.json`).then((x) => x.text())
  return JSON.parse(json)
})
```

3. 修改 `get()` 函数开头，添加更好的错误日志：
```typescript
export async function get() {
  // onprem-fork: in onprem mode, try bundled models from deps first
  if (Onprem.isEnabled()) {
    const depsPath = Onprem.getDepsPath()
    if (depsPath) {
      const modelsPath = path.join(depsPath, "models.json")
      const offlineResult = await Filesystem.readJson(modelsPath).catch((e) => {
        log.warn("failed to read onprem models.json", { path: modelsPath, error: String(e) })
        return undefined
      })
      if (offlineResult) return offlineResult as Record<string, Provider>
    }
  }

  const result = await Data()
  return result as Record<string, Provider>
}
```

4. 修改 refresh 逻辑跳过 onprem 模式：
```typescript
// onprem-fork: skip models refresh in onprem mode
if (!Onprem.isEnabled() && !Flag.OPENCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
  ModelsDev.refresh()
  // ...
}
```

**模型加载优先级（onprem 模式）：**
1. 缓存文件 (`~/.cache/opencode/models.json` 或 `OPENCODE_MODELS_PATH`)
2. onprem deps 目录 (`OPENCODE_ONPREM_DEPS_PATH/models.json`)
3. 内置快照 (`models-snapshot.ts`)
4. 网络获取（如果 `OPENCODE_DISABLE_MODELS_FETCH` 未设置）

**日志输出：**
- 成功从 onprem deps 加载：`log.info("loaded models from onprem deps", { path: depsPath })`
- deps 目录存在但 models.json 不存在：`log.warn("onprem enabled but deps models.json not found", { path: depsPath })`
- 读取 models.json 失败：`log.warn("failed to read onprem models.json", { path: modelsPath, error: String(e) })`

### server/server.ts

1. 添加导入：
```typescript
import { Onprem } from "../onprem"
```

2. 在 `.all("/*", ...)` 路由开头添加：
```typescript
// onprem-fork: serve bundled web app in onprem mode
const onpremStatic = await Onprem.tryServeStaticFile(c.req.path)
if (onpremStatic) {
  return new Response(onpremStatic.body, { headers: { "Content-Type": onpremStatic.mime } })
}
```

### lsp/server.ts

1. 添加导入：
```typescript
import { Onprem } from "../onprem"
```

2. 在每个 LSP 的 spawn() 函数中添加离线路径检查（参考 patch 文件）。

## 构建流程

### 1. 在联网机器上预下载依赖

```bash
cd opencode
bun install
bun run script/download-onprem-deps.ts
```

可选环境变量：
- `MODELS_URL` - models.json 镜像源
- `RUST_ANALYZER_MIRROR_URL` - rust-analyzer 镜像源
- `SKIP_WEB_APP_BUILD=true` - 跳过 Web App 构建

### 2. 打包离线 bundle

```bash
OPENCODE_VERSION=1.2.27 bun run script/package-onprem-bundle.ts
```

> **注意：** `OPENCODE_VERSION` 环境变量用于设置编译后的版本号。

### 3. 在离线机器上部署

```bash
# 标准版本（需要 AVX2）
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# 或兼容版本（无需 AVX2，适用于旧 CPU）
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem
```

## 版本升级后重新生成 Patch

```bash
# 在修改后的仓库中
git add -A
git commit -m "onprem modifications for version x.x.x"

# 生成新 patch
git diff HEAD~1 HEAD -- packages/opencode/src/onprem/index.ts script/ > patches/0001-add-onprem-module-and-scripts.patch
git diff HEAD~1 HEAD -- packages/opencode/src/flag/flag.ts packages/opencode/src/file/ripgrep.ts packages/opencode/src/provider/models.ts packages/opencode/src/server/server.ts packages/opencode/src/installation/index.ts > patches/0002-modify-source-files.patch
git diff HEAD~1 HEAD -- packages/opencode/src/lsp/server.ts > patches/lsp-server-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/parsers-config.ts > patches/parsers-config-onprem.patch
```

## 预下载资源清单

### Binary LSPs

| 组件 | 来源 | 存放路径 |
|------|------|----------|
| Ripgrep | GitHub Releases | `deps/ripgrep/rg` |
| Clangd | GitHub Releases | `deps/lsp/clangd/bin/clangd` |
| Rust-analyzer | GitHub Releases | `deps/lsp/rust-analyzer/bin/rust-analyzer` |
| ZLS | GitHub Releases | `deps/lsp/zls/bin/zls` |
| LuaLS | GitHub Releases | `deps/lsp/lua-language-server/bin/lua-language-server` |
| Terraform-LS | HashiCorp Releases | `deps/lsp/terraform-ls/terraform-ls` |
| TexLab | GitHub Releases | `deps/lsp/texlab/bin/texlab` |
| Tinymist | GitHub Releases | `deps/lsp/tinymist/bin/tinymist` |

### NPM-based LSPs

| 组件 | 存放路径 |
|------|----------|
| TypeScript | `deps/node_modules/typescript/` |
| TypeScript LSP | `deps/node_modules/typescript-language-server/` |
| Pyright | `deps/node_modules/pyright/` |
| Svelte LSP | `deps/node_modules/svelte-language-server/` |
| Astro LSP | `deps/node_modules/@astrojs/language-server/` |
| YAML LSP | `deps/node_modules/yaml-language-server/` |
| Dockerfile LSP | `deps/node_modules/dockerfile-language-server-nodejs/` |

### Tree-sitter Parsers (WASM)

支持 21 种语言的 tree-sitter 解析器：
- python, rust, go, cpp, csharp, bash, c, java, ruby, php
- scala, html, json, yaml, haskell, css, julia, ocaml
- clojure, swift, nix

存放路径：`deps/tree-sitter/wasm/`

### Tree-sitter Query Files

每种语言的查询文件（highlights.scm, locals.scm）：
存放路径：`deps/tree-sitter/queries/{lang}/`

### 其他资源

| 组件 | 存放路径 |
|------|----------|
| models.json | `deps/models.json` |
| Web App | `deps/app/` |

## 跳过的 LSP

以下 LSP 因依赖复杂运行时环境而跳过：

| LSP | 原因 |
|-----|------|
| ElixirLS | 需要 Elixir 运行时 |
| Kotlin LSP | 需要 JetBrains CDN |
| jdtls | 需要 Java 21+ |
| Haskell LS | 需要 GHC |
| Gleam LS | 需要 gleam 安装 |
| Clojure LS | 需要 clojure-lsp 安装 |
| Nixd | 需要 nixd 安装 |
| JuliaLS | 需要 Julia 安装 |