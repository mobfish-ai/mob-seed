# Feature: Pre-Implementation Confirmation (实现前确认)

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/workflow/
> 优先级: P2
> 预计工作量: 1-2天

## 概述

在开始实现阶段之前，展示即将执行的操作清单供用户确认，避免意外的大规模变更，确保用户对即将发生的修改有清晰的预期。

## ADDED Requirements

### REQ-001: 变更预览生成

The system SHALL generate change preview before implementation.

**预览内容:**

| 类型 | 展示内容 | 风险等级 |
|------|----------|----------|
| 新建文件 | 文件路径、预估行数 | 低 |
| 修改文件 | 文件路径、变更范围 | 中 |
| 删除文件 | 文件路径、是否有备份 | 高 |
| 依赖变更 | 新增/删除的依赖 | 中 |
| 配置变更 | 配置文件修改项 | 中 |

**Scenario: 生成变更预览**
- WHEN 完成设计阶段准备进入实现
- THEN 分析设计方案提取变更清单
- AND 按风险等级分类展示

**Acceptance Criteria:**
- [x] AC-001: 提取所有文件变更
- [x] AC-002: 标注风险等级
- [x] AC-003: 估算变更规模

### REQ-002: 确认交互流程

The system SHALL require user confirmation before implementation.

**确认界面:**

```
📋 实现前确认
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 变更概览
   新建: 5 个文件
   修改: 3 个文件
   删除: 1 个文件

📁 详细清单

🟢 新建文件:
   + lib/router/complexity.js      (~120 行)
   + lib/router/flow.js            (~200 行)
   + lib/sync/task-sync.js         (~150 行)
   + test/router.test.js           (~80 行)
   + test/sync.test.js             (~60 行)

🟡 修改文件:
   ~ lib/core/engine.js            (+30/-10 行)
   ~ config/seed.config.json       (+15/-0 行)
   ~ SKILL.md                      (+20/-5 行)

🔴 删除文件:
   - lib/deprecated/old-router.js  (已备份)

⚠️ 风险提示:
   - 修改 engine.js 可能影响现有功能
   - 建议先运行现有测试确保基线通过

确认开始实现? [Y/n/查看详情/跳过某项]
```

**Scenario: 用户确认流程**
- WHEN 展示变更预览
- AND 用户输入确认
- THEN 根据用户选择执行对应操作

**用户选项:**

| 输入 | 动作 |
|------|------|
| Y/yes/回车 | 确认全部变更，开始实现 |
| n/no | 取消实现，返回设计阶段 |
| v/view | 查看某个文件的详细变更 |
| s/skip | 跳过某个变更项 |
| e/edit | 手动编辑变更清单 |

**Acceptance Criteria:**
- [x] AC-004: 清晰的确认界面
- [x] AC-005: 支持多种用户选择
- [x] AC-006: 可查看详细变更

### REQ-003: 风险评估

The system SHALL assess implementation risks.

**风险评估维度:**

| 维度 | 低风险 | 中风险 | 高风险 |
|------|--------|--------|--------|
| 文件数量 | ≤5 | 6-15 | >15 |
| 修改核心文件 | 无 | 1-2个 | >2个 |
| 删除操作 | 无 | 有备份 | 无备份 |
| 依赖变更 | 无 | 小版本 | 大版本/新增 |
| 影响范围 | 单模块 | 跨模块 | 全局 |

**Scenario: 高风险变更警告**
- WHEN 变更被评估为高风险
- THEN 显示醒目警告
- AND 要求输入确认短语（如 "我确认"）

**Acceptance Criteria:**
- [x] AC-007: 多维度风险评估
- [x] AC-008: 高风险特殊确认
- [x] AC-009: 风险说明清晰

### REQ-004: 变更清单持久化

The system SHALL persist change list for tracking.

**Scenario: 保存变更清单**
- WHEN 用户确认变更
- THEN 保存到 `.seed/impl-plan.json`
- AND 记录确认时间和用户选择

**变更清单格式:**

```json
{
  "version": "1.0",
  "confirmed_at": "2025-01-01T14:30:00+08:00",
  "flow_id": "flow-20250101-143000",
  "changes": [
    {
      "type": "create",
      "path": "lib/router/complexity.js",
      "estimated_lines": 120,
      "risk": "low",
      "status": "pending"
    },
    {
      "type": "modify",
      "path": "lib/core/engine.js",
      "additions": 30,
      "deletions": 10,
      "risk": "medium",
      "status": "pending"
    }
  ],
  "skipped": [],
  "total_risk": "medium"
}
```

**Acceptance Criteria:**
- [x] AC-010: JSON 格式持久化
- [x] AC-011: 记录用户选择
- [x] AC-012: 支持断点恢复

### REQ-005: 增量确认

The system SHALL support incremental confirmation for large changes.

**Scenario: 大规模变更分批确认**
- WHEN 变更文件数 > 10
- THEN 分批展示（每批 5-10 个）
- AND 支持逐批确认

**Scenario: 模块级确认**
- WHEN 变更跨多个模块
- THEN 按模块分组展示
- AND 支持按模块确认/跳过

**Acceptance Criteria:**
- [x] AC-013: 支持分批确认
- [x] AC-014: 支持按模块确认
- [x] AC-015: 保留已确认的选择

### REQ-006: 回滚准备

The system SHALL prepare rollback capability before implementation.

**Scenario: 创建回滚点**
- WHEN 用户确认开始实现
- THEN 创建当前状态快照
- AND 生成回滚脚本

**回滚信息:**

| 内容 | 存储位置 |
|------|----------|
| 修改文件备份 | `.seed/backups/{flow-id}/` |
| 变更前 git commit | 记录 SHA |
| 回滚脚本 | `.seed/rollback-{flow-id}.sh` |

**Acceptance Criteria:**
- [x] AC-016: 自动创建备份
- [x] AC-017: 生成回滚脚本
- [x] AC-018: 记录 git 状态

## 导出接口

```javascript
module.exports = {
  // 预览生成
  generateChangePreview,    // (designPlan) => ChangePreview
  analyzeChanges,           // (designPlan) => ChangeItem[]

  // 风险评估
  assessRisk,               // (changes) => RiskAssessment
  getRiskLevel,             // (change) => 'low' | 'medium' | 'high'

  // 用户交互
  showConfirmation,         // (preview) => Promise<UserChoice>
  processUserChoice,        // (choice, preview) => Action

  // 持久化
  saveImplPlan,             // (changes, userChoices) => void
  loadImplPlan,             // (flowId) => ImplPlan | null

  // 回滚准备
  createRollbackPoint,      // (changes) => RollbackInfo
  executeRollback,          // (flowId) => void
};
```

## 配置项

```json
{
  "preImplConfirmation": {
    "enabled": true,
    "batchSize": 10,
    "highRiskConfirmPhrase": "我确认",
    "autoBackup": true,
    "backupDir": ".seed/backups/",
    "skipForQuickFlow": true
  }
}
```

## 依赖

- `workflow/flow-router.js` - 工作流状态
- `core/task-sync.js` - 任务追踪

## 测试要点

1. 变更提取准确性
2. 风险评估合理性
3. 用户交互流畅性
4. 回滚功能可靠性
5. 大规模变更处理
