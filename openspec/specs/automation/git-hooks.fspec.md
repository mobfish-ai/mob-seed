# Feature: Git Hooks (Git 钩子自动化)

> 状态: archived
> 版本: 1.0.0
> 技术栈: Shell/JavaScript
> 派生路径: .seed/hooks/, .seed/scripts/
> 优先级: P1

## 概述

Git 钩子自动化，在 commit/push 时自动执行 SEED 检查，确保规格与代码同步。

## ADDED Requirements

### REQ-001: Pre-Commit 快速检查

The system SHALL perform quick SEED checks before commits.

**触发时机**: `git commit` 执行前

**检查范围**:
- 仅检查 staged 文件
- 过滤规格相关文件 (.fspec.md, .js, .ts)

**Scenario: 快速检查通过**
- WHEN 用户执行 git commit
- AND staged 文件通过 SEED 检查
- THEN 允许 commit 继续

**Scenario: 快速检查失败**
- WHEN 用户执行 git commit
- AND staged 文件未通过 SEED 检查
- THEN 阻止 commit
- AND 显示失败原因

**Scenario: 跳过检查**
- WHEN 设置 SKIP_SEED_CHECK=1
- THEN 跳过所有检查
- AND 显示警告信息

**Acceptance Criteria:**
- [x] AC-001: 仅检查 staged 文件
- [x] AC-002: 支持 SKIP_SEED_CHECK 跳过
- [x] AC-003: 失败时显示修复提示

### REQ-002: Pre-Push 增量检查

The system SHALL perform incremental SEED checks before pushes.

**触发时机**: `git push` 执行前

**检查范围**:
- 所有未推送的 commits 涉及的文件
- 新分支时与 main 比较

**Scenario: 增量检查通过**
- WHEN 用户执行 git push
- AND 未推送的变更通过检查
- THEN 允许 push 继续
- AND 更新检查缓存

**Scenario: 增量检查失败**
- WHEN 用户执行 git push
- AND 未推送的变更未通过检查
- THEN 阻止 push
- AND 显示需要修复的问题

**Acceptance Criteria:**
- [x] AC-004: 检查所有未推送的 commits
- [x] AC-005: 新分支正确处理
- [x] AC-006: 更新检查缓存

### REQ-003: 检查缓存

The system SHALL cache check results to speed up repeated checks.

**缓存策略**:
- 基于文件内容 hash
- 检查通过的结果缓存
- 文件变更时失效

**Scenario: 使用缓存**
- WHEN 文件未变更
- AND 之前检查通过
- THEN 直接使用缓存结果
- AND 跳过实际检查

**Scenario: 缓存失效**
- WHEN 文件内容变更
- THEN 重新执行检查
- AND 更新缓存

**Acceptance Criteria:**
- [x] AC-007: 基于内容 hash 缓存
- [x] AC-008: 变更时自动失效
- [x] AC-009: 缓存加速明显

### REQ-004: 快速检查脚本

The system SHALL provide quick-defend.js for fast SEED validation.

**检查项**:
- 规格与代码映射存在
- 基本语法正确
- 不执行完整测试

**Acceptance Criteria:**
- [x] AC-010: 秒级完成检查
- [x] AC-011: 覆盖基本同步问题
- [x] AC-012: 输出清晰的错误信息

### REQ-005: 增量检查脚本

The system SHALL provide incremental-defend.js for thorough validation.

**检查项**:
- 完整的规格-代码同步
- 测试覆盖验证
- 使用缓存加速

**Acceptance Criteria:**
- [x] AC-013: 完整同步检查
- [x] AC-014: 利用缓存加速
- [x] AC-015: 输出详细报告

## 导出接口

### Shell 脚本

```bash
.seed/hooks/pre-commit   # Git pre-commit 钩子
.seed/hooks/pre-push     # Git pre-push 钩子
```

### Node.js 脚本

```javascript
// 新路径 (v3.3.0+): skills/mob-seed/lib/hooks/
// skills/mob-seed/lib/hooks/cache-checker.js    - 检查文件是否有有效缓存
// skills/mob-seed/lib/hooks/quick-defender.js   - 快速 SEED 同步检查
// skills/mob-seed/lib/hooks/incremental-defender.js - 增量 SEED 检查（带缓存）
// skills/mob-seed/lib/hooks/cache-updater.js    - 更新检查缓存

// 旧路径 (向后兼容，已弃用):
// .seed/scripts/check-cache.js
// .seed/scripts/quick-defend.js
// .seed/scripts/incremental-defend.js
// .seed/scripts/update-cache.js
```

## 配置项

```json
{
  "hooks": {
    "enabled": true,
    "skipEnvVar": "SKIP_SEED_CHECK",
    "cacheDir": ".seed/cache/",
    "quickTimeout": 5000,
    "incrementalTimeout": 30000
  }
}
```

## 安装

```bash
# 链接到 .git/hooks/
ln -sf ../../.seed/hooks/pre-commit .git/hooks/pre-commit
ln -sf ../../.seed/hooks/pre-push .git/hooks/pre-push
```

## 依赖

- `lib/quality/fspec-linter.js` - 规格检查
- `lib/sync/task-sync.js` - 任务同步

## 测试要点

1. Pre-commit 阻止不同步的提交
2. Pre-push 阻止不同步的推送
3. 缓存正确加速
4. SKIP_SEED_CHECK 正确跳过
5. 错误信息清晰可操作
