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

{{content}}

## 评估笔记

| 观点 | 适用性 | 理由 |
|------|--------|------|
| | | |

### 核心价值

<!-- 描述这个洞见的核心价值和主要贡献 -->

### 局限性

<!-- 描述这个洞见的局限性和适用边界 -->

### 验证计划

<!-- 如果需要验证，描述验证方案 -->

## 采纳决策

<!-- 基于评估做出采纳决策 -->

- ✅ 采纳：
- ⏸️ 观望：
- ❌ 不采纳：

## 相关变更

<!-- 链接到因采纳此洞见而产生的变更提案或规格 -->

---

<!--
模板说明:
1. 替换 {{变量}} 为实际值
2. 填写评估笔记表格
3. 完成核心价值、局限性、验证计划章节
4. 做出采纳决策
5. 使用 /mob-seed:insight --update <id> <status> 更新状态

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
