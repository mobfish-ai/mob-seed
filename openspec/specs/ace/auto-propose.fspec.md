# Feature: 自动建议提案内容

> 状态: archived
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/
> 优先级: Phase 4 (v3.1+)

## 概述 (Overview)

基于反思内容自动生成提案草稿，包括问题分析、解决方案、实施任务等。

### 目标用户

- 使用 mob-seed 的开发者
- 需要快速创建提案的场景

### 业务约束

- 生成内容为建议，需用户确认
- 保持与现有提案格式一致
- 支持模板定制

---

## ADDED Requirements

### REQ-001: 提案内容生成

The system SHALL generate proposal content from reflection.

**生成内容**:

| 章节 | 生成来源 |
|------|---------|
| 概述 | 反思的教训描述 |
| 问题分析 | 反思的分析 + 观察上下文 |
| 建议方案 | 反思的建议行动 |
| 实施阶段 | 从建议行动分解 |
| 来源追溯 | 自动填充 |
| 影响范围 | 从观察的 related_spec 提取 |

**生成流程**:

```
反思 ref-001
    │
    ├── 教训 ───────────► 概述
    ├── 分析 ───────────► 问题分析
    ├── 建议行动 ────────► 建议方案 + 实施阶段
    ├── 观察列表 ────────► 来源追溯
    └── related_specs ──► 影响范围
```

**Acceptance Criteria:**
- [x] AC-001: 从反思生成完整提案草稿
- [x] AC-002: 各章节内容合理映射
- [x] AC-003: 保持 proposal.md 标准格式
- [x] AC-004: 支持空字段的默认处理

---

### REQ-002: 实施阶段分解

The system SHALL break down suggested actions into phases and tasks.

**分解策略**:

```javascript
function breakdownToPhases(suggestedActions) {
  const phases = [];
  let currentPhase = { name: '', tasks: [] };

  for (const action of suggestedActions) {
    if (isPhaseMarker(action)) {
      if (currentPhase.tasks.length > 0) {
        phases.push(currentPhase);
      }
      currentPhase = { name: extractPhaseName(action), tasks: [] };
    } else {
      currentPhase.tasks.push(action);
    }
  }

  if (currentPhase.tasks.length > 0) {
    phases.push(currentPhase);
  }

  // 如果没有 Phase 标记，创建默认 Phase
  if (phases.length === 0) {
    phases.push({
      name: '实施',
      tasks: suggestedActions
    });
  }

  return phases;
}
```

**Phase 识别规则**:
- 以 "Phase", "阶段", "Step" 开头
- 包含数字编号
- 包含冒号分隔符

**Acceptance Criteria:**
- [x] AC-005: 识别 Phase 标记
- [x] AC-006: 正确分组任务
- [x] AC-007: 无标记时创建默认 Phase
- [x] AC-008: 保持任务顺序

---

### REQ-003: fspec 关联建议

The system SHALL suggest fspec files to create or modify.

**关联分析**:

```
反思涉及规格:
├── parser.fspec.md (3 个观察)
├── loader.fspec.md (2 个观察)
└── 无规格关联 (1 个观察)

建议:
1. 修改 parser.fspec.md - 添加空值处理 AC
2. 修改 loader.fspec.md - 添加边界条件 AC
3. 新建 null-handling.fspec.md - 统一空值策略
```

**建议逻辑**:

```javascript
function suggestSpecs(reflection, observations) {
  const specCounts = {};

  // 统计规格出现次数
  for (const obs of observations) {
    if (obs.related_spec) {
      specCounts[obs.related_spec] = (specCounts[obs.related_spec] || 0) + 1;
    }
  }

  const suggestions = [];

  // 建议修改的现有规格
  for (const [spec, count] of Object.entries(specCounts)) {
    suggestions.push({
      type: 'modify',
      spec,
      reason: `${count} 个相关观察`,
      priority: count >= 2 ? 'high' : 'medium'
    });
  }

  // 建议新建的规格（基于教训主题）
  if (reflection.lesson.includes('统一') || reflection.lesson.includes('策略')) {
    suggestions.push({
      type: 'create',
      spec: `${extractTopic(reflection.lesson)}.fspec.md`,
      reason: '需要新规格定义统一策略',
      priority: 'high'
    });
  }

  return suggestions;
}
```

**Acceptance Criteria:**
- [x] AC-009: 统计观察关联的规格
- [x] AC-010: 建议修改高频规格
- [x] AC-011: 识别需要新建的规格场景
- [x] AC-012: 输出优先级排序的建议列表

---

### REQ-004: 模板定制

The system SHALL support customizable proposal templates.

**模板位置**: `.seed/templates/proposal.md.hbs`

**默认模板**:

