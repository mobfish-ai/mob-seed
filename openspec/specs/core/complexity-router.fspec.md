---
status: archived
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/router/
priority: P0
estimated_effort: 2-3天
---
# Feature: Complexity Router (复杂度路由器)
## 概述

五维度任务复杂度评估系统，根据评分结果路由到不同的工作流（Quick/Standard/Full）。

## ADDED Requirements

### REQ-001: 五维度评分模型

The system SHALL evaluate task complexity using 5 dimensions.

**维度定义:**

| 维度 | 英文名 | 评分标准 |
|------|--------|----------|
| 影响范围 | impact_scope | 1=单文件, 2=多文件, 3=跨模块 |
| 架构变更 | architecture_change | 1=无, 2=小调整, 3=重构 |
| 外部依赖 | external_deps | 1=无, 2=少量, 3=多个 |
| 业务复杂度 | business_complexity | 1=简单, 2=中等, 3=复杂 |
| 不确定性 | uncertainty | 1=低, 2=中, 3=高 |

**Scenario: 评估任务复杂度**
- WHEN 输入任务描述和上下文
- AND 系统分析各维度特征
- THEN 返回 5 个维度的评分 (1-3)
- AND 返回总分 (5-15)

**Acceptance Criteria:**
- [x] AC-001: 每个维度独立评分 1-3
- [x] AC-002: 总分范围 5-15
- [x] AC-003: 支持手动覆盖评分

### REQ-002: 评分区间路由

The system SHALL route tasks to workflow based on total score.

**路由规则:**

| 总分区间 | 工作流 | 预计时长 |
|----------|--------|----------|
| 5-8 | Quick Flow | ~30分钟 |
| 9-12 | Standard Flow | ~2-4小时 |
| 13-15 | Full Flow | ~1-3天 |

**Scenario: 路由到 Quick Flow**
- WHEN 任务总分 <= 8
- THEN 返回 `{ flow: 'quick', estimatedTime: '30min' }`

**Scenario: 路由到 Standard Flow**
- WHEN 任务总分 >= 9 AND <= 12
- THEN 返回 `{ flow: 'standard', estimatedTime: '2-4h' }`

**Scenario: 路由到 Full Flow**
- WHEN 任务总分 >= 13
- THEN 返回 `{ flow: 'full', estimatedTime: '1-3d' }`

**Acceptance Criteria:**
- [x] AC-004: 正确识别 Quick Flow 任务
- [x] AC-005: 正确识别 Standard Flow 任务
- [x] AC-006: 正确识别 Full Flow 任务

### REQ-003: AI 辅助评分

The system SHALL use AI to analyze task description and suggest scores.

**Scenario: AI 分析任务复杂度**
- WHEN 输入自然语言任务描述
- AND 输入项目上下文（代码库结构、技术栈）
- THEN AI 分析并返回建议的各维度评分
- AND 返回评分理由

**Acceptance Criteria:**
- [x] AC-007: 支持中英文任务描述
- [x] AC-008: 考虑项目上下文
- [x] AC-009: 提供评分理由说明
- [x] AC-010: 支持用户确认或修改

### REQ-004: 评分历史记录

The system SHALL maintain scoring history for learning and calibration.

**Scenario: 记录评分历史**
- WHEN 完成一次任务评分
- THEN 记录评分详情到 `.seed/router-history.jsonl`
- AND 包含实际完成时间（如已知）

**Acceptance Criteria:**
- [x] AC-011: JSONL 格式存储
- [x] AC-012: 包含时间戳、任务描述、评分、路由结果
- [x] AC-013: 支持查询历史评分

### REQ-005: 边界情况处理

The system SHALL handle edge cases gracefully.

**Scenario: 信息不足**
- WHEN 任务描述过于简单，无法准确评估
- THEN 返回 `{ confidence: 'low', suggestFlow: 'standard' }`
- AND 提示用户补充信息

**Scenario: 强制路由**
- WHEN 用户显式指定工作流 (`--flow=quick`)
- THEN 跳过评分，直接使用指定工作流
- AND 记录为手动覆盖

**Acceptance Criteria:**
- [x] AC-014: 返回置信度指标
- [x] AC-015: 支持 `--flow` 参数覆盖
- [x] AC-016: 不确定时默认 Standard Flow

## 导出接口

```javascript
module.exports = {
  // 核心评分
  evaluateComplexity,    // (taskDesc, context) => { scores, total, confidence }
  routeToFlow,           // (totalScore) => { flow, estimatedTime }

  // AI 辅助
  analyzeWithAI,         // (taskDesc, projectContext) => { scores, reasoning }

  // 历史管理
  recordScore,           // (scoreResult) => void
  getScoreHistory,       // (filter) => ScoreRecord[]

  // 工具函数
  parseFlowOverride,     // (args) => string | null
  getDefaultScores,      // () => DimensionScores
};
```

## 配置项

```json
{
  "router": {
    "thresholds": {
      "quick": 8,
      "standard": 12
    },
    "defaultConfidence": 0.7,
    "historyFile": ".seed/router-history.jsonl",
    "aiAssisted": true
  }
}
```

## 依赖

- 无外部依赖（P0 基础模块）

## 测试要点

1. 边界值测试：5, 8, 9, 12, 13, 15
2. AI 评分一致性
3. 历史记录读写
4. 参数覆盖优先级
