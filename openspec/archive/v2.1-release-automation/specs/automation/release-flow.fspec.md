# release-flow 规格

> 版本: 1.0.0
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P1

## 概述 (Overview)

一键发布流程，自动化从版本更新到 GitHub Release 的完整发布流程。

### 目标用户
- 项目维护者
- 发布流程执行者

### 核心价值
- 一键完成发布全流程
- 自动生成 CHANGELOG 条目
- CI 自动创建 GitHub Release

## 需求 (Requirements)

### 功能需求

- [ ] FR-001: 前置检查 - 验证工作区干净、测试通过
- [ ] FR-002: 版本更新 - 调用 bump-version 更新所有文件
- [ ] FR-003: CHANGELOG 生成 - 生成版本变更条目
- [ ] FR-004: Git 操作 - 创建 commit 和 tag
- [ ] FR-005: 推送触发 - 推送到远程触发 CI
- [ ] FR-006: CI 发布 - 自动创建 GitHub Release

### 非功能需求

- [ ] NFR-001: 发布脚本 < 30 秒完成
- [ ] NFR-002: 支持 dry-run 模式
- [ ] NFR-003: 失败时提供回滚指导

## 约束 (Constraints)

### 技术约束
- 使用 Bash 脚本实现
- 依赖 git 和 gh CLI
- CI 使用 GitHub Actions

### 业务约束
- 只有 main 分支可发布
- 版本必须递增

## 接口设计 (Interface)

### CLI 接口

```bash
# 一键发布
./scripts/release.sh v2.1.0

# 预览模式
./scripts/release.sh v2.1.0 --dry-run

# 跳过测试（紧急修复时）
./scripts/release.sh v2.1.0 --skip-tests
```

### 发布流程

```
./scripts/release.sh v2.1.0
        │
        ├── 1. 验证版本格式 (semver)
        │
        ├── 2. 检查工作区干净
        │
        ├── 3. 运行测试确保通过
        │
        ├── 4. 更新所有版本文件
        │       └── node scripts/bump-version.js v2.1.0
        │
        ├── 5. 生成 CHANGELOG 条目
        │       └── 追加到 CHANGELOG.md
        │
        ├── 6. 创建 commit
        │       └── git commit -m "chore(release): v2.1.0"
        │
        ├── 7. 创建 tag
        │       └── git tag v2.1.0
        │
        ├── 8. 推送到远程
        │       └── git push && git push --tags
        │
        └── 9. CI 自动触发
                └── GitHub Actions 创建 Release
```

### CI 配置

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verify version sync
        run: node scripts/bump-version.js --check

      - name: Run tests
        run: npm test

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

## 验收标准 (Acceptance Criteria)

### AC-016: 一键发布
- Given: 工作区干净，测试通过
- When: 执行 `./scripts/release.sh v2.1.0`
- Then: 自动完成版本更新、commit、tag、push

### AC-017: 版本检查
- Given: tag 为 v2.1.0
- When: CI 运行
- Then: 验证所有版本文件为 2.1.0

### AC-018: 自动 Release
- Given: tag 推送成功
- When: CI 完成
- Then: GitHub 上创建 v2.1.0 Release

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | scripts/release.sh | 发布脚本 |
| CI | .github/workflows/release.yml | 发布工作流 |
| 文档 | docs/guide/releasing.md | 发布指南 |
