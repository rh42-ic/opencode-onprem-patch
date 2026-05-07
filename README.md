[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem 版本

本目录包含将 opencode 原版修改为 onprem 版本所需的 **git patch 文件**、脚本和源码模版。

## 目录结构

```
opencode-onprem-patch/
├── WORKFLOW.md             # 详细构建指南
├── README.md               # 本文件
├── patches/
│   └── 0001-onprem-combined.patch  # 源码修改的 Git Patch (针对 1.14.40 优化)
├── src/
│   ├── onprem/
│   │   └── index.ts            # Onprem 核心模块
│   ├── onprem-plugins.json      # 插件配置模版
│   └── onprem-plugins.schema.json # 配置 Schema
└── scripts/
    ├── download-onprem-deps.ts    # 预下载依赖脚本
    ├── package-onprem-bundle.ts   # 打包脚本
    ├── opencode-onprem            # 启动脚本模板
    └── apply-patches.sh           # 补丁应用工具
```

## 快速开始

### 1. 应用补丁

```bash
# 进入 opencode 源码目录
cd opencode-source

# 使用脚本自动应用补丁及新增文件
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .
```

### 2. 预下载依赖 (需联网)

```bash
bun install
bun run script/download-onprem-deps.ts --platforms=linux-x64-musl,linux-x64-gnu
```

### 3. 打包

```bash
OPENCODE_VERSION=1.14.40 bun run script/package-onprem-bundle.ts --platforms=linux-x64-musl
```

## Patch 核心改动

- **Flag 系统**: 引入 `OPENCODE_ONPREM_MODE` 等环境变量控制。
- **模型加载**: 优先从离线 `models.json` 加载，兼容 Effect 框架。
- **UI 拦截**: 自动服务前端静态资源，无需外部 Proxy。
- **LSP & Parsers**: 针对 Pyright, Docker 等 20+ LSP 的离线二进制路径映射。
- **插件系统**: 离线模式下的插件合法性检测绕过。
