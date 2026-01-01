# Complexity Router (复杂度路由器)

> 五维度任务复杂度评估与工作流路由

## 概述

五维度任务复杂度评估系统，根据评分结果路由到不同的工作流（Quick/Standard/Full）。

**五个评估维度:**
- `impact_scope` - 影响范围 (1-3)
- `architecture_change` - 架构变更 (1-3)
- `external_deps` - 外部依赖 (1-3)
- `business_complexity` - 业务复杂度 (1-3)
- `uncertainty` - 不确定性 (1-3)

**评分区间路由:**
- 5-8 分 → Quick Flow (约 30 分钟)
- 9-12 分 → Standard Flow (约 2-4 小时)
- 13-15 分 → Full Flow (约 1-3 天)

## 安装

```javascript
const {
  evaluateComplexity,
  routeToFlow,
  analyzeWithAI,
  recordScore,
  getScoreHistory,
  parseFlowOverride,
  getDefaultScores,
  DIMENSIONS,
  THRESHOLDS
} = require('mob-seed/lib/router/complexity-router');
```

## API

### evaluateComplexity(taskDesc, context)

评估任务复杂度。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskDesc | string | 任务描述 |
| context | Object | 项目上下文 (可选) |

**返回:**

```javascript
{
  scores: {
    impact_scope: number,
    architecture_change: number,
    external_deps: number,
    business_complexity: number,
    uncertainty: number
  },
  total: number,      // 总分 5-15
  confidence: number  // 置信度 0-1
}
```

**示例:**

```javascript
const result = evaluateComplexity('添加一个简单的日志函数');
// { scores: { impact_scope: 1, ... }, total: 6, confidence: 0.7 }

const result2 = evaluateComplexity('重构整个认证系统架构');
// { scores: { impact_scope: 3, ... }, total: 13, confidence: 0.8 }
```

### routeToFlow(totalScore)

根据总分路由到工作流。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| totalScore | number | 总分 (5-15) |

**返回:**

```javascript
{
  flow: string,          // 'quick' | 'standard' | 'full'
  estimatedTime: string  // 预估时间
}
```

**示例:**

```javascript
routeToFlow(6);   // { flow: 'quick', estimatedTime: '30min' }
routeToFlow(10);  // { flow: 'standard', estimatedTime: '2-4h' }
routeToFlow(14);  // { flow: 'full', estimatedTime: '1-3d' }
```

### analyzeWithAI(taskDesc, projectContext)

使用 AI 分析任务复杂度。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskDesc | string | 任务描述 |
| projectContext | Object | 项目上下文 (可选) |

**返回:** `Promise<{ scores: Object, reasoning: string }>`

**示例:**

```javascript
const analysis = await analyzeWithAI('实现用户登录功能');
// { scores: {...}, reasoning: '基于关键词分析，总分 8，置信度 60%' }
```

### recordScore(scoreResult)

记录评分历史到 `.seed/router-history.jsonl`。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| scoreResult | Object | 评分结果对象 |

**示例:**

```javascript
recordScore({
  taskDesc: '添加日志',
  scores: { impact_scope: 1, ... },
  total: 6,
  flow: 'quick'
});
```

### getScoreHistory(filter)

获取评分历史。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filter | Object | 过滤条件 (可选) |
| filter.flow | string | 按工作流过滤 |

**返回:** `Array` - 评分记录列表

**示例:**

```javascript
const allHistory = getScoreHistory();
const quickOnly = getScoreHistory({ flow: 'quick' });
```

### parseFlowOverride(args)

解析工作流覆盖参数。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| args | Array | 命令行参数 |

**返回:** `string | null` - 指定的工作流或 null

**示例:**

```javascript
parseFlowOverride(['--flow=quick']);  // 'quick'
parseFlowOverride(['--verbose']);     // null
```

### getDefaultScores()

获取默认评分（所有维度为 2）。

**返回:** `Object` - 默认评分对象

**示例:**

```javascript
const defaults = getDefaultScores();
// { impact_scope: 2, architecture_change: 2, ... }
```

## 常量

### DIMENSIONS

维度定义对象。

```javascript
{
  impact_scope: { min: 1, max: 3, name: '影响范围' },
  architecture_change: { min: 1, max: 3, name: '架构变更' },
  external_deps: { min: 1, max: 3, name: '外部依赖' },
  business_complexity: { min: 1, max: 3, name: '业务复杂度' },
  uncertainty: { min: 1, max: 3, name: '不确定性' }
}
```

### THRESHOLDS

路由阈值配置。

```javascript
{
  quick: 8,    // 5-8 → Quick Flow
  standard: 12 // 9-12 → Standard, 13-15 → Full
}
```

## 相关模块

- [flow-router](./flow-router.md) - 工作流路由器
- [task-sync](./task-sync.md) - 任务同步
