# 变更提案: v2.1-release-automation

> 状态: draft
> 创建: 2026-01-01
> 作者: Claude

## 概述

合并命令、自动化流程、版本同步，提升开发体验。

## 问题背景

### 1. 命令碎片化
当前有多个功能相似的命令：
- `/mob-seed-status` - 查看状态
- `/mob-seed-sync` - 同步检查
- `/mob-seed-defend` - 守护检查

用户需要分别执行，无法一步到位。

### 2. 流程不连贯
检测到问题后需要手动决定下一步，缺乏自动化引导。

### 3. 版本不同步
v2.0.0 发布时发现多个版本文件未同步：
- `package.json`: 1.2.0
- `.claude-plugin/plugin.json`: 1.2.0
- `skills/mob-seed/package.json`: 1.0.0

## 解决方案

### 1. 命令三合一

将 status/sync/defend 合并为统一入口 `/mob-seed`：

```
/mob-seed
  ├── 自动检测项目状态
  ├── 执行同步检查
  ├── 运行守护验证
  └── 输出综合报告 + 建议行动
```

**智能模式**:
- 无参数：全量检查 + 建议行动
- `--quick`: 快速检查（只看状态）
- `--fix`: 自动修复可修复的问题

### 2. 自动触发后续流程

检测到问题后自动引导：

```
检测结果 → 问题分类 → 建议行动 → 用户确认 → 自动执行
```

| 问题类型 | 自动建议 |
|---------|---------|
| 规格过时 | 运行 /mob-seed-emit |
| 测试失败 | 运行 /mob-seed-exec |
| AC 未完成 | 更新规格状态 |
| 可归档 | 运行 /mob-seed-archive |

### 3. 版本同步自动化

**发布流程**:
```bash
# 一键发布
./scripts/release.sh v2.1.0
```

自动执行：
1. 验证版本格式 (semver)
2. 更新所有版本文件
3. 生成 CHANGELOG 条目
4. 创建 commit + tag
5. 推送触发 CI

**版本文件清单**:
- `package.json`
- `.claude-plugin/plugin.json`
- `skills/mob-seed/package.json`

## 规格文件

| 规格 | 说明 |
|------|------|
| `specs/workflow/unified-command.fspec.md` | 统一命令入口 |
| `specs/workflow/action-suggest.fspec.md` | 行动建议引擎 |
| `specs/automation/version-sync.fspec.md` | 版本同步 |
| `specs/automation/release-flow.fspec.md` | 发布流程 |

## 验收标准

### 命令统一
- [ ] AC-001: `/mob-seed` 无参数执行全量检查
- [ ] AC-002: 输出包含状态 + 同步 + 守护三部分
- [ ] AC-003: `--quick` 模式秒级完成
- [ ] AC-004: `--fix` 自动修复简单问题

### 流程自动化
- [ ] AC-005: 检测问题后输出建议行动列表
- [ ] AC-006: 用户确认后自动执行建议
- [ ] AC-007: 可归档时自动提示归档

### 版本同步
- [ ] AC-008: release.sh 更新所有版本文件
- [ ] AC-009: CI 检查 tag 版本与文件版本一致
- [ ] AC-010: 版本不一致时阻止发布

## 影响范围

### 新增
- `scripts/release.sh` - 发布脚本
- `scripts/bump-version.js` - 版本同步
- `lib/workflow/action-suggest.js` - 行动建议
- `docs/guide/releasing.md` - 发布指南

### 修改
- `SKILL.md` - 更新命令说明
- `.github/workflows/release.yml` - 添加版本检查
- `prompts/` - 合并相关 prompts

### 废弃
- `/mob-seed-status` → 合并到 `/mob-seed`
- `/mob-seed-sync` → 合并到 `/mob-seed`
- `/mob-seed-defend` → 合并到 `/mob-seed --defend`

## 兼容性

旧命令保留为别名，输出废弃警告：
```
⚠️ /mob-seed-status 已废弃，请使用 /mob-seed
```

## 预期收益

1. **用户体验**: 一个命令完成所有检查
2. **效率提升**: 自动建议减少决策负担
3. **发布可靠**: 版本同步消除遗漏风险
