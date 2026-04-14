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
git apply /path/to/opencode-onprem-patch/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem-patch/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem-patch/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/parsers-config-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/plugins-onprem.patch

# 4. 如果有冲突
# 查看 .rej 文件，手动合并
# 搜索 "// onprem-fork:" 标记确认修改位置
```

### 或使用脚本

```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件：
| 文件路径 | 功能 |
|----------|------|
| `packages/opencode/src/onprem/index.ts` | 核心 onprem 模块，提供离线资源解析功能 |
| `script/download-onprem-deps.ts` | 预下载依赖脚本 |
| `script/package-onprem-bundle.ts` | 打包脚本 |
| `script/onprem-plugins.json` | 插件配置文件 |
| `script/onprem-plugins.schema.json` | JSON Schema |

### 0002-modify-source-files.patch

修改文件：
| 文件路径 | 修改内容 |
|----------|----------|
| `packages/opencode/package.json` | 添加 opentui 依赖 |
| `packages/opencode/src/flag/flag.ts` | 添加 `OPENCODE_ONPREM_MODE` 和 `OPENCODE_ONPREM_DEPS_PATH` 标志 |
| `packages/opencode/src/file/ripgrep.ts` | 添加离线 ripgrep 路径检查 |
| `packages/opencode/src/provider/models.ts` | 添加从 deps/models.json 加载模型数据 |
| `packages/opencode/src/server/instance.ts` | 添加 Web UI 静态文件服务 |

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
- kotlin-ls (Kotlin)
- jdtls (Java)
- vscode-eslint (ESLint)
- elixir-ls (Elixir)

**NPM-based LSPs:**
- typescript-language-server
- pyright
- svelte-language-server
- @astrojs/language-server
- yaml-language-server
- dockerfile-language-server-nodejs
- @vue/language-server
- intelephense (PHP)
- bash-language-server
- oxlint
- biome
- prisma

### parsers-config-onprem.patch

修改 `packages/opencode/parsers-config.ts`，支持从本地 deps 目录加载 tree-sitter WASM 和查询文件。

支持 25 种语言：
python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php, scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml, clojure, swift, toml, nix

### plugins-onprem.patch

修改 `packages/opencode/src/plugin/shared.ts`，在 `resolvePluginTarget()` 添加离线插件检测。

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
- `resolvePlugin()` - 解析离线插件路径
- `pluginExists()` - 检查离线插件是否存在
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

**模型加载优先级（onprem 模式）：**
1. 缓存文件 (`~/.cache/opencode/models.json` 或 `OPENCODE_MODELS_PATH`)
2. onprem deps 目录 (`OPENCODE_ONPREM_DEPS_PATH/models.json`)
3. 内置快照 (`models-snapshot.ts`)
4. 网络获取（如果 `OPENCODE_DISABLE_MODELS_FETCH` 未设置）

### server/instance.ts

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

### bun/index.ts

1. 添加导入：
```typescript
import { Onprem } from "../onprem"
```

2. 在 `BunProc.install()` 函数开头添加离线插件检测：
```typescript
// onprem-fork: check offline plugins directory first
if (Onprem.isEnabled()) {
  const pluginPath = Onprem.resolvePlugin(pkg)
  if (pluginPath && await Onprem.pluginExists(pkg)) {
    log.info("using onprem plugin", { pkg, path: pluginPath })
    return pluginPath
  }
}
```

## 构建流程

### 1. 配置离线插件（可选）

编辑 `script/onprem-plugins.json` 配置需要离线化的插件：

```json
{
  "$schema": "./onprem-plugins.schema.json",
  "plugins": [
    "opencode-anthropic-auth@0.0.13",
    "superpowers@git+https://github.com/obra/superpowers.git",
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest",
    "github:JRedeker/opencode-morph-fast-apply"
  ]
}
```

