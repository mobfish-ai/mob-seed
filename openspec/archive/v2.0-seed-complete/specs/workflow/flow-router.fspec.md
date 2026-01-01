# Feature: Flow Router (工作流路由)

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/workflow/
> 优先级: P0
> 预计工作量: 3-5天

## 概述

根据 Complexity Router 的评分结果，执行对应的工作流（Quick/Standard/Full），每种工作流有不同的阶段和验证要求。

## ADDED Requirements

### REQ-001: Quick Flow 实现

The system SHALL implement Quick Flow for simple tasks (score 5-8).

**Quick Flow 阶段:**

```
用户需求 → [理解] → [实现] → [验证] → 完成
              │         │        │
              └ 口头确认  └ 直接编码 └ 运行测试
```

**Scenario: 执行 Quick Flow**
- WHEN Complexity Router 返回 `flow: 'quick'`
- THEN 执行简化的 3 阶段流程
- AND 跳过规格编写和详细规划

**阶段详情:**

| 阶段 | 动作 | 输出 |
|------|------|------|
| 理解 | AI 复述需求，用户口头确认 | 确认记录 |
| 实现 | 直接编码，无需详细规格 | 代码变更 |
| 验证 | 运行测试，检查结果 | 测试报告 |

**Acceptance Criteria:**
- [ ] AC-001: 总耗时 < 30分钟（典型场景）
- [ ] AC-002: 无需创建 .fspec.md 文件
- [ ] AC-003: 支持快速迭代

### REQ-002: Standard Flow 实现

The system SHALL implement Standard Flow for moderate tasks (score 9-12).

**Standard Flow 阶段:**

```
用户需求 → [分析] → [设计] → [实现] → [测试] → [文档] → 完成
              │        │        │        │        │
              └ 需求分析 └ 简要设计 └ 分步实现 └ 测试验证 └ 更新文档
```

**Scenario: 执行 Standard Flow**
- WHEN Complexity Router 返回 `flow: 'standard'`
- THEN 执行标准的 5 阶段流程
- AND 创建简化版规格文件

**阶段详情:**

| 阶段 | 动作 | 输出 | 阶段门禁 |
|------|------|------|----------|
| 分析 | 理解需求，拆解任务 | tasks.md | 任务清晰 |
| 设计 | 简要技术方案 | 方案描述 | 方案可行 |
| 实现 | 分步编码 | 代码变更 | 代码完成 |
| 测试 | 运行验证 | 测试报告 | 测试通过 |
| 文档 | 更新相关文档 | 文档变更 | 文档同步 |

**Acceptance Criteria:**
- [ ] AC-004: 总耗时 2-4小时（典型场景）
- [ ] AC-005: 创建简化版 tasks.md
- [ ] AC-006: 支持阶段回退

### REQ-003: Full Flow 实现

The system SHALL implement Full Flow for complex tasks (score 13-15).

**Full Flow 阶段:**

```
用户需求 → [研究] → [规格] → [设计] → [实现] → [测试] → [文档] → [评审] → 完成
              │        │        │        │        │        │        │
              └ 深入研究 └ 完整fspec └ 详细设计 └ 分阶段实现 └ 全面测试 └ 完整文档 └ 代码评审
```

**Scenario: 执行 Full Flow**
- WHEN Complexity Router 返回 `flow: 'full'`
- THEN 执行完整的 7 阶段流程
- AND 创建完整版规格文件

**阶段详情:**

| 阶段 | 动作 | 输出 | 阶段门禁 |
|------|------|------|----------|
| 研究 | 调研现有实现、最佳实践 | 研究报告 | 理解充分 |
| 规格 | 编写完整 fspec | *.fspec.md | 规格完整 |
| 设计 | 详细技术方案 | 设计文档 | 设计评审通过 |
| 实现 | 分阶段编码 | 代码变更 | 每阶段验证 |
| 测试 | 单元+集成测试 | 测试报告 | 覆盖率达标 |
| 文档 | 完整文档更新 | 文档变更 | 文档完整 |
| 评审 | 代码评审 | 评审意见 | 评审通过 |

