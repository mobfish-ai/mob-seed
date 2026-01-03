# Feature: 反思数据结构

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/

## 概述 (Overview)

定义反思（Reflection）的核心数据结构和状态机。反思是对多个观察进行模式分析后产生的高层次教训。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 反思关联多个观察，用于提取共性教训
- 反思状态包含 draft、accepted、rejected
- 反思存储在用户项目的 `.seed/reflections/` 目录

---

## ADDED Requirements

### REQ-001: 反思类型定义

The system SHALL define a Reflection type with all required fields.

**Reflection 结构**:

```javascript
/**
 * 反思记录
 * @typedef {Object} Reflection
 * @property {string} id - 反思ID (ref-YYYYMMDD-hash)
 * @property {string} created - 创建时间 (ISO 8601)
 * @property {string} updated - 更新时间 (ISO 8601)
 * @property {string[]} observations - 关联的观察ID列表
 * @property {string} status - 状态 (draft|accepted|rejected)
 * @property {string} pattern - 识别到的模式类型
 * @property {string} lesson - 教训描述
 * @property {string} [analysis] - 分析说明（可选）
 * @property {string[]} [suggestedActions] - 建议行动（可选）
 * @property {string} [proposalId] - 关联提案ID（当 accepted 时）
 */
```

**模式类型**:

| 模式类型 | 说明 | 触发条件 |
|----------|------|----------|
| `type_aggregation` | 同类型观察聚合 | 相同 type ≥ 3 条 |
| `spec_aggregation` | 同规格观察聚合 | 同一 spec ≥ 2 条 |
| `time_clustering` | 时间窗口聚合 | 24h 内同模块 ≥ 2 条 |
| `keyword_similarity` | 关键词相似 | 错误信息相似度 > 70% |
| `manual` | 手动创建 | 用户主动 reflect |

**Acceptance Criteria:**
- [ ] AC-001: Reflection 类型定义包含所有必需字段
- [ ] AC-002: 支持 5 种模式类型
- [ ] AC-003: observations 字段为观察 ID 数组
- [ ] AC-004: 至少关联 2 个观察

---

### REQ-002: 反思状态机

The system SHALL implement a state machine for Reflection status.

**状态流转**:

```
         ┌───────────────────────────────────────┐
         │                                       ▼
       draft ────accept────→ accepted ─────────────────┐
         │                       │                     │
         └────reject────→ rejected                     │
                             │                         │
                             └──── 终态，不可变更 ◀─────┘
```

**转换规则**:

| 当前状态 | 操作 | 目标状态 | 条件 |
|---------|------|---------|------|
| draft | accept | accepted | 用户确认有价值 |
| draft | reject | rejected | 用户判断无价值 |
| accepted | - | - | 终态，可创建提案 |
| rejected | - | - | 终态 |

**Acceptance Criteria:**
- [ ] AC-005: 实现 draft → accepted 转换
- [ ] AC-006: 实现 draft → rejected 转换
- [ ] AC-007: accepted 为终态，不可变更
- [ ] AC-008: rejected 为终态，不可变更

---

### REQ-003: 反思 ID 生成

The system SHALL generate unique Reflection IDs.

**ID 格式**: `ref-YYYYMMDD-{hash}`

- YYYYMMDD: 创建日期
- hash: 4 位内容哈希

**示例**: `ref-20260101-a1b2`

**Acceptance Criteria:**
- [ ] AC-009: 实现 generateReflectionId() 函数
- [ ] AC-010: ID 格式符合规范 (ref-YYYYMMDD-hash)
- [ ] AC-011: 同一天内 ID 唯一

---

### REQ-004: 反思文件存储

The system SHALL store Reflections as YAML frontmatter + Markdown files.

**存储格式**:

```yaml
# .seed/reflections/ref-001.md
---
id: ref-001
created: 2026-01-01T21:00:00Z
updated: 2026-01-01T21:00:00Z
observations: [obs-001, obs-002, obs-003]
status: draft
pattern: type_aggregation
---

## 教训

项目缺乏统一的空值处理策略

## 分析

- 3 个独立观察都涉及空值处理
- 分布在不同模块（parser, loader, validator）
- 说明这是系统性问题，非单点问题

## 建议行动

1. 在 mission.md 添加空值处理原则
2. 创建 utils/null-safe.js 工具函数
3. 更新相关规格，统一空值处理 AC

## 来源追溯

| 观察 | 类型 | 描述 |
|------|------|------|
| obs-001 | test_failure | parser 空值失败 |
| obs-002 | test_failure | loader 空值失败 |
| obs-003 | user_feedback | validator 边界条件 |
```

**Acceptance Criteria:**
- [ ] AC-012: 实现反思 Markdown 文件存储
- [ ] AC-013: 文件路径符合 .seed/reflections/{id}.md
- [ ] AC-014: YAML frontmatter 格式正确
- [ ] AC-015: Markdown 内容包含教训、分析、建议

---

### REQ-005: 反思索引管理

The system SHALL maintain an index of all Reflections.

**索引格式**:

```json
{
  "reflections": {
    "draft": ["ref-003", "ref-004"],
    "accepted": ["ref-001"],
    "rejected": ["ref-002"]
  },
  "stats": {
    "total": 4,
    "byPattern": {
      "type_aggregation": 2,
      "spec_aggregation": 1,
      "time_clustering": 1
    }
  },
  "lastUpdated": "2026-01-02T10:00:00Z"
}
```

**Acceptance Criteria:**
- [ ] AC-016: 实现索引文件 index.json
- [ ] AC-017: 索引按状态分组
- [ ] AC-018: 索引包含按模式的统计信息
- [ ] AC-019: 索引自动更新

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/reflection.js | 反思数据结构和操作 |
| 测试 | skills/mob-seed/test/ace/reflection.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md（读取观察数据）
- 被依赖: pattern-matcher.fspec.md, reflect-handler.fspec.md
