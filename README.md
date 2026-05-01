[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem 版本

本目录包含将 opencode 原版修改为 onprem 版本所需的 **git patch 文件**、脚本和文档。

如果patch失败，描述性文档应该足够AI Coding Agent解决冲突。你可以一开始就：

```
阅读 @/path/to/opencode-onprem-patch 说明，对 @/path/to/opencode-1.14.31 进行patch，如果发生冲突则尝试手动进行补丁。
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
# 如需构建其它平台 (gnu, macOS, Windows, arm64 等)，请使用：
# bun run script/download-onprem-deps.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64,darwin-x64,darwin-arm64,linux-arm64-musl,linux-arm64-gnu
```

### 3. 打包

```bash
OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts
# 支持同时打包 musl 默认版和 gnu 版：
# OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64
```

> **注意：** `OPENCODE_VERSION` 环境变量用于设置编译后的版本号。Linux 环境推荐使用 `--musl`（linux-x64-musl） 编译，以提供更好的旧系统（如 CentOS 7）兼容性。

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件：
- `packages/opencode/src/onprem/index.ts` - 核心 onprem 模块
- `script/download-onprem-deps.ts` - 预下载脚本
- `script/package-onprem-bundle.ts` - 打包脚本
- `script/onprem-plugins.json` - 插件配置文件
- `script/onprem-plugins.schema.json` - JSON Schema

### 0002-modify-source-files.patch

修改文件：
- `packages/core/src/flag/flag.ts` - 添加环境变量
- `packages/opencode/src/file/ripgrep.ts` - 离线 ripgrep
- `packages/opencode/src/provider/models.ts` - 离线 models.json
- `packages/opencode/src/server/routes/ui.ts` - Web UI 静态服务

### lsp-server-onprem.patch

为 20 多种 LSP 添加离线支持。

### parsers-config-onprem.patch

支持 25 种语言的 tree-sitter 解析器离线加载。

### plugins-onprem.patch

修改 `packages/opencode/src/plugin/shared.ts` 添加离线插件检测。
