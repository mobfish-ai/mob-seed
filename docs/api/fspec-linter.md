# fspec Linter (规格检查器)

> fspec 文件质量检查与自动修复

## 概述

检查 fspec 文件质量，识别模糊词汇（"某种"、"可能"、"大概"等）、格式错误、缺失字段，确保规格文件的精确性和完整性。

## 安装

```javascript
const {
  lintFile,
  lintContent,
  lintDirectory,
  generateReport,
  detectFuzzyWords,
  validateFormat,
  validateRequirements,
  validateIds,
  validateReferences,
  generateFixes,
  applyFixes,
  loadFuzzyWordList,
  addFuzzyWord
} = require('mob-seed/lib/quality/fspec-linter');
```

## API

### lintFile(filePath)

检查单个 fspec 文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | fspec 文件路径 |

**返回:**

```javascript
{
  file: string,
  passed: boolean,
  errors: LintError[],
  warnings: LintWarning[]
}
```

**示例:**

```javascript
const result = await lintFile('/specs/feature.fspec.md');
// { file: '...', passed: false, errors: [...], warnings: [...] }
```

### lintContent(content, options)

检查 fspec 内容字符串。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | fspec 文件内容 |
| options | object | 检查选项 |

**返回:** `LintResult`

### lintDirectory(dirPath, options)

批量检查目录。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| dirPath | string | 目录路径 |
| options.recursive | boolean | 是否递归 |
| options.ignore | string[] | 忽略的模式 |

**返回:**

```javascript
{
  totalFiles: number,
  passedFiles: number,
  totalErrors: number,
  totalWarnings: number,
  results: LintResult[]
}
```

### generateReport(results)

生成 Markdown 检查报告。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| results | LintResult[] | 检查结果列表 |

**返回:** `string` - Markdown 报告

### detectFuzzyWords(content)

检测模糊词汇。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 文件内容 |

**返回:**

```javascript
[
  {
    word: string,        // 模糊词
    line: number,        // 行号
    column: number,      // 列号
    category: string,    // 类别
    suggestion: string   // 修改建议
  }
]
```

### validateFormat(content)

验证格式。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 文件内容 |

**返回:** `FormatError[]` - 格式错误列表

### validateRequirements(content)

验证需求结构。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 文件内容 |

**返回:** `RequirementError[]` - 需求错误列表

### validateIds(content)

验证 ID 唯一性。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 文件内容 |

**返回:**

```javascript
[
  {
    id: string,
    type: 'REQ' | 'AC',
    line: number,
    issue: 'duplicate' | 'invalid_format'
  }
]
```

### validateReferences(content)

验证引用完整性。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 文件内容 |

**返回:** `ReferenceError[]` - 引用错误列表

### generateFixes(errors)

生成修复建议。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| errors | LintError[] | 错误列表 |

**返回:**

```javascript
[
  {
    file: string,
    line: number,
    original: string,
    fixed: string,
    description: string
  }
]
```

### applyFixes(filePath, fixes)

应用修复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 文件路径 |
| fixes | Fix[] | 修复列表 |

**返回:** void

### loadFuzzyWordList(customPath?)

加载模糊词汇表。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| customPath | string | 可选，自定义词汇表路径 |

**返回:** `string[]` - 模糊词列表

### addFuzzyWord(word, category)

添加自定义模糊词。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| word | string | 词汇 |
| category | string | 类别 |

**返回:** void

## 模糊词汇分类

| 类别 | 中文 | 英文 |
|------|------|------|
| 程度模糊 | 某种、一些、大概、可能、也许 | some, maybe, perhaps, probably |
| 时间模糊 | 适时、合适时候、尽快 | soon, later, eventually |
| 数量模糊 | 若干、几个、多个、很多 | several, many, few |
| 条件模糊 | 如有必要、视情况、酌情 | if necessary, as needed |
| 范围模糊 | 等等、之类、相关 | etc, and so on, related |

## 必需字段检查

| 字段 | 位置 | 必需 | 说明 |
|------|------|------|------|
| 状态 | 元数据块 | 是 | draft/review/implementing/archived |
| 版本 | 元数据块 | 是 | 语义化版本号 |
| 技术栈 | 元数据块 | 是 | JavaScript/TypeScript/Python |
| 派生路径 | 元数据块 | 是 | 代码生成目标路径 |
| 概述 | ## 概述 | 是 | 功能简要描述 |
| Requirements | ## ADDED/MODIFIED | 是 | 至少一个需求 |

## 规则配置

| 规则 | 默认级别 | 说明 |
|------|----------|------|
| fuzzy-words | warn | 模糊词汇检测 |
| missing-fields | error | 缺失字段 |
| invalid-format | error | 格式错误 |
| duplicate-ids | error | 重复 ID |
| broken-refs | warn | 引用失效 |

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

## 检测输出示例

```
模糊词汇检测
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

feature.fspec.md

  第 15 行: "系统应该**尽快**响应用户请求"
           "尽快" 是模糊词汇
           建议: 明确响应时间，如 "在 200ms 内响应"

  第 28 行: "处理**若干**类型的输入"
           "若干" 是模糊词汇
           建议: 明确类型列表，如 "处理 JSON、XML、CSV 三种格式"

发现 2 处模糊词汇
```

## 相关链接

- [规格文件](../../openspec/specs/quality/fspec-linter.fspec.md)
- [源代码](../../skills/mob-seed/lib/quality/fspec-linter.js)
- [测试](../../skills/mob-seed/test/quality/fspec-linter.test.js)
