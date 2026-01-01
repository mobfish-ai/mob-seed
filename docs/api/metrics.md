# Development Metrics (开发指标)

> 开发过程关键指标收集与分析

## 概述

收集开发过程中的关键指标，包括准确率、覆盖率、迭代次数等，用于评估开发效率和质量，支持持续改进。

## 安装

```javascript
const {
  collectMetrics,
  recordIteration,
  recordTimePoint,
  calculateAccuracy,
  calculateEfficiency,
  aggregateMetrics,
  generateReport,
  generateDashboard,
  saveMetrics,
  loadMetrics,
  getTrends
} = require('mob-seed/lib/ops/metrics');
```

## API

### collectMetrics(task, result)

收集任务指标。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| task | Task | 任务对象 |
| result | TaskResult | 任务执行结果 |

**返回:**

```javascript
{
  taskId: string,
  timestamp: Date,
  accuracy: number,
  coverage: number,
  iterations: number,
  firstPass: boolean,
  timeMetrics: object
}
```

### recordIteration(taskId, iterationResult)

记录迭代信息。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 任务 ID |
| iterationResult | object | 迭代结果 |

**返回:** void

**示例:**

```javascript
recordIteration('TASK-001', {
  number: 1,
  result: 'failed',
  failureReason: '测试未通过'
});
```

### recordTimePoint(taskId, event, timestamp)

记录时间点。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 任务 ID |
| event | string | 事件名称 |
| timestamp | Date | 时间戳 |

**返回:** void

### calculateAccuracy(fspec, implementation)

计算 fspec 准确率。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fspec | object | fspec 解析结果 |
| implementation | object | 实现代码分析 |

**返回:**

```javascript
{
  overall: number,        // 总准确率 (0-100)
  breakdown: {
    reqCoverage: number,  // 需求覆盖 (40%)
    acSatisfied: number,  // AC 满足 (30%)
    scenarioMatch: number,// 场景匹配 (20%)
    interfaceMatch: number // 接口一致 (10%)
  }
}
```

### calculateEfficiency(estimated, actual)

计算工作流效率。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| estimated | number | 预估时间（分钟） |
| actual | number | 实际时间（分钟） |

**返回:** `number` - 效率比值 (预估/实际)

### aggregateMetrics(period)

聚合指标数据。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | 聚合周期 ('daily' | 'weekly' | 'monthly') |

**返回:**

```javascript
{
  period: string,
  taskCount: number,
  avgAccuracy: number,
  avgCoverage: number,
  avgIterations: number,
  firstPassRate: number
}
```

### generateReport(timeRange, options)

生成指标报告。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| timeRange | object | { start: Date, end: Date } |
| options | object | 报告选项 |

**返回:** `string` - Markdown 格式报告

### generateDashboard()

生成仪表盘数据。

**参数:** 无

**返回:**

```javascript
{
  summary: object,
  trends: object,
  alerts: array
}
```

### saveMetrics(metrics)

持久化指标数据。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| metrics | Metrics | 指标数据 |

**返回:** void

### loadMetrics(taskId?)

加载指标数据。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 可选，任务 ID |

**返回:** `Metrics[]` - 指标列表

### getTrends(metric, period)

获取趋势数据。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| metric | string | 指标名称 |
| period | string | 时间周期 |

**返回:**

```javascript
{
  metric: string,
  period: string,
  data: [
    { date: string, value: number }
  ]
}
```

## 核心指标

| 指标 | 计算方式 | 目标值 |
|------|----------|--------|
| fspec 准确率 | 实现匹配规格的比例 | >=90% |
| AC 覆盖率 | 测试覆盖 AC 的比例 | >=95% |
| 首次通过率 | 无需返工的任务比例 | >=70% |
| 平均迭代次数 | 任务完成的平均迭代 | <=2次 |
| 工作流效率 | 实际/预估时间比 | <=1.2 |
| 测试覆盖率 | 代码行覆盖率 | >=80% |

## 准确率维度

| 维度 | 权重 | 计算方式 |
|------|------|----------|
| 需求覆盖 | 40% | 实现的 REQ 数 / 总 REQ 数 |
| AC 满足 | 30% | 通过的 AC 数 / 总 AC 数 |
| 场景匹配 | 20% | 测试覆盖的 Scenario 数 / 总数 |
| 接口一致 | 10% | 导出接口匹配度 |

## 存储结构

```
.seed/metrics/
├── summary.json        # 汇总数据
├── daily/              # 按日存储
│   └── 2025-01-01.jsonl
├── tasks/              # 按任务存储
│   └── {task-id}.json
└── trends/             # 趋势数据
    └── weekly.json
```

## 配置项

```json
{
  "metrics": {
    "enabled": true,
    "storageDir": ".seed/metrics/",
    "retentionDays": 90,
    "aggregationInterval": "daily",
    "targets": {
      "fspecAccuracy": 0.9,
      "acCoverage": 0.95,
      "firstPassRate": 0.7,
      "avgIterations": 2,
      "efficiency": 1.2
    }
  }
}
```

## 报告示例

```markdown
# 开发指标报告

> 时间范围: 2025-01-01 ~ 2025-01-07
> 任务数量: 15

## 核心指标

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| fspec 准确率 | 92% | >=90% | OK |
| AC 覆盖率 | 88% | >=95% | WARN |
| 首次通过率 | 73% | >=70% | OK |
| 平均迭代次数 | 1.8 | <=2 | OK |
```

## 相关链接

- [规格文件](../../openspec/specs/ops/metrics.fspec.md)
- [源代码](../../skills/mob-seed/lib/ops/metrics.js)
- [测试](../../skills/mob-seed/test/ops/metrics.test.js)
