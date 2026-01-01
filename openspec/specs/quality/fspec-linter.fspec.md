# Feature: fspec Linter (规格检查器)

> 状态: implementing
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/quality/
> 优先级: P1
> 预计工作量: 2-3天

## 概述

检查 fspec 文件质量，识别模糊词汇（"某种"、"可能"、"大概"等）、格式错误、缺失字段，确保规格文件的精确性和完整性。

## ADDED Requirements

### REQ-001: 模糊词汇检测

The system SHALL detect fuzzy/ambiguous words in fspec files.

**模糊词汇列表:**

| 类别 | 中文 | 英文 |
|------|------|------|
| 程度模糊 | 某种、一些、大概、可能、也许 | some, maybe, perhaps, probably |
| 时间模糊 | 适时、合适时候、尽快 | soon, later, eventually |
| 数量模糊 | 若干、几个、多个、很多 | several, many, few |
| 条件模糊 | 如有必要、视情况、酌情 | if necessary, as needed |
| 范围模糊 | 等等、之类、相关 | etc, and so on, related |

**Scenario: 检测模糊词汇**
- WHEN 扫描 fspec 文件内容
- AND 发现模糊词汇
- THEN 标记位置和建议替换
- AND 输出警告信息

**输出示例:**

```
⚠️ 模糊词汇检测
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 feature.fspec.md

  第 15 行: "系统应该**尽快**响应用户请求"
           ⚠️ "尽快" 是模糊词汇
           💡 建议: 明确响应时间，如 "在 200ms 内响应"

  第 28 行: "处理**若干**类型的输入"
           ⚠️ "若干" 是模糊词汇
           💡 建议: 明确类型列表，如 "处理 JSON、XML、CSV 三种格式"

发现 2 处模糊词汇
```

**Acceptance Criteria:**
- [ ] AC-001: 支持中英文模糊词检测
- [ ] AC-002: 提供替换建议
- [ ] AC-003: 支持自定义词汇表

### REQ-002: 格式验证

The system SHALL validate fspec file format.

**必需字段检查:**

| 字段 | 位置 | 必需 | 说明 |
|------|------|------|------|
| 状态 | 元数据块 | ✅ | draft/review/implementing/archived |
| 版本 | 元数据块 | ✅ | 语义化版本号 |
| 技术栈 | 元数据块 | ✅ | JavaScript/TypeScript/Python |
| 派生路径 | 元数据块 | ✅ | 代码生成目标路径 |
| 概述 | ## 概述 | ✅ | 功能简要描述 |
| Requirements | ## ADDED/MODIFIED | ✅ | 至少一个需求 |

**Scenario: 验证必需字段**
- WHEN 解析 fspec 文件
- AND 检查必需字段
- THEN 报告缺失字段列表

**Acceptance Criteria:**
- [ ] AC-004: 检查元数据块完整性
- [ ] AC-005: 检查必需章节存在
- [ ] AC-006: 报告缺失字段

### REQ-003: 需求结构验证

The system SHALL validate requirement structure.

**需求格式规范:**

```markdown
### REQ-XXX: 需求标题

The system SHALL/SHOULD/MAY ...

**Scenario: 场景名称**
- WHEN 前置条件
- AND 附加条件（可选）
- THEN 期望结果
- AND 附加结果（可选）

**Acceptance Criteria:**
- [ ] AC-XXX: 验收标准描述
```

**Scenario: 验证需求结构**
- WHEN 解析 REQ 块
- THEN 检查是否有 SHALL/SHOULD/MAY 语句
- AND 检查是否有 Scenario 定义
- AND 检查是否有 Acceptance Criteria

**Acceptance Criteria:**
- [ ] AC-007: 检查需求动词使用
- [ ] AC-008: 检查场景完整性
- [ ] AC-009: 检查验收标准存在

### REQ-004: ID 唯一性验证

The system SHALL validate ID uniqueness.

**需要验证的 ID:**

| ID 类型 | 格式 | 唯一范围 |
|--------|------|----------|
| REQ-XXX | REQ-001, REQ-002 | 单文件内 |
| AC-XXX | AC-001, AC-002 | 单文件内 |
| TASK-XXX | TASK-001 | 关联的 tasks.md |

**Scenario: 检测重复 ID**
- WHEN 扫描文件中的所有 ID
- AND 发现重复
- THEN 报告重复 ID 及位置

**Acceptance Criteria:**
- [ ] AC-010: 检测 REQ ID 重复
- [ ] AC-011: 检测 AC ID 重复
- [ ] AC-012: 跨文件 ID 检查（可选）

### REQ-005: 引用完整性验证

The system SHALL validate reference integrity.

**Scenario: 检查内部引用**
- WHEN fspec 引用其他 REQ 或 AC
- THEN 验证被引用的 ID 存在
- AND 如果引用外部 fspec，检查文件存在

