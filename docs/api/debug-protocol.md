# Debug Protocol (调试协议)

> 基于置信度的调试决策协议

## 概述

基于置信度的调试决策协议，当 AI 置信度 >=50% 时自动尝试修复，<50% 时请求人工介入，确保调试过程的效率和可靠性。

## 安装

```javascript
const {
  evaluateConfidence,
  calculateDimensionScore,
  attemptAutoFix,
  generateFixPlan,
  applyFix,
  rollbackFix,
  requestHumanIntervention,
  processUserInput,
  collectDebugContext,
  parseErrorStack,
  recordDebugSession,
  findSimilarIssues,
  generateDebugReport
} = require('mob-seed/lib/quality/debug-protocol');
```

## API

### evaluateConfidence(error, context)

评估调试置信度。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |
| context | DebugContext | 调试上下文 |

**返回:**

```javascript
{
  overall: number,         // 总置信度 (0-100)
  dimensions: {
    errorType: number,     // 错误类型识别 (30%)
    rootCause: number,     // 根因定位 (25%)
    fixSolution: number,   // 修复方案 (25%)
    impactScope: number    // 影响范围 (20%)
  },
  recommendation: string   // 'auto_fix' | 'human_intervention'
}
```

**示例:**

```javascript
const result = await evaluateConfidence(error, context);
// { overall: 65, dimensions: {...}, recommendation: 'auto_fix' }
```

### calculateDimensionScore(dimension, error, context)

计算单个维度得分。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| dimension | string | 维度名称 |
| error | Error | 错误对象 |
| context | DebugContext | 调试上下文 |

**返回:** `number` - 维度得分 (0-100)

### attemptAutoFix(error, context)

尝试自动修复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |
| context | DebugContext | 调试上下文 |

**返回:**

```javascript
{
  success: boolean,
  fix: FixPlan | null,
  verification: {
    testsPassed: boolean,
    output: string
  }
}
```

### generateFixPlan(error, context)

生成修复方案。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |
| context | DebugContext | 调试上下文 |

**返回:**

```javascript
{
  file: string,
  line: number,
  original: string,
  fixed: string,
  explanation: string
}
```

### applyFix(fixPlan)

应用修复方案。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fixPlan | FixPlan | 修复方案 |

**返回:** void

### rollbackFix(snapshot)

回滚修复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| snapshot | CodeSnapshot | 代码快照 |

**返回:** void

### requestHumanIntervention(error, analysis)

请求人工介入。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |
| analysis | ConfidenceResult | 置信度分析 |

**返回:** void - 显示交互界面

### processUserInput(input, error)

处理用户输入后重新评估。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| input | string | 用户补充信息 |
| error | Error | 错误对象 |

**返回:** `ReEvaluationResult` - 重新评估结果

### collectDebugContext(error)

自动收集调试上下文。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |

**返回:**

```javascript
{
  errorInfo: {
    type: string,
    message: string,
    stack: StackFrame[]
  },
  codeContext: string,    // 出错位置前后代码
  executionHistory: array,
  environment: object,
  relatedTests: string[]
}
```

### parseErrorStack(stack)

解析错误堆栈。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| stack | string | 堆栈字符串 |

**返回:**

```javascript
[
  {
    file: string,
    line: number,
    column: number,
    function: string
  }
]
```

### recordDebugSession(session)

记录调试会话。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| session | DebugSession | 调试会话 |

**返回:** void

### findSimilarIssues(error)

查找相似的历史问题。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| error | Error | 错误对象 |

**返回:** `DebugRecord[]` - 相似问题列表

### generateDebugReport(session)

生成调试报告。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| session | DebugSession | 调试会话 |

**返回:** `string` - Markdown 格式报告

## 置信度维度

| 维度 | 权重 | 评估内容 |
|------|------|----------|
| 错误类型识别 | 30% | 能否准确识别错误类型 |
| 根因定位 | 25% | 能否定位到具体代码位置 |
| 修复方案 | 25% | 有无明确的修复思路 |
| 影响范围 | 20% | 能否评估修复的影响 |

## 决策流程

```
错误检测 → 置信度评估 → >=50% → 生成修复方案
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

## 人工介入交互

```
调试协议 - 需要人工介入
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

置信度: 35%
   - 错误类型识别: 60%
   - 根因定位: 30%
   - 修复方案: 20%
   - 影响范围: 40%

不确定的原因:
   1. 错误信息不完整
   2. 可能涉及外部依赖
   3. 需要更多上下文

可能的方向:
   A. 检查数据库连接配置
   B. 验证 API 密钥有效性
   C. 查看完整错误日志

请选择方向或提供更多信息: [A/B/C/输入补充信息]
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

## 相关链接

- [规格文件](../../openspec/specs/quality/debug-protocol.fspec.md)
- [源代码](../../skills/mob-seed/lib/quality/debug-protocol.js)
- [测试](../../skills/mob-seed/test/quality/debug-protocol.test.js)
