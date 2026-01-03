# Feature: triage 子操作 - 观察归类与提升

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/
> 测试通过: 26/26 ✅

## 概述 (Overview)

实现 `/mob-seed:spec triage` 子操作，允许用户对观察进行归类、优先级排序，并将有价值的观察提升为规格变更提案。

### 目标用户

- 使用 mob-seed 的开发者
- 技术负责人（决策者）

### 业务约束

- 作为 `/mob-seed:spec` 的子操作，不新增顶层命令
- 只能对 raw 或 triaged 状态的观察进行操作
- promoted/ignored 为终态，不可逆转

---

## ADDED Requirements

### REQ-001: 归类观察命令

The system SHALL provide a command to triage observations.

**Scenario: 归类单个观察**
- GIVEN 存在 raw 状态的观察
- WHEN 运行 `/mob-seed:spec triage <id>`
- THEN 进入交互式归类流程

**命令格式**:

```bash
# 交互式归类
/mob-seed:spec triage <id>

# 快速归类
/mob-seed:spec triage <id> --priority P1 --decision accept

# 批量归类
/mob-seed:spec triage --batch raw  # 归类所有 raw 观察
```

**Acceptance Criteria:**
- [x] AC-001: 实现 `/mob-seed:spec triage` 子操作
- [x] AC-002: 支持单个观察归类
- [x] AC-003: 支持快速归类模式
- [x] AC-004: 支持批量归类

---

### REQ-002: 交互式归类流程

The system SHALL guide users through triage decisions interactively.

**Scenario: 交互式归类**
- GIVEN 运行 `/mob-seed:spec triage obs-20260101-abc123`
- WHEN 进入交互模式
- THEN 显示观察内容并收集决策

**交互流程**:

```
📋 归类观察: obs-20260101-abc123

类型: test_failure
来源: auto:execute
描述: 测试 `should handle empty input` 失败
建议: 添加 AC: 输入为空时返回空数组

? 你的决策:
  ❯ accept  - 接受，将提升为规格变更
    defer   - 延后，标记优先级后暂存
    ignore  - 忽略，不需要处理

? 优先级:
  ❯ P1 - 阻塞，必须立即处理
    P2 - 高优先，本周处理
    P3 - 中优先，本月处理
    P4 - 低优先，有空再处理

? 备注 (可选):
  > 需要在 v3.0 发布前修复

✅ 观察已归类: triaged (P1)
```

**Acceptance Criteria:**
- [x] AC-005: 显示观察完整内容
- [x] AC-006: 收集决策（accept/defer/ignore）
- [x] AC-007: 收集优先级
- [x] AC-008: 收集备注（可选）

---

### REQ-003: 提升观察为提案

The system SHALL promote accepted observations to spec change proposals.

**Scenario: 提升为新提案**
- GIVEN 观察决策为 accept
- WHEN 完成归类
- THEN 创建规格变更提案草稿

**提升逻辑**:

```javascript
/**
 * 将观察提升为提案
 * @param {Observation} obs - 已归类的观察
 * @returns {Proposal} 创建的提案草稿
 */
function promoteToProposal(obs) {
  const proposalName = generateProposalName(obs);
  const proposal = {
    name: proposalName,
    status: 'draft',
    source: `obs:${obs.id}`,
    title: obs.description,
    spec: obs.spec,
    changes: generateChangesFromSuggestion(obs.suggestion)
  };

  return proposal;
}
```

**提升结果**:

```
🚀 观察已提升为提案

提案: v3.1-fix-empty-input
状态: draft
来源: obs-20260101-abc123

下一步:
  /mob-seed:spec edit v3.1-fix-empty-input  # 编辑提案
  /mob-seed:spec --submit v3.1-fix-empty-input  # 提交审核
```

**Acceptance Criteria:**
- [x] AC-009: accept 决策触发提案创建
- [x] AC-010: 提案与原观察关联（source 字段）
- [x] AC-011: 观察状态变更为 promoted
- [x] AC-012: 更新观察的 proposal_id 字段

---

### REQ-004: 忽略观察

The system SHALL allow ignoring observations that don't need action.

**Scenario: 忽略观察**
- GIVEN 观察决策为 ignore
- WHEN 完成归类
- THEN 观察状态变更为 ignored

**确认流程**:

```
⚠️ 确认忽略观察 obs-20260101-xyz789

类型: pattern_insight
描述: 函数命名风格不一致

? 确认忽略? (输入理由)
  > 这是历史代码风格，暂不统一

✅ 观察已忽略
   理由: 这是历史代码风格，暂不统一
```

**Acceptance Criteria:**
- [x] AC-013: ignore 决策需要确认
- [x] AC-014: 记录忽略理由
- [x] AC-015: 观察状态变更为 ignored
- [x] AC-016: ignored 为终态，不可恢复

---

### REQ-005: 批量归类支持

The system SHALL support batch triage for efficiency.

**Scenario: 批量归类 raw 观察**
- GIVEN 存在多个 raw 状态的观察
- WHEN 运行 `/mob-seed:spec triage --batch raw`
- THEN 依次处理每个观察

**批量模式**:

```
📋 批量归类模式 (raw: 5 条)

[1/5] obs-20260101-abc123
  类型: test_failure
  描述: 测试失败...
  ? 决策: [a]ccept / [d]efer / [i]gnore / [s]kip > a
  ? 优先级: P1

[2/5] obs-20260101-def456
  类型: coverage_gap
  描述: AC 未覆盖...
  ? 决策: > d
  ? 优先级: P3

... (继续处理)

📊 归类完成
  accepted: 2 → 创建 2 个提案草稿
  deferred: 2 → 优先级 P2-P3
  ignored: 1
  skipped: 0
```

**Acceptance Criteria:**
- [x] AC-017: 实现 `--batch <status>` 选项
- [x] AC-018: 支持快捷键操作（a/d/i/s）
- [x] AC-019: 显示进度和统计
- [x] AC-020: 支持跳过（稍后处理）

---

## 派生产物 (Derived Outputs)

> **注**: triage 是 `/mob-seed:spec` 的子操作，不单独派生命令文件。

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/triage-handler.js ✅ | triage 子操作处理逻辑 |
| 测试 | skills/mob-seed/test/ace/triage-handler.test.js ✅ (26/26 pass) | 单元测试 |
| 文档 | docs/api/spec-triage.md | API 文档（合并到 spec 命令文档） |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md
- 被依赖: 无
