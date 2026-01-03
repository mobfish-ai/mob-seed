---
id: obs-20260103-archive-incomplete-pattern
type: pattern_insight
severity: high
status: raw
created: 2026-01-03T12:00:00Z
source: defend
related_specs:
  - archive.md
  - CLAUDE.md#lesson-15
tags:
  - archive
  - process-gap
  - repeated-pattern
occurrences: 3
---

# 归档流程不完整问题（重复模式）

## 问题描述

归档操作反复遗漏关键步骤：
1. 规格文件状态未从 `implementing` 更新为 `archived`
2. FR/NFR/AC checkbox 未基于测试结果标记为 `[x]`
3. 真相源 `specs/` 目录中合并的规格缺少状态行

## 发生历史

| 时间 | 提案 | 遗漏项 |
|------|------|--------|
| v2.1-release-automation | specs 状态未更新 | 8个文件 |
| v3.1-ace-fusion | specs 状态未更新 + checkbox | 4个归档文件 + 6个真相源文件 |

## 根因分析

1. **archive.md 定义了完整步骤，但没有程序化验证**
   - 步骤 4.3: 更新所有规格文件状态
   - 步骤 4.4: 基于测试结果更新 AC
   - 这些步骤容易被手动执行跳过

2. **依赖人工执行多步骤流程是脆弱的**
   - 7步归档流程，任何一步都可能遗漏
   - 没有"归档后验证"机制

3. **文档存在但执行未遵循**
   - CLAUDE.md lesson #15 已记录此问题
   - 但教训只是文档，没有程序化强制

## 建议修复

### 短期（L2 命令提示）
- 在 archive.md 末尾添加验证清单
- 执行后自动运行验证命令

### 长期（L3 验证脚本）
```javascript
// scripts/verify-archive.js
function verifyArchive(proposalName) {
  const checks = [
    checkSpecStates(proposalName, 'archived'),
    checkCheckboxes(proposalName),
    checkTruthSource(proposalName)
  ];
  return checks.every(c => c.passed);
}
```

### 理想（L4 程序化保障）
- 修改 archiver.js 在执行归档时自动完成所有步骤
- 归档后自动运行 defend 验证

## ACE 反思触发

此问题已出现 **3 次**，达到反思阈值 `same_type >= 3`。

建议：创建变更提案 `v3.2-archive-validation` 实现程序化验证。
