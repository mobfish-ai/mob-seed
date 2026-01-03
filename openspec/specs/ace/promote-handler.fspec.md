# Feature: Promote 命令处理器

> 状态: draft
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/

## 概述 (Overview)

实现 `/mob-seed:spec promote` 子操作，将观察或反思升级为正式变更提案。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 只能 promote triaged 观察或 accepted 反思
- 创建标准的 changes/ 提案结构
- 保留完整的来源追溯

---

## ADDED Requirements

### REQ-001: Promote 观察

The system SHALL promote a triaged observation to a proposal.

**命令格式**:

```bash
/mob-seed:spec promote obs-001
```

**执行流程**:

```
┌─────────────────────────────────────────────────────────────┐
│  Promote 观察流程                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 验证观察状态为 triaged                                    │
│  2. 显示观察内容和建议                                        │
│  3. 询问提案名称                                              │
│  4. 创建 changes/<name>/proposal.md                          │
│  5. 更新观察状态为 promoted                                   │
│  6. 设置观察的 proposal_id 字段                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [x] AC-001: 实现 promoteObservation() 函数
- [x] AC-002: 验证观察状态为 triaged
- [x] AC-003: 拒绝 promote 其他状态的观察
- [x] AC-004: 创建提案目录和 proposal.md

---

### REQ-002: Promote 反思

The system SHALL promote an accepted reflection to a proposal.

**命令格式**:

```bash
/mob-seed:spec promote ref-001
```

**执行流程**:

```
┌─────────────────────────────────────────────────────────────┐
│  Promote 反思流程                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 验证反思状态为 accepted                                   │
│  2. 显示反思内容（教训、建议行动）                              │
│  3. 询问提案名称                                              │
│  4. 创建 changes/<name>/proposal.md                          │
│  5. 将建议行动转换为提案任务                                    │
│  6. 更新反思的 proposal_id 字段                               │
│  7. 更新关联观察状态为 promoted                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [x] AC-005: 实现 promoteReflection() 函数
- [x] AC-006: 验证反思状态为 accepted
- [x] AC-007: 将反思的建议行动转换为提案任务
- [x] AC-008: 关联的观察状态也更新为 promoted

---

### REQ-003: 提案模板生成

The system SHALL generate a proposal from observation/reflection content.

**提案模板**:

```markdown
# {提案名称}

> **状态**: draft
> **版本**: 1.0.0
> **创建**: {日期}
> **来源**: {obs-id 或 ref-id}

## 概述

{从观察/反思的描述自动生成}

## 来源追溯

本提案源自以下观察/反思：

| ID | 类型 | 描述 | 创建时间 |
|----|------|------|---------|
| {id} | {type} | {description} | {created} |

## 问题分析

{从观察的上下文或反思的分析自动生成}

## 建议方案

{从观察的建议或反思的建议行动自动生成}

## 实施阶段

### Phase 1: {阶段名称}

- [x] 任务 1
- [x] 任务 2

## 影响范围

- 规格: {related_spec}
- 模块: {context.file}
```

**Acceptance Criteria:**
- [x] AC-009: 生成符合 proposal.md 格式的文件
- [x] AC-010: 自动填充概述、问题分析、建议方案
- [x] AC-011: 包含完整来源追溯表
- [x] AC-012: 将建议行动转换为实施任务

---

### REQ-004: 状态更新

The system SHALL update observation/reflection status after promotion.

**观察状态更新**:

```javascript
// 更新观察
observation.status = 'promoted';
observation.proposal_id = proposalId;
observation.promoted_at = new Date().toISOString();
```

**反思状态更新**:

```javascript
// 更新反思
reflection.proposal_id = proposalId;

// 更新关联的所有观察
for (const obsId of reflection.observations) {
  observation.status = 'promoted';
  observation.proposal_id = proposalId;
}
```

**Acceptance Criteria:**
- [x] AC-013: 更新观察的 status 为 promoted
- [x] AC-014: 设置 proposal_id 字段
- [x] AC-015: 设置 promoted_at 时间戳
- [x] AC-016: 更新索引文件

---

### REQ-005: 来源追溯链

The system SHALL maintain complete source traceability.

**追溯链结构**:

```
观察 obs-001
    ↓ promote
提案 changes/xxx/proposal.md
    ↓ 实施
规格 openspec/specs/xxx.fspec.md
```

**在提案中**:

```yaml
---
source:
  type: observation  # 或 reflection
  id: obs-001
  created: 2026-01-01T20:00:00Z
---
```

**Acceptance Criteria:**
- [x] AC-017: 提案 frontmatter 包含 source 字段
- [x] AC-018: source 记录类型、ID、创建时间
- [x] AC-019: 支持从提案反向查找来源

---

### REQ-006: 交互式确认

The system SHALL provide interactive confirmation before creating proposal.

**确认流程**:

```
📌 准备 Promote 观察 obs-001

类型: test_failure
描述: parser 空值处理失败
建议: 添加 AC: 输入为空时返回空数组

提案名称: [______________________]
默认: fix-parser-null-handling

确认创建提案? [y/n]
```

**Acceptance Criteria:**
- [x] AC-020: 显示待 promote 的内容摘要
- [x] AC-021: 允许用户自定义提案名称
- [x] AC-022: 提供默认名称建议
- [x] AC-023: 确认后才创建

---

### REQ-007: 批量 Promote

The system SHALL support promoting multiple observations at once.

**命令格式**:

```bash
/mob-seed:spec promote obs-001 obs-002 obs-003 --as single-proposal
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--as single-proposal` | 合并为单个提案 |
| `--separate` | 分别创建提案（默认） |

**Acceptance Criteria:**
- [x] AC-024: 支持多个 ID 参数
- [x] AC-025: 支持 `--as` 合并为单个提案
- [x] AC-026: 默认分别创建提案

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/promote-handler.js | Promote 命令处理器 |
| 测试 | skills/mob-seed/test/ace/promote-handler.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md, reflection.fspec.md
- 被依赖: 无（闭环终点）
