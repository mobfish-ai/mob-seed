# Flow Router (工作流路由)

> Quick/Standard/Full 工作流执行引擎

## 概述

根据 Complexity Router 的评分结果，执行对应的工作流（Quick/Standard/Full），每种工作流有不同的阶段和验证要求。

## 安装

```javascript
const {
  executeFlow,
  executeQuickFlow,
  executeStandardFlow,
  executeFullFlow,
  getCurrentStage,
  advanceStage,
  revertStage,
  skipStage,
  saveFlowState,
  loadFlowState,
  getActiveFlows,
  getFlowOutputDir,
  generateFlowSummary
} = require('mob-seed/lib/workflow/flow-router');
```

## API

### executeFlow(flowType, taskContext)

执行指定类型的工作流。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowType | string | 工作流类型 ('quick' | 'standard' | 'full') |
| taskContext | object | 任务上下文 |

**返回:**

```javascript
{
  flowId: string,
  flowType: string,
  completed: boolean,
  stages: StageResult[],
  summary: object
}
```

### executeQuickFlow(taskContext)

执行 Quick Flow（简单任务，评分 5-8）。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskContext | object | 任务上下文 |

**返回:** `FlowResult`

**Quick Flow 阶段:**

```
用户需求 → [理解] → [实现] → [验证] → 完成
              │         │        │
              └ 口头确认  └ 直接编码 └ 运行测试
```

| 阶段 | 动作 | 输出 |
|------|------|------|
| 理解 | AI 复述需求，用户口头确认 | 确认记录 |
| 实现 | 直接编码，无需详细规格 | 代码变更 |
| 验证 | 运行测试，检查结果 | 测试报告 |

### executeStandardFlow(taskContext)

执行 Standard Flow（中等任务，评分 9-12）。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskContext | object | 任务上下文 |

**返回:** `FlowResult`

**Standard Flow 阶段:**

```
用户需求 → [分析] → [设计] → [实现] → [测试] → [文档] → 完成
```

| 阶段 | 动作 | 输出 | 门禁 |
|------|------|------|------|
| 分析 | 理解需求，拆解任务 | tasks.md | 任务清晰 |
| 设计 | 简要技术方案 | 方案描述 | 方案可行 |
| 实现 | 分步编码 | 代码变更 | 代码完成 |
| 测试 | 运行验证 | 测试报告 | 测试通过 |
| 文档 | 更新相关文档 | 文档变更 | 文档同步 |

### executeFullFlow(taskContext)

执行 Full Flow（复杂任务，评分 13-15）。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskContext | object | 任务上下文 |

**返回:** `FlowResult`

**Full Flow 阶段:**

```
用户需求 → [研究] → [规格] → [设计] → [实现] → [测试] → [文档] → [评审] → 完成
```

| 阶段 | 动作 | 输出 | 门禁 |
|------|------|------|------|
| 研究 | 调研现有实现 | 研究报告 | 理解充分 |
| 规格 | 编写完整 fspec | *.fspec.md | 规格完整 |
| 设计 | 详细技术方案 | 设计文档 | 设计评审通过 |
| 实现 | 分阶段编码 | 代码变更 | 每阶段验证 |
| 测试 | 单元+集成测试 | 测试报告 | 覆盖率达标 |
| 文档 | 完整文档更新 | 文档变更 | 文档完整 |
| 评审 | 代码评审 | 评审意见 | 评审通过 |

### getCurrentStage(flowId)

获取当前阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:**

```javascript
{
  name: string,
  index: number,
  startedAt: Date,
  status: 'pending' | 'in_progress' | 'completed'
}
```

### advanceStage(flowId)

推进到下一阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `Stage` - 新的当前阶段

### revertStage(flowId, targetStage)

回退到指定阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| targetStage | string | 目标阶段名称 |

**返回:** `Stage` - 回退后的阶段

### skipStage(flowId, stageName, reason)

跳过指定阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| stageName | string | 阶段名称 |
| reason | string | 跳过原因 |

**返回:** void

### saveFlowState(flowId, state)

保存工作流状态。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| state | FlowState | 状态对象 |

**返回:** void

### loadFlowState(flowId)

加载工作流状态。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `FlowState | null`

### getActiveFlows()

获取所有活动的工作流。

**参数:** 无

**返回:**

```javascript
[
  {
    flowId: string,
    flowType: string,
    currentStage: string,
    startedAt: Date
  }
]
```

### getFlowOutputDir(flowId)

获取工作流输出目录。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `string` - 输出目录路径

### generateFlowSummary(flowId)

生成工作流总结。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `string` - Markdown 格式总结

## 输出目录结构

```
output/flow/{flow-id}/
├── flow-summary.md       # 流程总结
├── stage-1-analysis/     # 阶段1输出
├── stage-2-design/       # 阶段2输出
├── ...
└── flow-state.json       # 状态快照
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

## 工作流对比

| 特性 | Quick | Standard | Full |
|------|-------|----------|------|
| 评分范围 | 5-8 | 9-12 | 13-15 |
| 阶段数 | 3 | 5 | 7 |
| 预计时长 | ~30分钟 | 2-4小时 | 1-3天 |
| fspec 文件 | 无 | 简化版 | 完整版 |
| 阶段门禁 | 无 | 有 | 强制 |

## 相关链接

- [规格文件](../../openspec/specs/workflow/flow-router.fspec.md)
- [源代码](../../skills/mob-seed/lib/workflow/flow-router.js)
- [测试](../../skills/mob-seed/test/workflow/flow-router.test.js)
