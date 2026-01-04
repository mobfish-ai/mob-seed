---
status: archived
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/quality/
priority: P1
estimated_effort: 2-3天
---
# Feature: Debug Protocol (调试协议)
## 概述

基于置信度的调试决策协议，当 AI 置信度 ≥50% 时自动尝试修复，<50% 时请求人工介入，确保调试过程的效率和可靠性。

## ADDED Requirements

### REQ-001: 置信度评估模型

The system SHALL evaluate confidence for debugging decisions.

**置信度维度:**

| 维度 | 权重 | 评估内容 |
|------|------|----------|
| 错误类型识别 | 30% | 能否准确识别错误类型 |
| 根因定位 | 25% | 能否定位到具体代码位置 |
| 修复方案 | 25% | 有无明确的修复思路 |
| 影响范围 | 20% | 能否评估修复的影响 |

**Scenario: 计算调试置信度**
- WHEN 遇到错误或异常
- THEN 分析错误信息和上下文
- AND 计算各维度得分
- AND 返回加权总置信度 (0-100%)

**Acceptance Criteria:**
- [x] AC-001: 置信度范围 0-100%
- [x] AC-002: 各维度独立评分
- [x] AC-003: 支持自定义权重

### REQ-002: 自动修复流程 (置信度 ≥50%)

The system SHALL attempt auto-fix when confidence ≥50%.

**Scenario: 高置信度自动修复**
- WHEN 调试置信度 ≥ 50%
- THEN 生成修复方案
- AND 自动应用修复
- AND 运行验证测试
- AND 如果测试失败，回滚并降级到人工介入

**修复流程:**

```
错误检测 → 置信度评估 → ≥50% → 生成修复方案
                                    │
                                    ▼
                              应用修复代码
                                    │
                                    ▼
                              运行验证测试
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
                测试通过                        测试失败
                    │                               │
                    ▼                               ▼
                修复完成                        回滚修复
                                                    │
                                                    ▼
                                              降级到人工介入
```

**Acceptance Criteria:**
- [x] AC-004: 修复前创建代码快照
- [x] AC-005: 修复后自动验证
- [x] AC-006: 失败自动回滚

### REQ-003: 人工介入流程 (置信度 <50%)

The system SHALL request human intervention when confidence <50%.

**Scenario: 低置信度人工介入**
- WHEN 调试置信度 < 50%
- THEN 生成调试报告
- AND 列出可能的原因和修复方向
- AND 请求用户确认或补充信息

**人工介入交互:**

```
🔧 调试协议 - 需要人工介入
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 置信度: 35%
   - 错误类型识别: 60%
   - 根因定位: 30%
   - 修复方案: 20%
   - 影响范围: 40%

❓ 不确定的原因:
   1. 错误信息不完整
   2. 可能涉及外部依赖
   3. 需要更多上下文

💡 可能的方向:
   A. 检查数据库连接配置
   B. 验证 API 密钥有效性
   C. 查看完整错误日志

请选择方向或提供更多信息: [A/B/C/输入补充信息]
```

**Acceptance Criteria:**
- [x] AC-007: 展示置信度详细分数
- [x] AC-008: 提供可能的调试方向
- [x] AC-009: 支持用户补充信息后重新评估

### REQ-004: 调试上下文收集

The system SHALL collect debugging context automatically.

**收集的上下文:**

| 类型 | 内容 | 收集方式 |
|------|------|----------|
| 错误信息 | 错误类型、消息、堆栈 | 自动捕获 |
| 代码上下文 | 出错位置前后代码 | 文件读取 |
| 执行历史 | 最近的操作和变更 | 日志分析 |
| 环境信息 | Node版本、依赖版本 | 命令执行 |
| 相关测试 | 相关的测试用例 | 测试扫描 |

**Scenario: 自动收集调试上下文**
- WHEN 进入调试模式
- THEN 自动收集上述所有上下文
- AND 整理为结构化的调试上下文对象

**Acceptance Criteria:**
- [x] AC-010: 自动解析错误堆栈
- [x] AC-011: 提取相关代码片段
- [x] AC-012: 收集环境信息

