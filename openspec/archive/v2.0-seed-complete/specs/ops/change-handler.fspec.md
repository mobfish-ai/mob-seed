# Feature: Change Handler (变更处理器)

> 状态: implementing
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ops/
> 优先级: P2
> 预计工作量: 2-3天

## 概述

处理开发过程中的需求变更，支持变更影响分析、规格更新、代码同步，确保变更过程可控且可追溯。

## ADDED Requirements

### REQ-001: 变更检测

The system SHALL detect changes in fspec files.

**检测方式:**

| 方式 | 触发时机 | 检测内容 |
|------|----------|----------|
| 文件监控 | 实时 | fspec 文件修改 |
| Git diff | 手动/定时 | 版本差异 |
| 内容对比 | 同步时 | 内存与文件对比 |

**Scenario: 检测 fspec 变更**
- WHEN fspec 文件被修改
- THEN 对比新旧版本
- AND 提取变更的 REQ/AC/Scenario

**变更类型:**

| 类型 | Delta 标记 | 影响 |
|------|-----------|------|
| 新增需求 | ADDED | 需要新实现 |
| 修改需求 | MODIFIED | 需要更新实现 |
| 删除需求 | REMOVED | 需要清理代码 |
| 澄清细节 | CLARIFIED | 可能需要调整 |

**Acceptance Criteria:**
- [ ] AC-001: 支持多种检测方式
- [ ] AC-002: 识别变更类型
- [ ] AC-003: 提取具体变更内容

### REQ-002: 影响分析

The system SHALL analyze change impact.

**影响分析维度:**

| 维度 | 分析内容 | 输出 |
|------|----------|------|
| 代码影响 | 受影响的源文件 | 文件列表 |
| 测试影响 | 需要更新的测试 | 测试文件列表 |
| 依赖影响 | 受影响的下游模块 | 依赖图 |
| 工作量影响 | 额外工作量评估 | 时间估算 |

**Scenario: 分析变更影响**
- WHEN 检测到 fspec 变更
- THEN 分析代码和测试影响
- AND 评估额外工作量
- AND 生成影响分析报告

**影响报告示例:**

```markdown
# 变更影响分析

> 变更来源: core/complexity-router.fspec.md
> 变更类型: MODIFIED REQ-002

## 变更内容

```diff
- 总分区间 5-8 路由到 Quick Flow
+ 总分区间 5-7 路由到 Quick Flow
+ 总分区间 8 路由到 Standard Flow (边界调整)
```

## 影响范围

### 代码影响
| 文件 | 影响类型 | 修改量 |
|------|----------|--------|
| lib/router/complexity.js | 逻辑修改 | ~10行 |
| lib/router/index.js | 无变化 | - |

### 测试影响
| 测试文件 | 需要更新 |
|----------|----------|
| test/router.test.js | 更新边界测试用例 |

### 下游依赖
- `workflow/flow-router.js` 需要同步验证

## 工作量评估
- 代码修改: ~30分钟
- 测试更新: ~20分钟
- 验证测试: ~10分钟
- **总计: ~1小时**
```

**Acceptance Criteria:**
- [ ] AC-004: 识别受影响代码
- [ ] AC-005: 识别受影响测试
- [ ] AC-006: 评估工作量

### REQ-003: 变更审批

The system SHALL support change approval workflow.

**审批流程:**

```
变更检测 → 影响分析 → 审批决策 → 执行变更
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
            批准        拒绝        延后
              │           │           │
              ▼           │           │
          执行变更        │           │
                          ▼           ▼
                      记录原因    加入待办
```

**Scenario: 变更审批**
- WHEN 生成影响分析报告
- THEN 展示给用户确认
- AND 记录审批决策和原因

**审批交互:**

```
📋 变更审批请求
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

变更: MODIFIED REQ-002 (评分阈值调整)
影响: 1 个源文件, 1 个测试文件
工作量: ~1小时

请选择: [A]批准 / [R]拒绝 / [L]延后 / [V]查看详情
```

**Acceptance Criteria:**
- [ ] AC-007: 支持批准/拒绝/延后
- [ ] AC-008: 记录决策原因
- [ ] AC-009: 延后任务可追踪

### REQ-004: 变更执行

The system SHALL execute approved changes.

**执行步骤:**

