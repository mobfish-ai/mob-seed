# Feature: 任务自动生成

> 状态: archived
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/spec/
> 测试通过: 32/32 ✅

## 概述 (Overview)

实现从 Proposal 自动派生 tasks.md 的功能。当 Proposal 进入 `archived` 状态时，自动从 Proposal 内容中提取任务列表并生成 tasks.md 文件。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 不增加新命令，作为 `/mob-seed:spec` 状态转换的副作用
- tasks.md 是派生产物，不应手动编辑
- 任务从 Proposal 的阶段描述、实现步骤中提取

---

## ADDED Requirements

### REQ-001: Proposal 状态转换触发任务生成

The system SHALL automatically generate tasks.md when proposal enters archived status.

**Scenario: 提案进入实现阶段**
- GIVEN 一个 review 状态的 Proposal
- WHEN 用户确认开始实现（状态变为 archived）
- THEN 自动生成 tasks.md

**触发点**:

```javascript
// 在 spec 命令的状态转换逻辑中
async function transitionProposal(proposalName, newStatus) {
  // ... 状态验证

  if (newStatus === 'archived') {
    // 自动派生 tasks.md
    await generateTasksFromProposal(proposalName);
  }

  // ... 更新状态
}
```

**Acceptance Criteria:**
- [x] AC-001: review → archived 触发任务生成
- [x] AC-002: 生成的 tasks.md 在 proposal 目录下
- [x] AC-003: 重复进入 archived 时覆盖更新

---

### REQ-002: Proposal 内容解析

The system SHALL parse proposal content to extract task information.

**Scenario: 从阶段描述提取任务**
- GIVEN Proposal 包含 `## 实现阶段` 章节
- WHEN 解析 Proposal
- THEN 提取每个阶段作为任务组

**解析规则**:

| Proposal 结构 | 解析为 |
|--------------|--------|
| `## 阶段 N: xxx` | 任务组 (milestone) |
| `### 任务 N.M: xxx` | 具体任务 |
| `- [ ] xxx` | 子任务 (checklist) |
| fspec 文件列表 | 关联规格 |

**示例解析**:

```markdown
# Proposal 内容
## Phase 1: ACE 基础架构
### 任务 1.1: 观察数据结构
- 创建 observation.fspec.md
- 定义数据类型

### 任务 1.2: 观察收集器
- 创建 observation-collector.fspec.md
```

↓ 解析为 ↓

```yaml
# tasks.md
milestones:
  - id: phase-1
    name: ACE 基础架构
    tasks:
      - id: task-1.1
        name: 观察数据结构
        specs: [observation.fspec.md]
        subtasks:
          - 创建 observation.fspec.md
          - 定义数据类型
      - id: task-1.2
        name: 观察收集器
        specs: [observation-collector.fspec.md]
```

**Acceptance Criteria:**
- [x] AC-004: 解析 Proposal 的阶段结构
- [x] AC-005: 提取任务和子任务
- [x] AC-006: 关联 fspec 文件
- [x] AC-007: 支持中英文标题格式

---

### REQ-003: tasks.md 文件格式

The system SHALL generate tasks.md in a structured format.

**Scenario: 生成标准格式**
- WHEN 生成 tasks.md
- THEN 使用 YAML frontmatter + Markdown 格式

**文件格式**:

```markdown
---
proposal: v3.0-ace-integration
generated: 2026-01-01T20:00:00Z
source: proposal.md
---

# 任务清单

> 此文件由系统自动生成，请勿手动编辑。
> 源文件: proposal.md

## Phase 1: ACE 基础架构

| 任务 | 规格 | 状态 |
|------|------|------|
| 1.1 观察数据结构 | observation.fspec.md | ⏳ pending |
| 1.2 观察收集器 | observation-collector.fspec.md | ⏳ pending |

### 任务 1.1: 观察数据结构

**关联规格**: `specs/ace/observation.fspec.md`

- [x] 创建 observation.fspec.md
- [x] 定义数据类型
- [x] 实现状态机

**派生产物**:
- `lib/ace/observation.js`
- `test/ace/observation.test.js`

---

## Phase 2: 命令集成
...
```

**Acceptance Criteria:**
- [x] AC-008: 使用 YAML frontmatter 记录元信息
- [x] AC-009: 包含"请勿手动编辑"警告
- [x] AC-010: 任务表格显示状态
- [x] AC-011: 每个任务详情包含派生产物

---

### REQ-004: 任务状态同步

The system SHALL sync task status with fspec status.

**Scenario: fspec 状态变更时更新任务状态**
- GIVEN tasks.md 中任务关联 observation.fspec.md
- WHEN observation.fspec.md 状态变为 archived
- THEN tasks.md 中对应任务状态更新

**状态映射**:

| fspec 状态 | 任务状态 |
|-----------|---------|
| draft | ⏳ pending |
| review | 🔍 reviewing |
| archived | 🔨 in_progress |
| archived | ✅ completed |

**Acceptance Criteria:**
- [x] AC-012: fspec 状态变更触发 tasks.md 更新
- [x] AC-013: 任务状态与 fspec 状态同步
- [x] AC-014: 更新时保留手动无法编辑的警告

---

### REQ-005: 任务进度统计

The system SHALL provide task progress statistics.

**Scenario: 在状态面板显示任务进度**
- GIVEN 存在 tasks.md
- WHEN 运行 `/mob-seed:status`
- THEN 显示任务完成进度

**显示格式**:

```
📋 任务进度
  Phase 1: █████░░░░░ 50% (3/6)
  Phase 2: ░░░░░░░░░░ 0% (0/4)
  总进度:  ███░░░░░░░ 30% (3/10)
```

**Acceptance Criteria:**
- [x] AC-015: 计算各阶段完成百分比
- [x] AC-016: 显示进度条可视化
- [x] AC-017: 在状态面板集成显示

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/spec/task-generator.js ✅ | 任务生成器 |
| 代码 | skills/mob-seed/lib/spec/proposal-parser.js ✅ | Proposal 解析 |
| 测试 | skills/mob-seed/test/spec/task-generator.test.js ✅ (32/32 pass) | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: 无（独立功能）
- 被依赖: spec-command（集成）, status-panel-enhance（显示进度）
