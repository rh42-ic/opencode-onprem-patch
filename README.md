[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem 版本

本目录包含将 opencode 原版修改为 onprem 版本所需的 **git patch 文件**、脚本和文档。

如果patch失败，描述性文档应该足够AI Coding Agent解决冲突。你可以一开始就：

```
阅读 @/path/to/opencode-onprem-patch 说明，对 @/path/to/opencode-1.14.22 进行patch，如果发生冲突则尝试手动进行补丁。
```

## 目录结构

```
opencode-onprem-patch/
├── manifest.json           # 修改清单
├── WORKFLOW.md             # 详细构建指南
├── README.md               # 本文件
├── patches/
│   ├── 0001-add-onprem-module-and-scripts.patch  # 新增文件
│   ├── 0002-modify-source-files.patch            # 源码修改（基础）
│   ├── lsp-server-onprem.patch                   # LSP服务器离线支持
│   ├── parsers-config-onprem.patch                # Tree-sitter离线支持
│   └── plugins-onprem.patch                      # 插件离线支持
├── src/
│   ├── onprem-index.ts         # Onprem模块源码
│   ├── onprem-plugins.json      # 插件配置模板
│   └── onprem-plugins.schema.json # 配置Schema
└── scripts/
    ├── download-onprem-deps.ts    # 预下载依赖脚本
    ├── package-onprem-bundle.ts   # 打包脚本
    ├── opencode-onprem            # 启动脚本模板
    └── apply-patches.sh           # 自动应用补丁脚本
```

## 快速开始

### 1. 应用补丁到新版本

```bash
# 下载新版本 opencode 源码
git clone https://github.com/anomalyco/opencode.git opencode-new
cd opencode-new

# 方法一：使用脚本自动应用（推荐）
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .

# 方法二：手动应用 git patch
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem-patch/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem-patch/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem-patch/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/parsers-config-onprem.patch
git apply /path/to/opencode-onprem-patch/patches/plugins-onprem.patch
```

### 2. 预下载依赖

需要在有网络的环境中运行：

```bash
cd opencode-new
bun install
bun run script/download-onprem-deps.ts
```

可选环境变量：
- `MODELS_URL` - models.json 镜像地址
- `RUST_ANALYZER_MIRROR_URL` - rust-analyzer 镜像地址
- `SKIP_WEB_APP_BUILD=true` - 跳过 Web App 构建

仅下载插件（测试用）：
```bash
bun run script/download-onprem-deps.ts --plugins-only
```

### 3. 打包

```bash
OPENCODE_VERSION=1.14.22 bun run script/package-onprem-bundle.ts
```

> **注意：** 默认会同时打包所有平台的依赖。你也可以使用 `--platforms=windows-x64` 参数来限制打包的目标平台。

> **注意：** `OPENCODE_VERSION` 环境变量用于设置编译后的版本号。

打包完成后会生成以下平台对应的归档版本：
- `opencode-onprem-linux-x64.tar.zst` - Linux 标准版本（需要 AVX2 支持）
- `opencode-onprem-linux-x64-baseline.tar.zst` - Linux 兼容版本（无需 AVX2，适用于旧 CPU）
- `opencode-onprem-windows-x64.7z` - Windows 标准版本（需要 AVX2 支持）
- `opencode-onprem-windows-x64-baseline.7z` - Windows 兼容版本（无需 AVX2，适用于旧 CPU）

### 4. 部署到离线环境

```bash
# Linux 标准版本（需要 AVX2）
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# 或 Linux 兼容版本（无需 AVX2）
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem

# Windows 版本
# 使用 7z 等工具解压 opencode-onprem-windows-x64.7z
cd opencode-onprem-windows-x64
opencode-onprem.bat
```

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件：
- `packages/opencode/src/onprem/index.ts` - 核心 onprem 模块
- `script/download-onprem-deps.ts` - 预下载脚本
- `script/package-onprem-bundle.ts` - 打包脚本（包含文件排序优化以提高压缩率）
- `script/onprem-plugins.json` - 插件配置文件
- `script/onprem-plugins.schema.json` - JSON Schema

### 0002-modify-source-files.patch

修改文件：
- `packages/opencode/src/flag/flag.ts` - 添加环境变量
- `packages/opencode/src/file/ripgrep.ts` - 离线 ripgrep
- `packages/opencode/src/provider/models.ts` - 离线 models.json
- `packages/opencode/src/server/instance.ts` - Web UI 静态服务

### lsp-server-onprem.patch

为以下 LSP 添加离线支持：

**Binary LSPs (11个):**
- clangd, rust-analyzer, zls, lua-language-server
- terraform-ls, texlab, tinymist, kotlin-ls
- jdtls, vscode-eslint, elixir-ls

**NPM-based LSPs (12个):**
- typescript-language-server, pyright
- svelte-language-server, @astrojs/language-server
- yaml-language-server, dockerfile-language-server-nodejs
- @vue/language-server, intelephense, bash-language-server
- oxlint, biome, prisma

### parsers-config-onprem.patch

支持 25 种语言的 tree-sitter 解析器离线加载。

### plugins-onprem.patch

修改文件：
- `packages/opencode/src/plugin/shared.ts` - 在 `resolvePluginTarget()` 开头添加离线插件检测

## 支持的离线组件

### Binary LSPs

| LSP | 语言 | 来源 |
|-----|------|------|
| clangd | C/C++ | GitHub Releases |
| rust-analyzer | Rust | GitHub Releases |
| zls | Zig | GitHub Releases |
| lua-language-server | Lua | GitHub Releases |
| terraform-ls | Terraform | HashiCorp Releases |
| texlab | LaTeX | GitHub Releases |
| tinymist | Typst | GitHub Releases |
| kotlin-ls | Kotlin | GitHub Releases |
| jdtls | Java | Eclipse Downloads |
| vscode-eslint | ESLint | GitHub Releases |
| elixir-ls | Elixir | GitHub Releases |

### NPM-based LSPs

| LSP | 语言 |
|-----|------|
| typescript-language-server | TypeScript/JavaScript |
| pyright | Python |
| svelte-language-server | Svelte |
| @astrojs/language-server | Astro |
| yaml-language-server | YAML |
| dockerfile-language-server-nodejs | Dockerfile |
| @vue/language-server | Vue |
| intelephense | PHP |
| bash-language-server | Bash |
| oxlint | Oxlint |
| biome | Biome |
| prisma | Prisma |

### Tree-sitter Parsers

25 种语言的语法解析器：
python, rust, go, cpp, csharp, bash, c, java, kotlin, ruby, php, scala, html, hcl, json, yaml, haskell, css, julia, lua, ocaml, clojure, swift, toml, nix

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENCODE_ONPREM_MODE` | 设置为 `true` 启用 onprem 模式 |
| `OPENCODE_ONPREM_DEPS_PATH` | 依赖目录路径 |
| `OPENCODE_DISABLE_AUTOUPDATE` | 设置为 `true` 禁用自动更新 |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | 设置为 `true` 禁用 LSP 下载 |
| `OPENCODE_DISABLE_MODELS_FETCH` | 设置为 `true` 禁用 models.dev 获取 |

## 目录结构 (deps/)

```
deps/
├── ripgrep/
│   └── rg                           # Ripgrep 二进制
├── lsp/
│   ├── clangd/bin/clangd
│   ├── rust-analyzer/bin/rust-analyzer
│   ├── zls/bin/zls
│   ├── lua-language-server/bin/lua-language-server
│   ├── terraform-ls/terraform-ls
│   ├── texlab/bin/texlab
│   ├── tinymist/bin/tinymist
│   ├── kotlin-ls/bin/kotlin-lsp.sh
│   ├── jdtls/plugins/
│   ├── vscode-eslint/server/out/eslintServer.js
│   └── elixir-ls-master/release/language_server.sh
├── tree-sitter/
│   ├── wasm/                        # WASM 解析器
│   │   ├── tree-sitter-python.wasm
│   │   ├── tree-sitter-rust.wasm
│   │   └── ...
│   └── queries/                     # 查询文件
│       ├── python/
│       │   ├── highlights.scm
│       │   └── locals.scm
│       └── ...
├── node_modules/
│   ├── typescript/
│   ├── typescript-language-server/
│   ├── pyright/
│   ├── svelte-language-server/
│   ├── @astrojs/language-server/
│   ├── yaml-language-server/
│   ├── dockerfile-language-server-nodejs/
│   ├── @vue/language-server/
│   ├── intelephense/
│   ├── bash-language-server/
│   ├── oxlint/
│   ├── @biomejs/biome/
│   └── prisma/
├── plugins/                         # 离线插件目录(可选)
│   ├── package.json                # bun install 生成
│   └── node_modules/
│       └── opencode-anthropic-auth/ # 示例插件
├── opentui/                         # OpenTUI 原生库
│   └── libopentui.so
├── models.json                      # 模型元数据
├── app/                             # Web UI
└── manifest.json                    # Bundle 清单
```

## 插件离线化配置

在下载依赖前，可以编辑 `script/onprem-plugins.json` 配置需要离线化的插件：

```json
{
  "$schema": "./onprem-plugins.schema.json",
  "plugins": [
    "opencode-anthropic-auth@latest",
    "oh-my-opencode-slim@latest",
    "superpowers@git+https://github.com/obra/superpowers.git",
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest"
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

### 仅下载插件（测试用）

```bash
bun run script/download-onprem-deps.ts --plugins-only
```

运行完整下载时会自动安装配置的插件到 `deps/plugins/node_modules/` 目录。

在 onprem 模式下，`BunProc.install()` 会优先检查离线插件目录，如果找到则直接使用离线版本。

## 参考文档

- [WORKFLOW.md](./WORKFLOW.md) - 详细构建指南
- [manifest.json](./manifest.json) - 修改清单