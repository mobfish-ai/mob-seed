# v2.0-seed-complete: SEED 方法论完整实现

> 状态: archived
> 版本: 2.0.0
> 创建日期: 2025-01-01
> 归档日期: 2026-01-01

## 概述

基于设计文档 `2025-12-27-unified-dev-workflow-design.md` 的完整 gap 分析，实现 SEED 方法论的所有缺失特性。

## 变更范围

### P0 - 核心缺失（必须实现）

| 特性 | 规格文件 | 预计工作量 |
|------|----------|-----------|
| Complexity Router | `core/complexity-router.fspec.md` | 2-3天 |
| Flow Router (Quick/Standard/Full) | `workflow/flow-router.fspec.md` | 3-5天 |
| tasks.md ↔ TodoWrite 同步 | `core/task-sync.fspec.md` | 2-3天 |

### P1 - 重要增强（应该实现）

| 特性 | 规格文件 | 预计工作量 |
|------|----------|-----------|
| Scenario → Test 映射 | `automation/scenario-test-mapper.fspec.md` | 2-3天 |
| Phase Gate 验证 | `quality/phase-gate.fspec.md` | 1-2天 |
| Debug Protocol | `quality/debug-protocol.fspec.md` | 2天 |
| fspec Linter | `quality/fspec-linter.fspec.md` | 1天 |

### P2 - 优化完善（可以实现）

| 特性 | 规格文件 | 预计工作量 |
|------|----------|-----------|
| Pre-Implementation Confirmation | `workflow/pre-impl-confirmation.fspec.md` | 1天 |
| Metrics/埋点 | `ops/metrics.fspec.md` | 1天 |
| 需求变更处理 | `ops/change-handler.fspec.md` | 1-2天 |
| 取消处理 | `ops/cancellation.fspec.md` | 0.5天 |

## 依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                      依赖关系图                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  P0 Core (必须先完成)                                        │
│  ┌─────────────────┐                                        │
│  │ Complexity      │──────┐                                 │
│  │ Router          │      │                                 │
│  └─────────────────┘      ▼                                 │
│                     ┌─────────────────┐                     │
│                     │ Flow Router     │                     │
│                     │ (Quick/Std/Full)│                     │
│                     └────────┬────────┘                     │
│                              │                               │
│  ┌─────────────────┐         │                               │
│  │ Task Sync       │◄────────┘                               │
│  │ (TodoWrite)     │                                         │
│  └────────┬────────┘                                         │
│           │                                                  │
├───────────┼──────────────────────────────────────────────────┤
│           │  P1 Quality (依赖 P0)                            │
│           ▼                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Phase Gate      │  │ Debug Protocol  │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ fspec Linter    │  │ Scenario→Test   │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│           P2 Ops (可并行)                                    │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Pre-Impl Conf   │  │ Metrics         │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Change Handler  │  │ Cancellation    │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 实施策略

1. **阶段 1** (Week 1-2): P0 核心特性
   - 先实现 Complexity Router（其他都依赖它）
   - 再实现 Flow Router（使用 Complexity Router 的评分）
   - 最后实现 Task Sync（在 Flow 中使用）

2. **阶段 2** (Week 3): P1 质量特性
   - Phase Gate 和 Debug Protocol 可并行
   - fspec Linter 独立实现
   - Scenario→Test 依赖 fspec 解析增强

3. **阶段 3** (Week 4): P2 运维特性
   - 所有 P2 特性可并行实现
   - 优先级可根据实际需求调整

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Complexity Router 评分不准 | 中 | 高 | 预留调参时间，收集反馈 |
| TodoWrite 同步冲突 | 低 | 高 | 设计冲突解决策略 |
| Scenario 语法复杂 | 中 | 中 | 先支持简单语法，渐进增强 |

## 验收标准

- [x] 所有 P0 特性已实现并测试通过 (3/3)
- [x] 所有 P1 特性已实现并测试通过 (4/4)
- [x] P2 特性全部完成 (4/4) - 超额完成
- [x] 文档已更新（README, SKILL.md, CLAUDE.md）
- [x] 407 个测试全部通过
