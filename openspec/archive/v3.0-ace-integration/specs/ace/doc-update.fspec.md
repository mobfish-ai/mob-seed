---
status: archived
archived: 2026-01-02
version: 1.0.0
tech_stack: Markdown
derived_path: docs/, CLAUDE.md
---
# Feature: ACE 文档更新
## 概述 (Overview)

更新项目文档以反映 ACE 集成后的新功能和工作流程。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 贡献者

### 业务约束

- 文档必须与代码实现同步
- 中英文文档同步更新
- 遵循 SEED 派生链: Code → Docs

---

## ADDED Requirements

### REQ-001: CLAUDE.md 更新

The system SHALL update CLAUDE.md to include ACE-related guidance.

**新增章节**:

```markdown
## ACE 闭环 (Observe → Reflect → Curate)

### 观察收集

- 自动观察: Execute/Defend 自动记录失败和偏离
- 手动观察: `/mob-seed:spec observe "描述"`

### 反思分析

- 触发: `/mob-seed:spec reflect`
- 自动模式识别：类型聚合、规格聚合、时间窗口

### 整合提案

- 升级: `/mob-seed:spec promote <id>`
- 创建正式变更提案

### 目录结构

```
.seed/
├── observations/     # 观察记录
│   ├── index.json   # 索引
│   └── obs-xxx.md   # 单个观察
└── reflections/      # 反思记录
    ├── index.json   # 索引
    └── ref-xxx.md   # 单个反思
```
```

**Acceptance Criteria:**
- [ ] AC-001: 新增 ACE 闭环章节
- [ ] AC-002: 说明观察收集方式（自动/手动）
- [ ] AC-003: 说明反思触发和模式识别
- [ ] AC-004: 说明整合提案流程
- [ ] AC-005: 更新目录结构说明

---

### REQ-002: README 更新

The system SHALL update README.md and README.zh-CN.md with ACE features.

**新增内容**:

| 章节 | 内容 |
|------|------|
| Features | 新增 "ACE 自演化能力" |
| Quick Start | 新增 ACE 命令示例 |
| Architecture | 新增 ACE 闭环图 |

**中英文同步要求**:
- README.md (英文)
- README.zh-CN.md (中文)
- 两份文档结构和内容完全对应

**Acceptance Criteria:**
- [ ] AC-006: README.md 新增 ACE 功能描述
- [ ] AC-007: README.zh-CN.md 同步更新
- [ ] AC-008: Quick Start 包含 ACE 命令示例
- [ ] AC-009: 架构图包含 ACE 闭环

---

### REQ-003: 命令参考更新

The system SHALL update command reference documentation.

**新增命令说明**:

| 命令 | 说明 |
|------|------|
| `/mob-seed:spec observe` | 手动添加观察 |
| `/mob-seed:spec triage` | 归类观察 |
| `/mob-seed:spec reflect` | 触发反思分析 |
| `/mob-seed:spec promote` | 升级为提案 |

**增强说明**:

| 命令 | 增强内容 |
|------|---------|
| `/mob-seed` | 状态面板显示观察统计 |
| `/mob-seed:exec` | 自动记录失败观察 |
| `/mob-seed:defend` | 自动记录偏离观察 |

**Acceptance Criteria:**
- [ ] AC-010: 文档化所有新增子操作
- [ ] AC-011: 说明命令选项和参数
- [ ] AC-012: 提供使用示例
- [ ] AC-013: 说明命令增强内容

---

### REQ-004: 配置说明

The system SHALL document ACE configuration options.

**配置文档内容**:

```markdown
## ACE 配置

在 `.seed/config.json` 中配置 ACE 行为：

```json
{
  "ace": {
    "enabled": true,
    "sources": {
      "core": ["test_failure", "spec_drift", "coverage_gap", "user_feedback"],
      "extensions": []
    },
    "reflect": {
      "auto_trigger": true,
      "thresholds": {
        "same_type": 3,
        "same_spec": 2,
        "time_window_hours": 24
      }
    }
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| ace.enabled | boolean | true | 是否启用 ACE |
| ace.sources.core | array | [...] | 核心信号来源 |
| ace.reflect.auto_trigger | boolean | true | 自动触发反思 |
| ace.reflect.thresholds.same_type | number | 3 | 同类型观察阈值 |
```

**Acceptance Criteria:**
- [ ] AC-014: 文档化完整配置结构
- [ ] AC-015: 说明每个配置项的作用
- [ ] AC-016: 提供配置示例
- [ ] AC-017: 说明默认值

---

### REQ-005: 概念说明文档

The system SHALL create conceptual documentation for ACE.

**文档路径**: `docs/concepts/ace-overview.md`

**内容结构**:

```markdown
# ACE: 规格自演化能力

## 什么是 ACE？

ACE (Agentic Context Engineering) 是一种让系统能够从执行反馈中学习并演化自身规格的方法论。

## 核心概念

### 观察 (Observation)
从执行结果中提取的轻量级信号...

### 反思 (Reflection)
对多个观察进行模式分析...

### 整合 (Curation)
将观察/教训转化为规格修订...

## 与 SEED 的关系

```
Spec → Emit → Execute → Defend
  ▲                │        │
  │                ▼        ▼
  │         Observe → Reflect → Curate
  └──────────────────────────────────┘
```

## 使用场景

1. 测试失败模式识别
2. 规格偏离追踪
3. 用户反馈积累
```

**Acceptance Criteria:**
- [ ] AC-018: 创建 ACE 概念说明文档
- [ ] AC-019: 解释核心概念（观察、反思、整合）
- [ ] AC-020: 说明与 SEED 的关系
- [ ] AC-021: 提供使用场景示例

---

### REQ-006: CHANGELOG 更新

The system SHALL update CHANGELOG.md for v3.0 release.

**CHANGELOG 条目**:

```markdown
## [3.0.0] - YYYY-MM-DD

### Added
- ACE (Agentic Context Engineering) 集成
  - 观察收集: Execute/Defend 自动记录 + 手动添加
  - 反思分析: 规则匹配式模式识别
  - 整合闭环: 观察/反思 → 提案
- 新增命令: `/mob-seed:spec observe|triage|reflect|promote`
- 新增目录: `.seed/observations/`, `.seed/reflections/`
- 状态面板增强: 显示观察统计

### Changed
- 命令系统: 统一为子命令模式 (`/mob-seed:*`)
```

**Acceptance Criteria:**
- [ ] AC-022: 列出所有新增功能
- [ ] AC-023: 列出所有变更
- [ ] AC-024: 遵循 Keep a Changelog 格式
- [ ] AC-025: 基于 git log 生成，不遗漏

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 文档 | CLAUDE.md | 开发指南更新 |
| 文档 | README.md | 英文说明更新 |
| 文档 | README.zh-CN.md | 中文说明更新 |
| 文档 | docs/concepts/ace-overview.md | ACE 概念说明 |
| 文档 | CHANGELOG.md | 版本变更记录 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: 所有 Phase 1-3 规格实现完成
- 被依赖: 无

---

## 实施说明

文档更新应在所有功能代码实现并测试通过后进行，确保：
1. 文档内容与实际实现一致
2. 代码中的注释和 JSDoc 作为 API 文档来源
3. 概念说明基于已验证的设计
