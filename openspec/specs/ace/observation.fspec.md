# Feature: 观察数据结构

> 状态: draft
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/

## 概述 (Overview)

定义 ACE 观察（Observation）的数据结构、状态机和存储格式。观察是从 Execute/Defend 结果或用户反馈中提取的轻量级信号，是规格演化的输入线索。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 观察数据存储在用户项目的 `.seed/observations/` 目录
- 观察格式使用 YAML frontmatter + Markdown
- 每个观察有唯一 ID（格式：obs-{timestamp}-{random}）
- 观察状态机：raw → triaged → promoted | ignored

---

## ADDED Requirements

### REQ-001: 观察数据结构定义

The system SHALL define the observation data structure with required and optional fields.

**Scenario: 创建观察对象**
- WHEN 系统收集到一个信号（测试失败、规格偏离等）
- THEN 创建一个符合结构定义的观察对象

**数据结构**:

```javascript
/**
 * 观察数据结构
 * @typedef {Object} Observation
 * @property {string} id - 唯一标识 (obs-{timestamp}-{random})
 * @property {ObservationType} type - 观察类型
 * @property {string} source - 来源 (auto:execute | auto:defend | manual)
 * @property {string} created - ISO 8601 时间戳
 * @property {ObservationStatus} status - 状态
 * @property {string} [spec] - 关联规格路径
 * @property {string} [priority] - 优先级 (P0-P4)
 * @property {string} [proposal_id] - 关联提案 ID（promoted 后）
 * @property {string} description - 描述
 * @property {Object} context - 上下文信息
 * @property {string} [suggestion] - 建议
 * @property {Object} [decision] - 决策信息
 */

/**
 * 观察类型
 * @typedef {'test_failure' | 'coverage_gap' | 'spec_drift' | 'user_feedback' | 'pattern_insight'} ObservationType
 */

/**
 * 观察状态
 * @typedef {'raw' | 'triaged' | 'promoted' | 'ignored'} ObservationStatus
 */
```

**Acceptance Criteria:**
- [x] AC-001: 定义 Observation 类型
- [x] AC-002: 定义 ObservationType 枚举
- [x] AC-003: 定义 ObservationStatus 枚举
- [x] AC-004: 导出类型定义

---

### REQ-002: 观察状态机

The system SHALL enforce observation state transitions according to the defined state machine.

**Scenario: 状态转换验证**
- GIVEN 一个状态为 `raw` 的观察
- WHEN 尝试转换到 `triaged`
- THEN 转换成功

**Scenario: 无效状态转换**
- GIVEN 一个状态为 `promoted` 的观察
- WHEN 尝试转换到 `raw`
- THEN 转换失败，抛出错误

**状态机定义**:

```
           ┌───────────────────────────────────────┐
           │                                       ▼
         raw ────triage────→ triaged ────promote────→ promoted
           │                    │                        │
           │                    └────ignore────→ ignored │
           │                                             │
           └──────────── 只读，不可逆转 ◀───────────────┘
```

| 当前状态 | 允许转换到 | 触发操作 |
|---------|-----------|---------|
| raw | triaged, ignored | triage, ignore |
| triaged | promoted, ignored | promote, ignore |
| promoted | - | 终态，只读 |
| ignored | - | 终态，只读 |

**Acceptance Criteria:**
- [x] AC-005: 实现 canTransition(from, to) 函数
- [x] AC-006: 实现 transition(obs, newStatus) 函数
- [x] AC-007: 终态（promoted, ignored）不可转换
- [x] AC-008: 转换时更新 updated 时间戳

---

### REQ-003: 观察存储格式

The system SHALL store observations as Markdown files with YAML frontmatter.

**Scenario: 保存观察到文件**
- WHEN 创建一个新观察
- THEN 生成 `.seed/observations/{id}.md` 文件

**文件格式**:

```yaml
# .seed/observations/obs-20260101-abc123.md
---
id: obs-20260101-abc123
type: test_failure
source: auto:execute
created: 2026-01-01T20:00:00Z
updated: 2026-01-01T20:00:00Z
status: raw
spec: openspec/specs/parser.fspec.md
---

## 描述

测试 `should handle empty input` 失败

## 上下文

- 错误: TypeError: Cannot read property 'length' of undefined
- 文件: skills/mob-seed/test/parser.test.js:45
- 执行批次: run-12345

## 建议

添加 AC: 输入为空时返回空数组

## 决策

<!-- triage 时填写 -->
- 决策: pending
- 优先级:
- 理由:
- 关联提案:
```

**Acceptance Criteria:**
- [x] AC-009: 实现 saveObservation(obs) 函数
- [x] AC-010: 实现 loadObservation(id) 函数
- [x] AC-011: 文件名格式为 {id}.md
- [x] AC-012: YAML frontmatter 包含所有必需字段

---

### REQ-004: 观察索引管理

The system SHALL maintain an index file for efficient observation querying.

**Scenario: 查询观察列表**
- WHEN 调用 listObservations({ status: 'raw' })
- THEN 返回所有 raw 状态的观察摘要

**索引格式**:

```json
{
  "version": "1.0.0",
  "updated": "2026-01-01T21:00:00Z",
  "observations": [
    {
      "id": "obs-20260101-abc123",
      "type": "test_failure",
      "status": "raw",
      "created": "2026-01-01T20:00:00Z",
      "spec": "openspec/specs/parser.fspec.md"
    }
  ],
  "stats": {
    "total": 10,
    "raw": 5,
    "triaged": 3,
    "promoted": 1,
    "ignored": 1
  }
}
```

**Acceptance Criteria:**
- [x] AC-013: 实现 updateIndex() 函数
- [x] AC-014: 实现 listObservations(filter) 函数
- [x] AC-015: 实现 getStats() 函数
- [x] AC-016: 索引文件路径为 .seed/observations/index.json

---

### REQ-005: 观察 ID 生成

The system SHALL generate unique observation IDs.

**Scenario: 生成观察 ID**
- WHEN 创建新观察
- THEN 生成格式为 `obs-{YYYYMMDD}-{random6}` 的唯一 ID

**Acceptance Criteria:**
- [x] AC-017: 实现 generateObservationId() 函数
- [x] AC-018: ID 格式为 obs-{日期}-{6位随机字符}
- [x] AC-019: 确保 ID 唯一性（检查已存在文件）

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/observation.js | 观察数据结构与操作 |
| 测试 | skills/mob-seed/test/ace/observation.test.js | 单元测试 |
| 文档 | docs/api/observation.md | API 文档 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: 无
- 被依赖: observation-collector.fspec.md, spec-observe-command.fspec.md