| 步骤 | 动作 | 验证 |
|------|------|------|
| 1 | 创建变更分支 | 分支存在 |
| 2 | 更新 fspec 状态 | 状态为 implementing |
| 3 | 生成代码变更 | emit 成功 |
| 4 | 更新测试 | 测试生成 |
| 5 | 运行验证 | 测试通过 |
| 6 | 更新 tasks.md | 任务同步 |

**Scenario: 执行变更**
- WHEN 变更被批准
- THEN 按步骤执行变更
- AND 每步验证后继续
- AND 失败时回滚

**Acceptance Criteria:**
- [ ] AC-010: 分步执行变更
- [ ] AC-011: 每步验证
- [ ] AC-012: 失败回滚

### REQ-005: 变更追溯

The system SHALL maintain change history for traceability.

**追溯信息:**

| 信息 | 存储位置 | 用途 |
|------|----------|------|
| 变更记录 | `.seed/changes/` | 历史查询 |
| Git 提交 | 代码仓库 | 代码回溯 |
| fspec 版本 | 文件版本号 | 规格对应 |
| 关联任务 | tasks.md | 任务追踪 |

**变更记录格式:**

```json
{
  "change_id": "CHG-20250101-001",
  "timestamp": "2025-01-01T14:30:00+08:00",
  "source": "core/complexity-router.fspec.md",
  "type": "MODIFIED",
  "target": "REQ-002",
  "description": "调整 Quick/Standard Flow 分界阈值",
  "impact": {
    "files": ["lib/router/complexity.js"],
    "tests": ["test/router.test.js"],
    "effort": "1h"
  },
  "approval": {
    "decision": "approved",
    "timestamp": "2025-01-01T14:35:00+08:00",
    "reason": "用户反馈 Quick Flow 太少触发"
  },
  "execution": {
    "status": "completed",
    "git_commit": "abc1234",
    "completed_at": "2025-01-01T15:30:00+08:00"
  }
}
```

**Acceptance Criteria:**
- [ ] AC-013: 完整的变更记录
- [ ] AC-014: 关联 Git 提交
- [ ] AC-015: 支持查询历史

### REQ-006: 批量变更

The system SHALL support batch change handling.

**Scenario: 批量变更处理**
- WHEN 检测到多个 fspec 变更
- THEN 合并影响分析
- AND 按依赖顺序执行
- AND 生成汇总报告

**批量策略:**

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| 串行 | 逐个执行 | 有依赖关系 |
| 并行 | 同时执行 | 无依赖关系 |
| 分组 | 按模块分组 | 大量变更 |

**Acceptance Criteria:**
- [ ] AC-016: 合并影响分析
- [ ] AC-017: 处理依赖关系
- [ ] AC-018: 生成汇总报告

## 导出接口

```javascript
module.exports = {
  // 变更检测
  detectChanges,            // (fspecPath) => Change[]
  watchFspec,               // (dir, callback) => Watcher
  compareVersions,          // (oldContent, newContent) => Diff

  // 影响分析
  analyzeImpact,            // (change) => ImpactAnalysis
  findAffectedFiles,        // (change) => string[]
  estimateEffort,           // (impact) => TimeEstimate

  // 审批流程
  requestApproval,          // (change, impact) => Promise<Decision>
  recordDecision,           // (changeId, decision, reason) => void

  // 执行
  executeChange,            // (change, impact) => ExecutionResult
  rollbackChange,           // (changeId) => void

  // 追溯
  recordChange,             // (change, execution) => void
  getChangeHistory,         // (fspecPath?) => ChangeRecord[]
  getChangeById,            // (changeId) => ChangeRecord

  // 批量处理
  batchProcess,             // (changes) => BatchResult
  mergeImpacts,             // (impacts[]) => MergedImpact
};
```

## 配置项

```json
{
  "changeHandler": {
    "watchEnabled": false,
    "autoApprove": false,
    "approvalRequired": ["MODIFIED", "REMOVED"],
    "historyDir": ".seed/changes/",
    "batchStrategy": "serial",
    "rollbackOnFailure": true
  }
}
```

## 依赖

- `lib/lifecycle/parser.js` - fspec 解析
- `core/task-sync.js` - 任务同步
- `automation/emit-engine.js` - 代码生成

## 测试要点

1. 变更检测准确性
2. 影响分析完整性
3. 审批流程正确性
4. 执行和回滚可靠性
5. 批量处理逻辑