配置格式：
- `package@version` - 指定版本的 npm 包
- `package@latest` - 最新版本的 npm 包
- `@scope/package@version` - 作用域包
- `package@git+https://...` - Git 仓库源
- `package@git+ssh://...` - Git SSH 源
- `github:user/repo` - GitHub 简写格式

### 2. 在联网机器上预下载依赖

```bash
cd opencode
bun install
bun run script/download-onprem-deps.ts
```

可选环境变量：
- `MODELS_URL` - models.json 镜像源
- `RUST_ANALYZER_MIRROR_URL` - rust-analyzer 镜像源
- `SKIP_WEB_APP_BUILD=true` - 跳过 Web App 构建

仅测试插件下载：
```bash
bun run script/download-onprem-deps.ts --plugins-only
```

### 3. 打包离线 bundle

```bash
OPENCODE_VERSION=1.4.3 bun run script/package-onprem-bundle.ts
```

> **注意：** `OPENCODE_VERSION` 环境变量用于设置编译后的版本号。

### 4. 在离线机器上部署

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
git diff HEAD~1 HEAD -- script/download-onprem-deps.ts script/package-onprem-bundle.ts packages/opencode/src/onprem/index.ts script/onprem-plugins.json script/onprem-plugins.schema.json > patches/0001-add-onprem-module-and-scripts.patch
git diff HEAD~1 HEAD -- packages/opencode/src/flag/flag.ts packages/opencode/src/file/ripgrep.ts packages/opencode/src/provider/models.ts packages/opencode/src/server/instance.ts packages/opencode/package.json > patches/0002-modify-source-files.patch
git diff HEAD~1 HEAD -- packages/opencode/src/lsp/server.ts > patches/lsp-server-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/parsers-config.ts > patches/parsers-config-onprem.patch
git diff HEAD~1 HEAD -- packages/opencode/src/plugin/shared.ts > patches/plugins-onprem.patch
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
| Kotlin-LS | GitHub Releases | `deps/lsp/kotlin-ls/bin/kotlin-lsp.sh` |
| JDTLS | Eclipse Downloads | `deps/lsp/jdtls/` |
| VSCode-ESLint | GitHub Releases | `deps/lsp/vscode-eslint/server/out/eslintServer.js` |
| Elixir-LS | GitHub Releases | `deps/lsp/elixir-ls-master/release/language_server.sh` |

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
| Vue LSP | `deps/node_modules/@vue/language-server/` |
| Intelephense (PHP) | `deps/node_modules/intelephense/` |
| Bash LSP | `deps/node_modules/bash-language-server/` |
| Oxlint | `deps/node_modules/oxlint/` |
| Biome | `deps/node_modules/@biomejs/biome/` |
| Prisma | `deps/node_modules/prisma/` |

### Tree-sitter Parsers (WASM)

支持 25 种语言的 tree-sitter 解析器：
- python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php
- scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml
- clojure, swift, toml, nix

存放路径：`deps/tree-sitter/wasm/`

### Tree-sitter Query Files

每种语言的查询文件（highlights.scm, locals.scm）：
存放路径：`deps/tree-sitter/queries/{lang}/`

### 其他资源

| 组件 | 存放路径 |
|------|----------|
| models.json | `deps/models.json` |
| Web App | `deps/app/` |
| OpenTUI | `deps/opentui/libopentui.so` |

### 离线插件

通过 `script/onprem-plugins.json` 配置，支持：
- npm 包（如 `opencode-anthropic-auth@0.0.13`）
- Git 仓库（如 `superpowers@git+https://github.com/obra/superpowers.git`）

存放路径：`deps/plugins/node_modules/`

manifest.json 会记录已安装插件的版本信息。

## 跳过的 LSP

以下 LSP 因依赖复杂运行时环境或尚未实现自动下载而跳过：

| LSP | 原因 |
|-----|------|
| Haskell LS | 需要 GHC |
| Gleam LS | 需要 gleam 安装 |
| Clojure LS | 需要 clojure-lsp 安装 |
| Nixd | 需要 nixd 安装 |
| JuliaLS | 需要 Julia 安装 |