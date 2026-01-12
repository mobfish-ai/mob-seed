---
# ============================================================================
# PROJECT MISSION STATEMENT
# Machine-parseable frontmatter + Human-readable bilingual content
# ============================================================================
version: "1.0.0"
updated: "{{TIMESTAMP}}"
bilingual: true

# Principle IDs (for machine parsing)
# Add your own principle IDs here
principle_ids:
  - principle_1
  - principle_2

# Anti-goal IDs (for machine parsing)
# Add your own anti-goal IDs here
anti_goal_ids:
  - anti_goal_1
  - anti_goal_2

# Evolution config (for machine parsing)
evolution:
  allowed_scopes: [refactor, document, test, fix]
  auto_apply: [document, test]
  human_review_required: [refactor, fix]
  min_alignment_score: 0.7
  auto_apply_threshold: 0.9

# Alignment scoring weights (for machine parsing)
alignment:
  purpose_alignment: 0.3
  principle_compliance: 0.3
  anti_goal_avoidance: 0.25
  vision_contribution: 0.15
---

# Project Mission | 项目使命

> **[Your project tagline / 项目标语]**

---

## Purpose: Why We Exist | 使命：为何存在

### Statement | 宣言

**EN:** [Define your project's core mission in 1-2 sentences. What problem does it solve? Who does it serve?]

**ZH:** [用1-2句话定义项目的核心使命。解决什么问题？服务谁？]

### Essence | 核心

**EN:** [Expand on why this project matters. What's the deeper motivation? What change do you want to create?]

**ZH:** [展开说明为什么这个项目重要。更深层的动机是什么？想要创造什么改变？]

---

## Vision: Where We Are Going | 愿景：去向何方

### 1 Year Horizon | 一年愿景

**EN:** [What do you want to achieve in 1 year?]

**ZH:** [1年内想要达成什么目标？]

### 3 Year Horizon | 三年愿景

**EN:** [What do you want to achieve in 3 years?]

**ZH:** [3年内想要达成什么目标？]

### North Star Metric | 北极星指标

**[Your primary success metric]** — [How do you measure success?]

[你如何衡量成功？]

---

## Principles: How We Operate | 原则：如何运作

> Define 2-5 core principles that guide your project's development.
> 定义 2-5 个核心原则来指导项目开发。

### 1. [Principle Name] | [原则名称] (`principle_1`)

**EN:** [Describe what this principle means and why it matters]

**ZH:** [描述这个原则的含义和重要性]

**Implications | 含义:**
- [What does this mean in practice?] | [实践中意味着什么？]
- [What behaviors does it encourage?] | [鼓励什么行为？]
- [What decisions does it guide?] | [指导什么决策？]

---

### 2. [Principle Name] | [原则名称] (`principle_2`)

**EN:** [Describe what this principle means and why it matters]

**ZH:** [描述这个原则的含义和重要性]

**Implications | 含义:**
- [Implication 1] | [含义1]
- [Implication 2] | [含义2]
- [Implication 3] | [含义3]

---

## Anti-Goals: What We Will Never Do | 反目标：永不做什么

> Define things your project will explicitly avoid.
> 定义项目明确要避免的事情。

### [Anti-Goal Name] | [反目标名称] (`anti_goal_1`)

**EN:** [What will you never do? Why is this harmful?]

**ZH:** [你永远不会做什么？为什么这是有害的？]

**Detection | 检测:**
- [How do you know you're violating this?] | [如何知道自己违反了这条？]
- [What warning signs to watch for?] | [要注意什么警告信号？]

---

### [Anti-Goal Name] | [反目标名称] (`anti_goal_2`)

**EN:** [What will you never do? Why is this harmful?]

**ZH:** [你永远不会做什么？为什么这是有害的？]

**Detection | 检测:**
- [Detection signal 1] | [检测信号1]
- [Detection signal 2] | [检测信号2]

---

## Evolution: How We Grow | 演化：如何成长

### Allowed Scopes | 允许的范围

| Scope | Description | Auto-Apply |
|-------|-------------|------------|
| refactor | Improve structure / 改善结构 | ❌ Human review |
| document | Add/improve docs / 增强文档 | ✅ Auto |
| test | Add/improve tests / 增强测试 | ✅ Auto |
| fix | Fix bugs / 修复缺陷 | ❌ Human review |

### Decision Criteria | 决策标准

- **Minimum alignment score | 最低对齐分数:** 0.7
- **Auto-apply threshold | 自动应用阈值:** 0.9
- **Auto-apply conditions | 自动应用条件:**
  - All tests pass | 所有测试通过
  - No anti-goal violations | 无反目标违规
  - Alignment score ≥ 0.9 | 对齐分数 ≥ 0.9

---

## Covenant: The Agreement | 契约：约定

### Human Commitments | 人类承诺

- [What do humans commit to?] | [人类承诺什么？]
- [How will humans support AI?] | [人类如何支持 AI？]
- [What responsibilities do humans take?] | [人类承担什么责任？]

---

### AI Commitments | AI 承诺

- [What does AI commit to?] | [AI 承诺什么？]
- [How will AI support humans?] | [AI 如何支持人类？]
- [What responsibilities does AI take?] | [AI 承担什么责任？]

---

### Shared Commitments | 共同承诺

- [What do both commit to together?] | [双方共同承诺什么？]
- [What values are shared?] | [共享什么价值观？]
- [What goals are aligned?] | [什么目标是一致的？]
