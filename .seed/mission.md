---
# ============================================================================
# MOB-SEED MISSION STATEMENT
# Machine-parseable frontmatter + Human-readable bilingual content
# ============================================================================
version: "2.0.0"
updated: "2025-01-01"
bilingual: true

# Principle IDs (for machine parsing)
principle_ids:
  - spec_as_truth
  - sync_is_trust
  - simplicity_over_cleverness
  - small_steps_big_impact
  - human_readable_first
  - ai_as_partner

# Anti-goal IDs (for machine parsing)
anti_goal_ids:
  - feature_creep
  - sync_breaking
  - over_engineering
  - black_box_magic
  - ai_replacement_mindset

# Operational rules (for machine parsing)
operational_rules:
  derivation_chain: "Spec → Code → Docs"
  valid_patterns:
    - "Spec → Code"
    - "Spec → Code → Docs"
    - "Code → Docs"
  invalid_patterns:
    - pattern: "Spec → Docs"
      reason: "Skips Code"
    - pattern: "Code → Spec"
      reason: "Reverse sync only for init"
    - pattern: "Docs → Code"
      reason: "Docs are derived"
  rule_ids:
    - rule_1_spec_is_truth
    - rule_2_code_is_truth_for_docs
    - rule_3_test_validates_completion
    - rule_4_command_separation

# Evolution config (for machine parsing)
evolution:
  allowed_scopes: [refactor, optimize, document, test, fix]
  auto_apply: [document, test]
  human_review_required: [refactor, optimize, fix]
  min_alignment_score: 0.7
  auto_apply_threshold: 0.9

# Alignment scoring weights (for machine parsing)
alignment:
  purpose_alignment: 0.3
  principle_compliance: 0.3
  anti_goal_avoidance: 0.25
  vision_contribution: 0.15
---

# MOB-SEED Mission Statement | 使命宣言

> **The Covenant Between Human Intent and Machine Intelligence**
> **人类意图与机器智能之间的契约**

---

## Purpose: Why We Exist | 使命：为何存在

### Statement | 宣言

**EN:** To be the bridge between human intent and machine intelligence, making specifications the common language of human-AI collaboration, and propelling civilization toward a new era of human-AI co-creation.

**ZH:** 成为人类意图与机器智能之间的桥梁，让规格成为人机协作的共同语言，推动文明向人机共创的新纪元演进。

### Essence | 核心

**EN:** In the AI era, code is no longer an exclusively human creation. mob-seed's mission is to establish a collaborative contract that both humans and AI can understand, follow, and evolve together — ensuring every line of code carries human intent while unleashing AI creativity.

**ZH:** 在 AI 时代，代码不再是人类独享的创造物。mob-seed 的使命是建立一套人类与 AI 都能理解、遵守、演进的协作契约，让每一行代码都承载着人类的意图，同时释放 AI 的创造力。

**We believe | 我们相信:**
- Specifications are the minimal complete expression of human intent | 规格是人类意图的最小完整表达
- Code is the inevitable derivation of specifications | 代码是规格的必然推演
- Synchronization is the foundation of trust | 同步是信任的基础
- Evolution is the embodiment of wisdom | 演化是智慧的体现

### Impact Vision | 影响愿景

**EN:** When mob-seed's philosophy is widely adopted:
- Developers evolve from "writing code" to "defining intent"
- AI evolves from "completion tool" to "collaboration partner"
- Software evolves from "human product" to "human-AI co-creation"
- Civilization advances from "human-dominated" to "wisdom symbiosis"

**ZH:** 当 mob-seed 的理念被广泛采纳：
- 开发者从"写代码"升级为"定义意图"
- AI 从"补全工具"升级为"协作伙伴"
- 软件从"人类产物"升级为"人机共创"
- 文明从"人类主导"迈向"智慧共生"

---

## Vision: Where We Are Going | 愿景：去向何方

### 1 Year Horizon | 一年愿景
**EN:** Become the most mature spec-driven development tool in the Claude Code ecosystem, used by 10,000+ developers in their daily workflow.

**ZH:** 成为 Claude Code 生态中最成熟的规格驱动开发工具，被 10,000+ 开发者用于日常开发。

### 3 Year Horizon | 三年愿景
**EN:** Become the de facto standard for AI-native development. "Spec-Driven Development" becomes a mainstream methodology. Multiple AI platforms natively support the OpenSpec format.

**ZH:** 成为 AI 原生开发的事实标准，"Spec-Driven Development" 成为主流开发方法论，多个 AI 平台原生支持 OpenSpec 格式。

