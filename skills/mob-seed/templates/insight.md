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

### 方法论关联

> 从 `.seed/config.json` → `ace.insight.methodologies` 读取对比目标。
> 默认对比 mob-seed 自身；项目可 override 为自定义列表。
> 只对比有交集的，不必每条都填。

| 方法论 | 关联点 | 启发/差异 |
|--------|--------|-----------|
| {{methodology}} | {{intersection}} | {{insight_or_diff}} |

### 可借鉴的设计

| 设计 | 价值 | 实现建议 |
|------|------|----------|
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

### 关联洞见

{必须通过 Grep 搜索 tags/关键词，找到相关洞见并用 [[wikilink]] 链接}

- 关联洞见: [[ins-YYYYMMDD-xxx]] (简要说明关联关系)
- 关联洞见: [[ins-YYYYMMDD-yyy]] (简要说明关联关系)

### 来源追溯

- 来源: {{source_url}}
- 原文存档: （如有 archive 文件，用 [[wikilink]] 链接）

### 潜在行动

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
2. 填写评估笔记表格（包括方法论关联，按 config.methodologies）
3. 完成关键洞察、潜在改进、局限性章节
4. 做出采纳决策（三类：采纳/观望/不采纳）
5. 使用 /mob-seed:insight --update <id> <status> 更新状态

质量检查清单（创建前必须全部通过）:
□ 核心概念清晰定义（1-2 句话能说清楚是什么）
□ 问题和痛点明确（不是泛泛而谈）
□ 架构/方法论有具体分析（图表或结构化描述）
□ 方法论关联已分析（按 config.methodologies，表格形式）
□ 评估笔记完整（每个观点都有适用性判断）
□ 采纳决策明确（分三类：采纳/观望/不采纳）
□ 局限性有识别（至少 2-3 条）
□ 可操作的下一步（潜在规格/改进方向）
□ 关联洞见已检索并链接（Grep 搜索相关 tags/关键词，用 [[wikilink]] 链接）
□ 来源追溯已链接（原文 URL/archive 的链接）
□ 元数据从原文明确提取（无推测）

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
