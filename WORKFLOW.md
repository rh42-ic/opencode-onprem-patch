[中文](README.md) | [English](README_EN.md)

---

# OpenCode Onprem 版本构建指南

本文档描述如何将修改应用到新的 opencode 版本。

## 核心原则 (Minimizing Upstream Touchpoints)

1. **逻辑中心化**: 所有 Onprem 核心逻辑均位于 `packages/opencode/src/onprem/`。
2. **最小侵入**: 仅在原版代码中添加少量 Guard 代码，通过 `// onprem-fork:` 标记。
3. **加法优先**: 优先通过新增文件实现功能，减少对原版文件的直接修改，降低合并冲突。

## 补丁应用流程

### 1. 准备源码
确保 `opencode` 源码处于干净的 Git 状态。

### 2. 运行应用脚本
```bash
/path/to/opencode-onprem-patch/scripts/apply-patches.sh .
```
该脚本会：
- 拷贝 `src/` 中的新增模块到 `packages/opencode/src/onprem/`。
- 拷贝构建脚本到 `script/`。
- 应用 `patches/` 中的 Git 补丁。

## 开发与维护

### 更新补丁 (When Upstream Changes)
1. 在 upstream 目录完成修改并验证通过。
2. 确保所有修改都带有 `// onprem-fork:` 标记。
3. 重新生成 patch: `git format-patch main --stdout > 0001-onprem-combined.patch`。
4. 同步 `onprem/index.ts` 到 `src/` 目录。
5. 同步 `download-onprem-deps.ts` 到 `scripts/` 目录。

## 验证编译
```bash
# 推荐使用 linux-x64-musl 以获得最佳离线兼容性
bun run script/build.ts --platform=linux-x64-musl
```