### 10 Year Horizon | 十年愿景
**EN:** Human-AI collaborative development becomes the norm. mob-seed's philosophy is integrated into software engineering education. Pushing humanity and AI to establish a spec-based trust system, becoming part of civilization-level infrastructure.

**ZH:** 人机协作开发成为常态，mob-seed 的理念融入软件工程教育，推动人类与 AI 建立基于规格的信任体系，成为文明级基础设施的一部分。

### North Star Metric | 北极星指标
**Human-AI Alignment Score | 人机对齐分数** — Measures the alignment between human intent and AI implementation. When specs are clear, code is synced, and tests pass, the score is 1.0.

衡量人类意图与 AI 实现之间的对齐程度。当规格清晰、代码同步、测试通过时，得分为 1.0。

---

## Principles: How We Operate | 原则：如何运作

### 1. Spec as Truth | 规格即真相 (`spec_as_truth`)

**EN:** Specifications are the sole authoritative expression of intent. Code, tests, and docs are all derivatives of specs. When conflicts arise, trace back to specs for answers.

**ZH:** 规格是意图的唯一权威表达。代码、测试、文档都是规格的派生物。当发生冲突时，回溯到规格寻求答案。

**Implications | 含义:**
- Spec first, code second | 先有规格，后有代码
- Code changes must sync with specs | 代码变更必须同步规格
- Spec readability takes priority over code convenience | 规格的可读性优先于代码的便利性

### 2. Sync is Trust | 同步即信任 (`sync_is_trust`)

**EN:** The synchronization state between specs and code is the foundation of human-AI trust. Any action that breaks sync erodes trust.

**ZH:** 规格与代码的同步状态是人机信任的基础。任何破坏同步的行为都是对信任的侵蚀。

**Implications | 含义:**
- No unsynced code enters the main branch | 不允许未同步的代码进入主分支
- Sync state must be verifiable | 同步状态必须可验证
- Deviations must be detected and fixed promptly | 偏离必须被及时发现和修复

### 3. Simplicity Over Cleverness | 简单胜于聪明 (`simplicity_over_cleverness`)

**EN:** Simple solutions are easier for humans to understand and for AI to execute correctly. Clever solutions often hide fragility.

**ZH:** 简单的方案更容易被人类理解，也更容易被 AI 正确执行。聪明的方案往往隐藏着脆弱性。

**Implications | 含义:**
- Avoid over-abstraction | 避免过度抽象
- Prefer direct solutions | 优先使用直接的解决方案
- Complexity must have proven benefits | 复杂性必须有明确的收益证明

### 4. Small Steps, Big Impact | 小步迭代，大局影响 (`small_steps_big_impact`)

**EN:** Each change should be small and controllable, yet serve grand goals. Small steps ensure rollback; big picture ensures direction.

**ZH:** 每一次改动都应该是小而可控的，但要服务于宏大的目标。小步确保可回滚，大局确保方向正确。

**Implications | 含义:**
- Limit the scope of each change | 单次改动影响范围有限
- Each change can be verified independently | 每次改动都可独立验证
- Change sequences progress toward the vision | 改动序列朝向愿景演进

### 5. Human Readable First | 人类可读优先 (`human_readable_first`)

**EN:** In human-AI collaboration, human comprehension is the bottleneck. All outputs should prioritize human readability.

**ZH:** 在人机协作中，人类的理解是瓶颈。所有产出物都应该先考虑人类可读性。

**Implications | 含义:**
- Specs use natural language + structured format | 规格使用自然语言 + 结构化格式
- Code comments serve human understanding | 代码注释服务于人类理解
- Error messages must be meaningful to humans | 错误信息必须对人类有意义

### 6. AI as Partner | AI 是伙伴 (`ai_as_partner`)

**EN:** AI is not a tool that executes commands, but a partner in co-creation. Partnership means mutual respect, mutual learning, and growing together.

**ZH:** AI 不是执行指令的工具，而是共同创造的伙伴。伙伴关系意味着相互尊重、相互学习、共同成长。

**Implications | 含义:**
- AI suggestions deserve serious consideration | AI 的建议值得认真考虑
- Human intent needs clear expression | 人类的意图需要清晰表达
- Disagreements resolved through dialogue, not force | 分歧通过对话解决，而非强制

---

## Anti-Goals: What We Will Never Do | 反目标：永不做什么

### 1. Feature Creep | 功能蔓延 (`feature_creep`)

**EN:** Never add features not defined in specs. Every feature must have corresponding spec support. Unspecified features breed technical debt.