### REQ-005: 调试历史记录

The system SHALL maintain debugging history for learning.

**Scenario: 记录调试历史**
- WHEN 完成一次调试（成功或失败）
- THEN 记录到 `.seed/debug-history.jsonl`
- AND 包含错误类型、置信度、修复方案、结果

**历史记录格式:**

```json
{
  "timestamp": "2025-01-01T14:30:00+08:00",
  "error_type": "TypeError",
  "error_message": "Cannot read property 'x' of undefined",
  "confidence": 0.65,
  "confidence_details": {
    "error_type": 0.8,
    "root_cause": 0.6,
    "fix_solution": 0.5,
    "impact_scope": 0.7
  },
  "action": "auto_fix",
  "fix_applied": "Add null check before accessing property",
  "result": "success",
  "verification": "all tests passed"
}
```

**Acceptance Criteria:**
- [x] AC-013: JSONL 格式存储
- [x] AC-014: 记录完整的调试过程
- [x] AC-015: 支持查询相似历史问题

### REQ-006: 调试报告生成

The system SHALL generate debugging reports.

**Scenario: 生成调试报告**
- WHEN 调试完成或请求人工介入
- THEN 生成 Markdown 格式报告
- AND 包含问题描述、分析过程、修复方案

**报告格式:**

```markdown
# 调试报告

> 时间: 2025-01-01 14:30:00
> 状态: ✅ 已修复 / ⏳ 等待人工介入

## 问题描述

**错误类型**: TypeError
**错误消息**: Cannot read property 'map' of undefined
**发生位置**: src/utils/parser.js:42

## 置信度分析

| 维度 | 得分 | 说明 |
|------|------|------|
| 错误类型识别 | 80% | 常见的空值访问错误 |
| 根因定位 | 60% | 可能在数据获取环节 |
| 修复方案 | 50% | 需要添加空值检查 |
| 影响范围 | 70% | 仅影响解析模块 |

**总置信度**: 65%

## 修复方案

```diff
- const result = data.items.map(...)
+ const result = (data?.items || []).map(...)
```

## 验证结果

- ✅ 单元测试通过
- ✅ 相关集成测试通过
```

**Acceptance Criteria:**
- [x] AC-016: Markdown 格式报告
- [x] AC-017: 包含 diff 格式的修复代码
- [x] AC-018: 包含验证结果

## 导出接口

```javascript
module.exports = {
  // 置信度评估
  evaluateConfidence,     // (error, context) => ConfidenceResult
  calculateDimensionScore, // (dimension, error, context) => number

  // 修复流程
  attemptAutoFix,         // (error, context) => FixResult
  generateFixPlan,        // (error, context) => FixPlan
  applyFix,               // (fixPlan) => void
  rollbackFix,            // (snapshot) => void

  // 人工介入
  requestHumanIntervention, // (error, analysis) => void
  processUserInput,         // (input, error) => ReEvaluationResult

  // 上下文收集
  collectDebugContext,    // (error) => DebugContext
  parseErrorStack,        // (stack) => StackFrame[]

  // 历史管理
  recordDebugSession,     // (session) => void
  findSimilarIssues,      // (error) => DebugRecord[]

  // 报告生成
  generateDebugReport,    // (session) => string
};
```

## 配置项

```json
{
  "debugProtocol": {
    "confidenceThreshold": 0.5,
    "dimensionWeights": {
      "error_type": 0.3,
      "root_cause": 0.25,
      "fix_solution": 0.25,
      "impact_scope": 0.2
    },
    "autoRollbackOnFailure": true,
    "historyFile": ".seed/debug-history.jsonl",
    "reportDir": "output/debug/"
  }
}
```

## 依赖

- `core/task-sync.js` - 任务状态同步
- `workflow/flow-router.js` - 工作流状态

## 测试要点

1. 置信度计算准确性
2. 自动修复流程完整性
3. 回滚机制可靠性
4. 人工介入交互
5. 历史记录和检索
