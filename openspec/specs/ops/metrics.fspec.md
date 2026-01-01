# Feature: Development Metrics (开发指标)

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ops/
> 优先级: P2
> 预计工作量: 2-3天

## 概述

收集开发过程中的关键指标，包括准确率、覆盖率、迭代次数等，用于评估开发效率和质量，支持持续改进。

## ADDED Requirements

### REQ-001: 指标定义

The system SHALL define and collect key development metrics.

**核心指标:**

| 指标 | 计算方式 | 目标值 |
|------|----------|--------|
| fspec 准确率 | 实现匹配规格的比例 | ≥90% |
| AC 覆盖率 | 测试覆盖 AC 的比例 | ≥95% |
| 首次通过率 | 无需返工的任务比例 | ≥70% |
| 平均迭代次数 | 任务完成的平均迭代 | ≤2次 |
| 工作流效率 | 实际/预估时间比 | ≤1.2 |
| 测试覆盖率 | 代码行覆盖率 | ≥80% |

**Scenario: 收集指标数据**
- WHEN 完成一个开发任务
- THEN 自动收集上述指标
- AND 存储到指标数据库

**Acceptance Criteria:**
- [x] AC-001: 定义至少 6 个核心指标
- [x] AC-002: 自动化数据收集
- [x] AC-003: 指标可配置

### REQ-002: fspec 准确率计算

The system SHALL calculate fspec accuracy.

**准确率维度:**

| 维度 | 权重 | 计算方式 |
|------|------|----------|
| 需求覆盖 | 40% | 实现的 REQ 数 / 总 REQ 数 |
| AC 满足 | 30% | 通过的 AC 数 / 总 AC 数 |
| 场景匹配 | 20% | 测试覆盖的 Scenario 数 / 总数 |
| 接口一致 | 10% | 导出接口匹配度 |

**Scenario: 计算准确率**
- WHEN 实现阶段完成
- THEN 对比代码与 fspec
- AND 计算各维度得分
- AND 输出加权总分

**Acceptance Criteria:**
- [x] AC-004: 多维度准确率计算
- [x] AC-005: 自动对比代码与规格
- [x] AC-006: 生成准确率报告

### REQ-003: 迭代追踪

The system SHALL track development iterations.

**迭代定义:**
- 一次迭代 = 从实现到验证的完整循环
- 返工 = 验证失败导致的重新实现

**Scenario: 记录迭代**
- WHEN 进入实现阶段
- THEN 标记迭代开始
- WHEN 验证通过或失败
- THEN 标记迭代结束
- AND 记录迭代结果

**迭代记录格式:**

```json
{
  "task_id": "TASK-001",
  "iterations": [
    {
      "number": 1,
      "start": "2025-01-01T10:00:00+08:00",
      "end": "2025-01-01T11:30:00+08:00",
      "result": "failed",
      "failure_reason": "测试未通过"
    },
    {
      "number": 2,
      "start": "2025-01-01T11:35:00+08:00",
      "end": "2025-01-01T12:00:00+08:00",
      "result": "passed"
    }
  ],
  "total_iterations": 2,
  "first_pass": false
}
```

**Acceptance Criteria:**
- [x] AC-007: 自动追踪迭代次数
- [x] AC-008: 记录失败原因
- [x] AC-009: 统计首次通过率

### REQ-004: 时间指标

The system SHALL collect time-related metrics.

**时间指标:**

| 指标 | 说明 |
|------|------|
| 预估时间 | Flow Router 预估的时间 |
| 实际时间 | 任务开始到完成的时间 |
| 各阶段耗时 | 每个工作流阶段的时间 |
| 等待时间 | 人工介入/确认的等待时间 |
| 有效时间 | 实际工作时间（排除等待） |

**Scenario: 收集时间指标**
- WHEN 任务状态变更
- THEN 记录时间戳
- AND 计算时间差

**Acceptance Criteria:**
- [x] AC-010: 记录关键时间点
- [x] AC-011: 计算各类时间指标
- [x] AC-012: 区分工作时间和等待时间

### REQ-005: 指标可视化

The system SHALL provide metrics visualization.

**可视化形式:**

| 形式 | 内容 | 适用场景 |
|------|------|----------|
| 仪表盘 | 核心指标概览 | 日常查看 |
| 趋势图 | 指标随时间变化 | 趋势分析 |
| 对比图 | 不同任务/项目对比 | 性能对比 |
| 报告 | 详细统计报告 | 周期汇报 |

**Scenario: 生成指标报告**
- WHEN 请求指标报告
- THEN 生成 Markdown 格式报告
- AND 包含图表（ASCII 或引用）

**报告示例:**

```markdown
# 开发指标报告

> 时间范围: 2025-01-01 ~ 2025-01-07
> 任务数量: 15

## 核心指标

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| fspec 准确率 | 92% | ≥90% | ✅ |
| AC 覆盖率 | 88% | ≥95% | ⚠️ |
| 首次通过率 | 73% | ≥70% | ✅ |
| 平均迭代次数 | 1.8 | ≤2 | ✅ |

## 工作流效率

| 流程类型 | 预估时间 | 实际时间 | 效率 |
|----------|----------|----------|------|
| Quick | 30min | 25min | 120% |
| Standard | 3h | 3.5h | 86% |
| Full | 2d | 2.5d | 80% |

## 趋势分析

准确率趋势 (最近7天):
90% ─────────────────────────────────
    │    ╭────╮      ╭─
    │   ╱      ╲    ╱
85% │──╱        ╲──╱
    │
    └─────────────────────────────────
      D1  D2  D3  D4  D5  D6  D7
```

**Acceptance Criteria:**
- [x] AC-013: 生成 Markdown 报告
- [x] AC-014: 包含趋势分析
- [x] AC-015: 支持自定义时间范围

### REQ-006: 指标存储

The system SHALL store metrics data persistently.

**存储结构:**

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

**Scenario: 持久化指标数据**
- WHEN 收集到新的指标数据
- THEN 追加到对应的存储文件
- AND 定期聚合生成汇总

**Acceptance Criteria:**
- [x] AC-016: 分层存储结构
- [x] AC-017: 支持增量追加
- [x] AC-018: 定期数据聚合

## 导出接口

```javascript
module.exports = {
  // 指标收集
  collectMetrics,           // (task, result) => Metrics
  recordIteration,          // (taskId, iterationResult) => void
  recordTimePoint,          // (taskId, event, timestamp) => void

  // 计算
  calculateAccuracy,        // (fspec, implementation) => AccuracyResult
  calculateEfficiency,      // (estimated, actual) => number
  aggregateMetrics,         // (period) => AggregatedMetrics

  // 报告
  generateReport,           // (timeRange, options) => string
  generateDashboard,        // () => DashboardData

  // 存储
  saveMetrics,              // (metrics) => void
  loadMetrics,              // (taskId?) => Metrics[]
  getTrends,                // (metric, period) => TrendData
};
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

## 依赖

- `workflow/flow-router.js` - 工作流数据
- `core/task-sync.js` - 任务数据

## 测试要点

1. 指标计算准确性
2. 数据存储完整性
3. 报告生成正确性
4. 趋势计算逻辑
5. 性能影响评估