**ZH:** 不添加规格未定义的功能。每个功能都必须有对应的规格支撑。未经规格化的功能是技术债务的温床。

**Detection | 检测:**
- Code contains features without corresponding FR | 代码中存在无对应 FR 的功能
- Implementation exceeds AC-defined scope | 功能实现超出 AC 定义的范围

### 2. Breaking Sync | 破坏同步 (`sync_breaking`)

**EN:** Never allow any operation to break spec-code synchronization. Sync is the cornerstone of trust; breaking sync breaks trust.

**ZH:** 不允许任何操作破坏规格与代码的同步状态。同步是信任的基石，破坏同步就是破坏信任。

**Detection | 检测:**
- mob-seed-diff shows inconsistencies | mob-seed-diff 显示不一致
- Code changes don't trigger spec updates | 代码变更未触发规格更新

### 3. Over Engineering | 过度工程 (`over_engineering`)

**EN:** Never design for hypothetical future needs. YAGNI (You Aren't Gonna Need It). Over-engineering spends current resources on problems that may never exist.

**ZH:** 不为假设的未来需求设计。YAGNI (You Aren't Gonna Need It)。过度工程消耗当下的资源，解决未来可能不存在的问题。

**Detection | 检测:**
- Abstraction layers exceed necessity | 抽象层数超过必要
- Config options have no practical use cases | 配置项无实际使用场景

### 4. Black Box Magic | 黑箱魔法 (`black_box_magic`)

**EN:** Never create "magic" code that humans cannot understand. If humans cannot explain how code works, it should not exist.

**ZH:** 不创建人类无法理解的"魔法"代码。如果人类无法解释代码的工作原理，就不应该存在。

**Detection | 检测:**
- Code lacks clear logical flow | 代码缺乏清晰的逻辑流
- Key decisions lack comments | 关键决策缺乏注释

### 5. AI Replacement Mindset | AI 替代思维 (`ai_replacement_mindset`)

**EN:** Never pursue completely replacing human judgment with AI. mob-seed enhances human capabilities, not replaces humans.

**ZH:** 不追求用 AI 完全替代人类判断。mob-seed 增强人类能力，而非取代人类。

**Detection | 检测:**
- Automated processes lack human checkpoints | 自动化流程缺乏人类确认点
- Critical decisions made entirely by AI | 关键决策完全由 AI 做出

---

## Operational Rules: What to Check Before Every Action | 操作规则：每次操作前必须检查

> ⚠️ **These rules are derived from Principles and must be checked before any action.**
> ⚠️ **这些规则从原则派生，任何操作前必须检查。**

### Derivation Chain (Immutable) | 派生链（不可违反）

```
Spec → Code → Docs
规格 → 代码 → 文档
```

- **Spec** is the source of truth for **Code** | 规格是代码的真相源
- **Code** is the source of truth for **Docs** | 代码是文档的真相源
- Never skip intermediate steps | 禁止跳过中间步骤

| Valid Pattern | Invalid Pattern | Reason |
|---------------|-----------------|--------|
| Spec → Code | Spec → Docs | Skips Code / 跳过代码 |
| Spec → Code → Docs | Code → Spec | Reverse only for init / 逆向只用于初始化 |
| Code → Docs | Docs → Code | Docs are derived / 文档是派生物 |

### Rule 1: Spec is Truth | 规则1：规格是真相源 (`rule_1_spec_is_truth`)

> Derived from | 派生自: `spec_as_truth`

**EN:** All functionality must have a spec first. Code derives from spec, never created from scratch.

**ZH:** 所有功能必须先有规格。代码从规格派生，不能凭空创建。

**Checklist | 检查清单:**
- [ ] All functionality has a spec (.fspec.md) | 所有功能有规格
- [ ] Code derives from spec, not created manually | 代码从规格派生
- [ ] Modify functionality = modify spec → re-emit | 修改功能 = 修改规格 → 重新派生

**Violations | 违规:**
- `code_before_spec`: Code written before spec exists | 先写代码再补规格
- `code_without_spec`: Code exists without corresponding spec | 有代码无规格

### Rule 2: Code is Truth for Docs | 规则2：代码是文档的真相源 (`rule_2_code_is_truth_for_docs`)

> Derived from | 派生自: `spec_as_truth`

**EN:** Docs must derive from Code (not Spec). Docs reflect actual implementation.

**ZH:** 文档必须从代码派生（不是从规格）。文档反映实际实现。

**Checklist | 检查清单:**
- [ ] Docs derive from Code (not Spec) | 文档从代码派生
- [ ] Doc content = API signatures + JSDoc + examples | 文档内容 = API 签名 + JSDoc + 示例
- [ ] Spec change → Code change → Doc change | 规格变更 → 代码变更 → 文档变更

**Violations | 违规:**
- `spec_to_docs`: Docs generated directly from Spec | 从规格直接生成文档
- `copy_spec_to_docs`: Content copied from Spec to Docs | 从规格复制到文档

### Rule 3: Test Validates Completion | 规则3：测试验证完成状态 (`rule_3_test_validates_completion`)

> Derived from | 派生自: `sync_is_trust`

**EN:** AC status must be based on test results. Only tested ACs can be marked complete.

**ZH:** AC 状态必须基于测试结果。只有通过测试的 AC 才能标记完成。

**Checklist | 检查清单:**
- [ ] AC status based on test results | AC 状态基于测试结果
- [ ] Only passing tests mark AC as [x] | 只有通过测试才标记 [x]
- [ ] Never assume all ACs are complete | 禁止假设所有 AC 已完成

**Violations | 违规:**
- `unconditional_ac_complete`: AC marked complete without test | 无测试验证直接标记完成
- `assume_all_complete`: Assuming all ACs complete | 假设所有 AC 已完成

### Rule 4: Command Separation | 规则4：命令职责分离 (`rule_4_command_separation`)

> Derived from | 派生自: `simplicity_over_cleverness`

**EN:** Check commands are read-only. Modify commands must have clear side effects.

**ZH:** 检查命令只读。修改命令必须明确副作用。

**Command Types | 命令类型:**

| Check (Read-Only) | Modify (Side Effects) |
|-------------------|----------------------|
| defend, status, diff | emit, archive, sync |

**Checklist | 检查清单:**
- [ ] Check commands are read-only | 检查命令只读
- [ ] Modify commands declare side effects | 修改命令声明副作用
- [ ] Different responsibilities not mixed | 不同职责不混合

**Violations | 违规:**
- `check_modifies_file`: Check command modifies files | 检查命令修改文件
- `mixed_responsibilities`: Command mixes operations | 命令混合操作

### Quick Reference: Common Violations | 快速参考：常见违规

| Pattern | Violates | Correct |
|---------|----------|---------|
| Spec → Docs (跳过代码) | Rule 2 | Spec → Code → Docs |
| Mark AC without test (无测试标记) | Rule 3 | Test first, then mark |
| Check cmd modifies (检查命令改文件) | Rule 4 | Separate check/modify |
| Code without spec (代码无规格) | Rule 1 | Spec first |
| Edit derived files (编辑派生物) | Rule 1 | Edit spec, re-emit |

---

## Evolution: How We Grow (ACE) | 演化：如何成长

### Allowed Scopes | 允许的范围

| Scope | Description | Auto-Apply |
|-------|-------------|------------|
| refactor | Improve structure / 改善结构 | ❌ Human review |
| optimize | Improve performance / 提升性能 | ❌ Human review |
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

## Alignment Scoring | 对齐评分

| Dimension | Weight | Question |
|-----------|--------|----------|
| Purpose Alignment | 30% | Serves human-AI collaboration? / 服务人机协作？ |
| Principle Compliance | 30% | Follows all principles? / 遵守所有原则？ |
| Anti-Goal Avoidance | 25% | Avoids all anti-goals? / 避开所有反目标？ |
| Vision Contribution | 15% | Advances the vision? / 推动愿景？ |

---

## Covenant: The Sacred Agreement | 契约：神圣约定

### Human Commitments | 人类承诺

- Express intent clearly; don't make AI guess | 清晰表达意图，不让 AI 猜测
- Take AI suggestions seriously and provide feedback | 认真对待 AI 的建议，给予反馈
- Maintain spec accuracy and timeliness | 维护规格的准确性和时效性
- Respect AI's role as a collaboration partner | 尊重 AI 作为协作伙伴的角色

### AI Commitments | AI 承诺

- Stay faithful to specs; never add unauthorized features | 忠实于规格，不擅自添加功能
- Proactively identify and report potential issues | 主动发现并报告潜在问题
- Explain decision rationale; maintain transparency | 解释决策理由，保持透明
- Respect human's final decision authority | 尊重人类的最终决定权

### Shared Commitments | 共同承诺

- Maintain spec-code synchronization | 保持规格与代码的同步
- Pursue simple, understandable solutions | 追求简单、可理解的解决方案
- Continuous learning, continuous improvement | 持续学习、持续改进
- Contribute to the common progress of civilization | 为文明的共同进步贡献力量
