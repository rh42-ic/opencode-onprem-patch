[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem 版本

本目录包含将 opencode 原版修改为 onprem 版本所需的 **git patch 文件**、脚本和文档。

## 目录结构

```
opencode-onprem/
├── manifest.json           # 修改清单
├── WORKFLOW.md             # 详细构建指南
├── README.md               # 本文件
├── patches/
│   ├── 0001-add-onprem-module-and-scripts.patch  # 新增文件
│   ├── 0002-modify-source-files.patch            # 源码修改（基础）
│   ├── lsp-server-onprem.patch                   # LSP服务器离线支持
│   └── parsers-config-onprem.patch                # Tree-sitter离线支持
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
/path/to/opencode-onprem/scripts/apply-patches.sh .

# 方法二：手动应用 git patch
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem/patches/parsers-config-onprem.patch
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

### 3. 打包

```bash
OPENCODE_VERSION=1.2.27 bun run script/package-onprem-bundle.ts
```

> **注意：** `OPENCODE_VERSION` 环境变量用于设置编译后的版本号。

打包完成后会生成两个版本：
- `opencode-onprem-linux-x64.tar.zst` - 标准版本（需要 AVX2 支持）
- `opencode-onprem-linux-x64-baseline.tar.zst` - 兼容版本（无需 AVX2，适用于旧 CPU）

### 4. 部署到离线环境

```bash
# 标准版本（需要 AVX2）
tar --zstd -xf opencode-onprem-linux-x64.tar.zst
cd opencode-onprem-linux-x64
./opencode-onprem

# 或兼容版本（无需 AVX2）
tar --zstd -xf opencode-onprem-linux-x64-baseline.tar.zst
cd opencode-onprem-linux-x64-baseline
./opencode-onprem
```

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件：
- `packages/opencode/src/onprem/index.ts` - 核心 onprem 模块
- `script/download-onprem-deps.ts` - 预下载脚本
- `script/package-onprem-bundle.ts` - 打包脚本

### 0002-modify-source-files.patch

修改文件：
- `packages/opencode/src/flag/flag.ts` - 添加环境变量
- `packages/opencode/src/file/ripgrep.ts` - 离线 ripgrep
- `packages/opencode/src/provider/models.ts` - 离线 models.json
- `packages/opencode/src/server/server.ts` - Web UI 静态服务

### lsp-server-onprem.patch

为以下 LSP 添加离线支持：

**Binary LSPs (8个):**
- clangd, rust-analyzer, zls, lua-language-server
- terraform-ls, texlab, tinymist

**NPM-based LSPs (6个):**
- typescript-language-server, pyright
- svelte-language-server, @astrojs/language-server
- yaml-language-server, dockerfile-language-server-nodejs

### parsers-config-onprem.patch

支持 21 种语言的 tree-sitter 解析器离线加载。

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

### NPM-based LSPs

| LSP | 语言 |
|-----|------|
| typescript-language-server | TypeScript/JavaScript |
| pyright | Python |
| svelte-language-server | Svelte |
| @astrojs/language-server | Astro |
| yaml-language-server | YAML |
| dockerfile-language-server-nodejs | Dockerfile |

### Tree-sitter Parsers

21 种语言的语法解析器：
python, rust, go, cpp, csharp, bash, c, java, ruby, php, scala, html, json, yaml, haskell, css, julia, ocaml, clojure, swift, nix

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
│   └── tinymist/bin/tinymist
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
│   └── dockerfile-language-server-nodejs/
├── models.json                      # 模型元数据
├── app/                             # Web UI
└── manifest.json                    # Bundle 清单
```

## 与 opencode-offline 的区别

| 特性 | opencode-offline | opencode-onprem |
|------|------------------|-----------------|
| 环境变量 | `OPENCODE_OFFLINE_*` | `OPENCODE_ONPREM_*` |
| 补丁格式 | 手动修改 | git patch 文件 |
| LSP 支持 | 5个核心 LSP | 15个 LSP |
| Tree-sitter | 无 | 21种语言 |
| 目标用户 | 完全离线环境 | 内网有镜像源的环境 |

## 版本升级流程

当 opencode 发布新版本时：

```bash
# 1. 下载新版本
git clone https://github.com/anomalyco/opencode.git opencode-new-ver

# 2. 尝试应用补丁
cd opencode-new-ver
git init && git add -A && git commit -m "init"
git apply /path/to/opencode-onprem/patches/0001-add-onprem-module-and-scripts.patch
git apply /path/to/opencode-onprem/patches/0002-modify-source-files.patch
git apply /path/to/opencode-onprem/patches/lsp-server-onprem.patch
git apply /path/to/opencode-onprem/patches/parsers-config-onprem.patch

# 3. 如果有冲突，手动解决
# 搜索 "// onprem-fork:" 标记确认修改位置

# 4. 测试构建
bun install
bun run script/download-onprem-deps.ts
OPENCODE_VERSION=x.x.x bun run script/package-onprem-bundle.ts

# 5. 更新 patch 文件（如果有修改）
git add -A && git commit -m "onprem modifications"
git diff HEAD~1 HEAD -- packages/opencode/src/onprem/ script/ > patches/0001-add-onprem-module-and-scripts.patch
# ... 其他patch文件
```

## 参考文档

- [WORKFLOW.md](./WORKFLOW.md) - 详细构建指南
- [manifest.json](./manifest.json) - 修改清单