**Scenario: 检查依赖项**
- WHEN fspec 声明依赖其他模块
- THEN 验证依赖路径有效
- AND 检查循环依赖

**Acceptance Criteria:**
- [ ] AC-013: 验证内部引用有效
- [ ] AC-014: 验证外部文件引用
- [ ] AC-015: 检测循环依赖

### REQ-006: 批量检查

The system SHALL support batch linting.

**Scenario: 扫描整个目录**
- WHEN 指定目录路径
- THEN 递归扫描所有 .fspec.md 文件
- AND 生成汇总报告

**汇总报告格式:**

```markdown
# fspec Lint 报告

> 扫描时间: 2025-01-01 14:30:00
> 扫描目录: openspec/specs/

## 统计

| 指标 | 数值 |
|------|------|
| 扫描文件数 | 15 |
| 通过文件数 | 12 |
| 警告数 | 8 |
| 错误数 | 3 |

## 问题详情

### ❌ 错误

| 文件 | 行号 | 问题 |
|------|------|------|
| parser.fspec.md | - | 缺少 "状态" 字段 |
| router.fspec.md | 15 | REQ-001 重复定义 |

### ⚠️ 警告

| 文件 | 行号 | 问题 |
|------|------|------|
| sync.fspec.md | 28 | 模糊词 "若干" |
| gate.fspec.md | 42 | 模糊词 "尽快" |
```

**Acceptance Criteria:**
- [ ] AC-016: 递归扫描目录
- [ ] AC-017: 生成 Markdown 报告
- [ ] AC-018: 区分错误和警告

### REQ-007: 自动修复建议

The system SHALL provide fix suggestions.

**Scenario: 生成修复建议**
- WHEN 发现可自动修复的问题
- THEN 生成修复建议
- AND 支持一键应用修复（可选）

**可自动修复的问题:**

| 问题类型 | 修复方式 |
|----------|----------|
| 缺少元数据字段 | 添加模板字段 |
| ID 格式错误 | 重新编号 |
| Scenario 格式 | 添加缺失的 WHEN/THEN |
| AC 缺失复选框 | 添加 `- [ ]` 前缀 |

**Acceptance Criteria:**
- [ ] AC-019: 生成修复 diff
- [ ] AC-020: 支持 `--fix` 自动修复
- [ ] AC-021: 修复前备份原文件

## 导出接口

```javascript
module.exports = {
  // 单文件检查
  lintFile,               // (filePath) => LintResult
  lintContent,            // (content, options) => LintResult

  // 批量检查
  lintDirectory,          // (dirPath, options) => BatchLintResult
  generateReport,         // (results) => string

  // 具体检查项
  detectFuzzyWords,       // (content) => FuzzyWordMatch[]
  validateFormat,         // (content) => FormatError[]
  validateRequirements,   // (content) => RequirementError[]
  validateIds,            // (content) => IdError[]
  validateReferences,     // (content) => ReferenceError[]

  // 修复
  generateFixes,          // (errors) => Fix[]
  applyFixes,             // (filePath, fixes) => void

  // 配置
  loadFuzzyWordList,      // (customPath?) => string[]
  addFuzzyWord,           // (word, category) => void
};
```

## 配置项

```json
{
  "fspecLinter": {
    "fuzzyWordsFile": ".seed/fuzzy-words.json",
    "strictMode": false,
    "autoFix": false,
    "rules": {
      "fuzzy-words": "warn",
      "missing-fields": "error",
      "invalid-format": "error",
      "duplicate-ids": "error",
      "broken-refs": "warn"
    },
    "ignore": [
      "**/archived/**",
      "**/templates/**"
    ]
  }
}
```

## 默认模糊词汇表

```json
{
  "fuzzyWords": {
    "degree": {
      "zh": ["某种", "一些", "大概", "可能", "也许", "差不多", "基本上"],
      "en": ["some", "maybe", "perhaps", "probably", "approximately", "roughly"]
    },
    "time": {
      "zh": ["适时", "合适时候", "尽快", "稍后", "不久"],
      "en": ["soon", "later", "eventually", "in time", "when appropriate"]
    },
    "quantity": {
      "zh": ["若干", "几个", "多个", "很多", "少量"],
      "en": ["several", "many", "few", "a lot", "some number of"]
    },
    "condition": {
      "zh": ["如有必要", "视情况", "酌情", "适当"],
      "en": ["if necessary", "as needed", "when required", "appropriately"]
    },
    "scope": {
      "zh": ["等等", "之类", "相关", "类似"],
      "en": ["etc", "and so on", "related", "similar", "and more"]
    }
  }
}
```

## 依赖

- `lib/lifecycle/parser.js` - fspec 解析

## 测试要点

1. 各类模糊词检测
2. 格式验证完整性
3. ID 唯一性检查
4. 批量扫描性能
5. 自动修复正确性
