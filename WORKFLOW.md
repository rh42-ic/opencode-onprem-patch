[中文](README.md) | [English](README_EN.md)

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
```

### 或使用脚本

```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh /path/to/opencode-new
```

## Patch 文件说明

### 0001-add-onprem-module-and-scripts.patch

新增文件，包括核心 onprem 模块、预下载和打包脚本。

### 0002-modify-source-files.patch

源码基础修改，包括环境变量、ripgrep、模型加载和 Web UI 服务。

### lsp-server-onprem.patch

LSP 服务器离线支持。

### parsers-config-onprem.patch

Tree-sitter WASM 和查询文件离线加载。

### plugins-onprem.patch

插件离线检测。

## 搜索标记

所有修改使用 `// onprem-fork:` 注释标记。

## 构建流程

### 1. 预下载依赖

```bash
bun run script/download-onprem-deps.ts
# 如需构建其它平台 (gnu, macOS, Windows, arm64 等)，请使用：
# bun run script/download-onprem-deps.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64,darwin-x64,darwin-arm64,linux-arm64-musl,linux-arm64-gnu
```

### 2. 打包离线 bundle

```bash
OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts
# 如需同时打包所有平台，请使用：
# OPENCODE_VERSION=1.14.31 bun run script/package-onprem-bundle.ts --platforms=linux-x64-musl,linux-x64-gnu,windows-x64,darwin-x64,darwin-arm64,linux-arm64-musl,linux-arm64-gnu
```

推荐的 Linux 离线包为静态编译的 `musl` (`--platforms=linux-x64-musl`) 版本。
