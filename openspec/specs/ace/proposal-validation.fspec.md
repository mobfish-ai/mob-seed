# Feature: 提案完整性验证

> 状态: archived
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/spec/
> 优先级: P0 (阻塞性修复)

## 概述 (Overview)

在提案状态转换 `review → archived` 时，验证所有 Phase 的任务都有关联的 fspec 文件，防止审批不完整的提案进入实施阶段。

### 问题背景

v3.0-ace-integration 提案在进入 archived 状态时，Phase 2-4 的任务没有关联 fspec，导致：
1. 实施阶段被迫临时创建 fspec
2. 违反 SEED 方法论的 "规格先行" 原则
3. fspec 未经 review 就开始实施

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 验证必须在状态转换前执行
- 验证失败时阻止状态转换
- 提供清晰的错误提示

---

## ADDED Requirements

### REQ-001: 任务 fspec 关联检查

The system SHALL verify that all tasks in proposal have associated fspec files.

**检查逻辑**：

```javascript
function validateProposalCompleteness(proposalPath) {
  const proposal = parseProposal(proposalPath);
  const errors = [];

  for (const phase of proposal.phases) {
    for (const task of phase.tasks) {
      if (!task.specs || task.specs.length === 0) {
        errors.push({
          phase: phase.id,
          task: task.id,
          error: '任务缺少关联 fspec'
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**Acceptance Criteria:**
- [x] AC-001: 解析 proposal.md 提取所有任务
- [x] AC-002: 检查每个任务是否有 `→ \`xxx.fspec.md\`` 格式的关联
- [x] AC-003: 返回缺失 fspec 的任务列表

---

### REQ-002: fspec 文件存在性检查

The system SHALL verify that referenced fspec files actually exist.

**检查逻辑**：

```javascript
function validateFspecExistence(proposalDir, specs) {
  const errors = [];

  for (const spec of specs) {
    const specPath = path.join(proposalDir, 'specs', spec);
    if (!fs.existsSync(specPath)) {
      errors.push({
        spec,
        error: 'fspec 文件不存在'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**Acceptance Criteria:**
- [x] AC-004: 检查 specs/ 目录下是否存在引用的 fspec
- [x] AC-005: 支持嵌套目录 (如 specs/ace/xxx.fspec.md)
- [x] AC-006: 返回不存在的 fspec 文件列表

---

### REQ-003: fspec 状态检查

The system SHALL verify that all fspec files are in appropriate status.

**状态要求**：

| 提案状态转换 | fspec 要求 |
|--------------|-----------|
| draft → review | fspec 存在即可 |
| review → archived | 所有 fspec 必须是 review 或更高状态 |

**Acceptance Criteria:**
- [x] AC-007: 读取 fspec 的状态字段
- [x] AC-008: 验证状态符合转换要求
- [x] AC-009: 返回状态不符的 fspec 列表

---

### REQ-004: 状态转换阻止

The system SHALL block state transition when validation fails.

**阻止逻辑**：

```javascript
async function transitionProposal(proposalName, newStatus) {
  if (newStatus === 'archived') {
    const validation = validateProposalCompleteness(proposalPath);

    if (!validation.valid) {
      console.error('❌ 提案验证失败，无法进入 archived 状态');
      console.error('');
      console.error('缺失 fspec 的任务:');
      for (const error of validation.errors) {
        console.error(`  - ${error.phase} / ${error.task}: ${error.error}`);
      }
      console.error('');
      console.error('请先为所有任务创建 fspec 文件');
      return false;
    }
  }

  // 继续状态转换...
}
```

**Acceptance Criteria:**
- [x] AC-010: review → archived 时执行验证
- [x] AC-011: 验证失败时显示详细错误
- [x] AC-012: 验证失败时阻止状态转换
- [x] AC-013: 提供明确的修复建议

---

### REQ-005: 验证报告

The system SHALL provide a detailed validation report.

**报告格式**：

```
📋 提案完整性检查: v3.0-ace-integration

Phase 1: 观察基础
  ✅ 1.1 定义观察数据结构 → observation.fspec.md
  ✅ 1.2 Execute 自动记录 → observation-collector.fspec.md
  ...

Phase 2: 反思能力
  ❌ 2.1 定义反思数据结构 → [缺少 fspec]
  ❌ 2.2 规则匹配式反思 → [缺少 fspec]
  ...

统计: 6/17 任务有 fspec (35%)

❌ 验证失败: 11 个任务缺少 fspec
```

**Acceptance Criteria:**
- [x] AC-014: 按 Phase 分组显示检查结果
- [x] AC-015: 使用 ✅/❌ 图标区分状态
- [x] AC-016: 显示完成百分比
- [x] AC-017: 汇总错误数量

---

### REQ-006: 独立验证命令

The system SHALL provide a standalone validation command.

**命令格式**：

```bash
/mob-seed:spec validate <proposal-name>
```

**用途**：
- 在提交 review 前自检
- 调试验证逻辑
- 生成完整性报告

**Acceptance Criteria:**
- [x] AC-018: 实现 `/mob-seed:spec validate` 子操作
- [x] AC-019: 支持指定提案名称
- [x] AC-020: 输出完整验证报告
- [x] AC-021: 返回退出码（0 成功，1 失败）

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/spec/proposal-validator.js | 提案验证器 |
| 测试 | skills/mob-seed/test/spec/proposal-validator.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: proposal-parser.js（解析 proposal）
- 被依赖: spec-command（状态转换前调用）

---

## 实施优先级

此规格为 **P0 阻塞性修复**，应在 Phase 2 任务开始前完成：

1. 实现验证逻辑
2. 集成到状态转换流程
3. 验证当前提案
4. 补全缺失的 fspec