**Acceptance Criteria:**
- [ ] AC-007: 支持多日开发
- [ ] AC-008: 完整的 fspec 生命周期
- [ ] AC-009: 强制阶段门禁验证

### REQ-004: 流程状态管理

The system SHALL maintain flow execution state.

**Scenario: 保存流程状态**
- WHEN 完成一个阶段
- THEN 更新 `.seed/flow-state.json`
- AND 包含当前阶段、已完成阶段、下一步

**Scenario: 恢复流程状态**
- WHEN 会话中断后重新启动
- THEN 读取 `.seed/flow-state.json`
- AND 从中断点继续

**Acceptance Criteria:**
- [ ] AC-010: 支持会话中断恢复
- [ ] AC-011: 记录每阶段开始/结束时间
- [ ] AC-012: 支持手动跳过阶段

### REQ-005: 阶段转换控制

The system SHALL control stage transitions.

**Scenario: 正常阶段转换**
- WHEN 当前阶段验证通过
- THEN 自动进入下一阶段
- AND 输出阶段总结

**Scenario: 阶段回退**
- WHEN 发现前序阶段问题
- THEN 允许回退到指定阶段
- AND 记录回退原因

**Scenario: 阶段跳过**
- WHEN 用户显式请求跳过 (`--skip-stage=design`)
- THEN 记录跳过原因
- AND 继续执行后续阶段

**Acceptance Criteria:**
- [ ] AC-013: 默认顺序执行
- [ ] AC-014: 支持 `--skip-stage` 参数
- [ ] AC-015: 回退时保留原有产物

### REQ-006: 流程输出管理

The system SHALL manage flow outputs.

**Scenario: 组织流程输出**
- WHEN 流程执行产生输出
- THEN 按阶段组织到 `output/flow/{flow-id}/`
- AND 生成流程总结报告

**输出目录结构:**

```
output/flow/{flow-id}/
├── flow-summary.md       # 流程总结
├── stage-1-analysis/     # 阶段1输出
├── stage-2-design/       # 阶段2输出
├── ...
└── flow-state.json       # 状态快照
```

**Acceptance Criteria:**
- [ ] AC-016: 每阶段独立目录
- [ ] AC-017: 生成可读的 flow-summary.md
- [ ] AC-018: flow-id 基于时间戳

## 导出接口

```javascript
module.exports = {
  // 流程执行
  executeFlow,           // (flowType, taskContext) => FlowResult
  executeQuickFlow,      // (taskContext) => FlowResult
  executeStandardFlow,   // (taskContext) => FlowResult
  executeFullFlow,       // (taskContext) => FlowResult

  // 阶段控制
  getCurrentStage,       // (flowId) => Stage
  advanceStage,          // (flowId) => Stage
  revertStage,           // (flowId, targetStage) => Stage
  skipStage,             // (flowId, stageName, reason) => void

  // 状态管理
  saveFlowState,         // (flowId, state) => void
  loadFlowState,         // (flowId) => FlowState | null
  getActiveFlows,        // () => FlowInfo[]

  // 输出管理
  getFlowOutputDir,      // (flowId) => string
  generateFlowSummary,   // (flowId) => string
};
```

## 配置项

```json
{
  "workflow": {
    "outputDir": "output/flow",
    "stateFile": ".seed/flow-state.json",
    "gates": {
      "quick": ["understand", "implement", "verify"],
      "standard": ["analyze", "design", "implement", "test", "document"],
      "full": ["research", "spec", "design", "implement", "test", "document", "review"]
    },
    "timeouts": {
      "quick": "1h",
      "standard": "8h",
      "full": "72h"
    }
  }
}
```

## 依赖

- `core/complexity-router` - 复杂度评分
- `core/task-sync` - 任务同步（用于 tasks.md）

## 测试要点

1. 三种 Flow 完整执行
2. 阶段转换正确性
3. 状态持久化和恢复
4. 中断恢复场景
5. 超时处理
