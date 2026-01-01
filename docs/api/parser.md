# OpenSpec Parser (规格解析器)

> OpenSpec 规格文件解析与状态管理

## 概述

OpenSpec 规格文件解析器，支持元数据提取、Delta 语法解析和规格状态管理。

## 安装

```javascript
const {
  parseMetadata,
  parseTitle,
  parseDeltaRequirements,
  parseSpecFile,
  updateSpecState,
  scanChangeProposals,
  scanSpecFiles,
  getStatusOverview
} = require('mob-seed/lib/lifecycle/parser');
```

## API

### parseMetadata(content)

解析规格文件的元数据。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 规格文件内容 |

**返回:**

```javascript
{
  state: string,      // 'draft' | 'review' | 'implementing' | 'archived'
  version: string,    // 语义化版本号
  stack: string,      // 技术栈
  emitPath: string    // 派生路径
}
```

**示例:**

```javascript
const metadata = parseMetadata(`
> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: src/core/
`);
// { state: 'draft', version: '1.0.0', stack: 'JavaScript', emitPath: 'src/core/' }
```

### parseTitle(content)

解析规格文件标题。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 规格文件内容 |

**返回:** `string` - 规格标题（去除 `Feature:` 前缀）

**示例:**

```javascript
const title = parseTitle('# Feature: 用户认证模块');
// '用户认证模块'
```

### parseDeltaRequirements(content)

解析 Delta 需求（ADDED/MODIFIED/REMOVED）。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 规格文件内容 |

**返回:**

```javascript
[
  {
    id: string,           // 'REQ-001'
    title: string,        // 需求标题
    type: string,         // 'ADDED' | 'MODIFIED' | 'REMOVED'
    description: string,
    scenarios: [
      {
        name: string,
        when: string[],
        then: string[]
      }
    ],
    acceptance: [
      {
        id: string,       // 'AC-001'
        description: string,
        checked: boolean
      }
    ]
  }
]
```

**示例:**

```javascript
const requirements = parseDeltaRequirements(`
## ADDED Requirements

### REQ-001: 用户登录

The system SHALL authenticate users.

**Scenario: 登录成功**
- WHEN 用户输入正确密码
- THEN 显示欢迎页面

**Acceptance Criteria:**
- [x] AC-001: 支持用户名密码登录
`);
```

### parseSpecFile(filePath)

解析完整的规格文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 规格文件路径 |

**返回:**

```javascript
{
  path: string,
  title: string,
  metadata: object,
  requirements: array
}
```

### updateSpecState(filePath, newState)

更新规格文件的状态。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 规格文件路径 |
| newState | string | 新状态 ('draft' | 'review' | 'implementing' | 'archived') |

**返回:** void

**示例:**

```javascript
await updateSpecState('/specs/auth.fspec.md', 'implementing');
// 更新文件中的状态行
```

### scanSpecFiles(dir)

递归扫描目录中的规格文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| dir | string | 目录路径 |

**返回:** `string[]` - 规格文件相对路径列表

**示例:**

```javascript
const files = await scanSpecFiles('/project/openspec/specs');
// ['core/parser.fspec.md', 'auth/login.fspec.md', ...]
```

### scanChangeProposals(changesDir)

扫描变更提案目录结构。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changesDir | string | 变更目录路径 |

**返回:**

```javascript
[
  {
    name: string,           // 提案名称
    path: string,           // 提案路径
    state: string,          // 提案状态
    specs: string[],        // 包含的规格文件
    hasProposalMd: boolean, // 是否有 proposal.md
    hasTasksMd: boolean     // 是否有 tasks.md
  }
]
```

### getStatusOverview(openspecRoot)

生成所有规格的状态概览。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| openspecRoot | string | OpenSpec 根目录 |

**返回:**

```javascript
{
  archived: [          // 已归档规格
    { name: string, path: string }
  ],
  draft: [...],        // 草稿状态
  review: [...],       // 评审状态
  implementing: [...], // 实现中状态
  summary: {
    total: number,
    byState: object
  }
}
```

## 支持的元数据字段

| 字段 | 中文 | 英文 |
|------|------|------|
| 状态 | 状态 | state |
| 版本 | 版本 | version |
| 技术栈 | 技术栈 | stack |
| 派生路径 | 派生路径 | emitPath, output |

## 规格状态

| 状态 | 说明 |
|------|------|
| draft | 草稿状态，正在编写 |
| review | 评审状态，等待审核 |
| implementing | 实现中，正在开发 |
| archived | 已归档，开发完成 |

## 相关链接

- [规格文件](../../openspec/specs/lifecycle/parser.fspec.md)
- [源代码](../../skills/mob-seed/lib/lifecycle/parser.js)
- [测试](../../skills/mob-seed/test/lifecycle/parser.test.js)