```handlebars
# {{name}}

> **状态**: draft
> **版本**: 1.0.0
> **创建**: {{created}}
> **来源**: {{source.id}}

## 概述

{{overview}}

## 来源追溯

本提案源自以下观察/反思：

| ID | 类型 | 描述 | 创建时间 |
|----|------|------|---------|
{{#each sources}}
| {{id}} | {{type}} | {{description}} | {{created}} |
{{/each}}

## 问题分析

{{analysis}}

## 建议方案

{{solution}}

## 实施阶段

{{#each phases}}
### Phase {{@index}}: {{name}}

{{#each tasks}}
- [x] {{this}}
{{/each}}

{{/each}}

## 规格影响

{{#each specSuggestions}}
- {{#if (eq type "modify")}}修改{{else}}新建{{/if}} `{{spec}}`: {{reason}}
{{/each}}
```

**模板变量**:

| 变量 | 类型 | 说明 |
|------|------|------|
| name | string | 提案名称 |
| created | string | 创建时间 |
| source | object | 来源 (id, type) |
| overview | string | 概述内容 |
| sources | array | 来源追溯列表 |
| analysis | string | 问题分析 |
| solution | string | 建议方案 |
| phases | array | 实施阶段列表 |
| specSuggestions | array | 规格建议列表 |

**Acceptance Criteria:**
- [x] AC-013: 支持 Handlebars 模板语法
- [x] AC-014: 提供默认模板
- [x] AC-015: 支持自定义模板
- [x] AC-016: 模板变量完整传递

---

### REQ-005: 交互式编辑

The system SHALL support interactive editing before creation.

**编辑流程**:

```
📝 生成提案草稿: fix-null-handling

┌─────────────────────────────────────────┐
│ 概述:                                    │
│ 统一项目的空值处理策略，解决 null/       │
│ undefined 混用导致的运行时错误。          │
│                                         │
│ [e] 编辑  [✓] 确认                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 问题分析:                                │
│ 3 个独立观察都涉及空值处理问题...         │
│                                         │
│ [e] 编辑  [✓] 确认                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 实施阶段:                                │
│ Phase 1: 规范制定                        │
│   - [ ] 添加空值处理原则到 mission.md    │
│   - [ ] 创建 null-handling.fspec.md     │
│                                         │
│ Phase 2: 工具实现                        │
│   - [ ] 实现 isNil() 工具函数            │
│   - [ ] 添加 ESLint 规则                 │
│                                         │
│ [e] 编辑  [+] 添加任务  [-] 删除任务     │
└─────────────────────────────────────────┘

全部确认后创建提案? [y/n]
```

**编辑选项**:

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 编辑章节 | e | 打开文本编辑 |
| 确认章节 | Enter | 保持当前内容 |
| 添加任务 | + | 在当前 Phase 添加任务 |
| 删除任务 | - | 删除当前任务 |
| 跳过 | s | 跳过当前章节 |
| 退出 | q | 取消创建 |

**Acceptance Criteria:**
- [x] AC-017: 分章节展示生成内容
- [x] AC-018: 支持章节编辑
- [x] AC-019: 支持任务增删
- [x] AC-020: 确认后才创建文件

---

### REQ-006: LLM 增强建议 (可选)

The system SHALL use LLM to enhance proposal content when available.

**增强内容**:

| 章节 | 增强方式 |
|------|---------|
| 问题分析 | LLM 深化分析 |
| 建议方案 | LLM 补充替代方案 |
| 风险评估 | LLM 生成 (新增章节) |
| 验收标准 | LLM 建议 AC |

**LLM 提示词**:

```markdown
## 任务

基于以下反思内容，生成软件变更提案的详细建议。

## 反思内容

教训: {{lesson}}
分析: {{analysis}}
建议行动: {{actions}}
关联观察: {{observations}}

## 输出

请返回 JSON 格式:

```json
{
  "enhanced_analysis": "深化的问题分析...",
  "alternative_solutions": ["替代方案1", "替代方案2"],
  "risks": [
    { "risk": "风险描述", "mitigation": "缓解措施" }
  ],
  "acceptance_criteria": ["AC-001: ...", "AC-002: ..."]
}
```
```

**Acceptance Criteria:**
- [x] AC-021: LLM 可用时增强分析
- [x] AC-022: 生成替代方案建议
- [x] AC-023: 生成风险评估章节
- [x] AC-024: 建议验收标准

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/proposal-generator.js | 提案生成器 |
| 代码 | skills/mob-seed/lib/ace/phase-breakdown.js | 阶段分解 |
| 代码 | skills/mob-seed/lib/ace/spec-suggester.js | 规格建议 |
| 模板 | skills/mob-seed/templates/proposal.md.hbs | 默认模板 |
| 测试 | skills/mob-seed/test/ace/proposal-generator.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: reflection.fspec.md, promote-handler.fspec.md, llm-reflect.fspec.md
- 被依赖: 无
