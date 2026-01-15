---
id: ins-{{YYYYMMDD}}-{{slug}}
source:
  title: "{{source_title}}"
  type: {{source_type}}
  author: "{{source_author}}"
  affiliation: "{{source_affiliation}}"
  date: {{source_date}}
  context: "{{source_context}}"
  url: "{{source_url}}"
  credibility: {{source_credibility}}
  secondary_sources: []
date: {{date}}
status: evaluating
model_era: {{model_era}}
review_trigger: ""
tags: [{{tags}}]
---

## 原始洞见

### 核心概念

**{{concept_name}}** 是 {{concept_definition}}。

### 解决的问题

{{problem_description}}:
```
{{problem_chain}}
```

该洞见提供的解决方案：
```
{{solution_chain}}
```

### 架构设计 / 方法论

{{architecture_or_methodology}}

### 详细分析

{{detailed_analysis}}

## 评估笔记

| 观点 | 适用性 | 理由 |
|------|--------|------|
| {{point_1}} | {{applicability_1}} | {{reason_1}} |

### 与 mob-seed 的对比分析

| 维度 | 洞见内容 | mob-seed | 差异分析 |
|------|----------|----------|----------|
| 核心理念 | | | |
| 技术方案 | | | |
| 实现方式 | | | |

### 可借鉴的设计

| 设计 | 价值 | mob-seed 实现建议 |
|------|------|-------------------|
| | | |

### 关键洞察

1. **{{insight_1}}**
   - {{insight_1_detail}}

2. **{{insight_2}}**
   - {{insight_2_detail}}

### 潜在改进方向

1. **{{improvement_1}}**
   - 当前：{{current_state_1}}
   - 改进：{{improved_state_1}}

### 局限性

1. **{{limitation_1}}**: {{limitation_1_detail}}
2. **{{limitation_2}}**: {{limitation_2_detail}}

### 验证计划

<!-- 如果需要验证，描述验证方案 -->

## 采纳决策

- ✅ **采纳**:
  1. **{{adopt_1}}** - {{adopt_1_reason}}

- ⏸️ **观望**:
  1. **{{wait_1}}** - {{wait_1_reason}}

- ❌ **不采纳**:
  1. **{{reject_1}}** - {{reject_1_reason}}

## 相关变更

- **潜在规格**: {{potential_spec}}
- **文档改进**: {{doc_improvement}}
- **代码改进**: {{code_improvement}}

## 补充说明

### 项目/来源信息

- **来源**: {{source_url}}
- **定位**: {{positioning}}

### 关键引用

> "{{quote_1}}"

> "{{quote_2}}"

### 核心价值

{{core_value_summary}}

---

<!--
模板说明:
1. 替换 {{变量}} 为实际值
2. 填写评估笔记表格（包括与 mob-seed 的对比分析）
3. 完成关键洞察、潜在改进、局限性章节
4. 做出采纳决策（三类：采纳/观望/不采纳）
5. 使用 /mob-seed:insight --update <id> <status> 更新状态

质量检查清单（创建前必须全部通过）:
□ 核心概念清晰定义（1-2 句话能说清楚是什么）
□ 问题和痛点明确（不是泛泛而谈）
□ 架构/方法论有具体分析（图表或结构化描述）
□ 与 mob-seed 有对比分析（表格形式）
□ 评估笔记完整（每个观点都有适用性判断）
□ 采纳决策明确（分三类：采纳/观望/不采纳）
□ 局限性有识别（至少 2-3 条）
□ 可操作的下一步（潜在规格/改进方向）

状态转换:
- evaluating → piloting: 开始试点验证
- evaluating → adopted: 直接采纳
- evaluating → partial: 部分采纳
- evaluating → rejected: 拒绝采纳
- piloting → adopted: 验证通过，正式采纳
- piloting → partial: 部分验证通过
- piloting → rejected: 验证失败
- adopted/partial → obsolete: 标记过时
- rejected/obsolete → evaluating: 重新评估
-->
