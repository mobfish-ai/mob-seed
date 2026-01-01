# Stack Resolver (技术栈解析器)

> 项目技术栈解析与路径映射

## 概述

项目技术栈解析器，根据项目配置和路径映射解析目标技术栈。支持：
- 路径映射（最长匹配）
- 文件扩展名匹配
- 规格文件声明解析
- 默认技术栈回退

## 安装

```javascript
const {
  StackResolver,
  parseSpecStackDeclaration,
  parseSpecOutputPath
} = require('mob-seed/lib/stacks/resolver');
```

## API

### StackResolver

项目技术栈解析器类。

#### constructor(loader, config)

创建解析器实例。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| loader | StackLoader | 技术栈加载器 |
| config | ProjectStackConfig | 项目技术栈配置 |

**示例:**

```javascript
const resolver = new StackResolver(loader, {
  default: 'javascript',
  stacks: {
    'src/frontend/': 'typescript-react',
    'src/backend/': 'javascript'
  }
});
```

#### resolveForSpec(specPath)

根据规格文件路径解析目标技术栈。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| specPath | string | 规格文件路径 |

**返回:** `StackPack | undefined`

**示例:**

```javascript
const stack = resolver.resolveForSpec('specs/auth/login.fspec.md');
// StackPack { name: 'javascript', ... }
```

#### resolveForOutput(outputPath)

根据输出路径解析目标技术栈。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| outputPath | string | 输出文件路径 |

**返回:** `StackPack | undefined`

**示例:**

```javascript
const stack = resolver.resolveForOutput('src/frontend/components/Button.tsx');
// StackPack { name: 'typescript-react', ... }
```

#### getProjectStacks()

获取项目所有使用的技术栈。

**返回:** `StackPack[]`

**示例:**

```javascript
const stacks = resolver.getProjectStacks();
// [StackPack { name: 'javascript' }, StackPack { name: 'typescript-react' }]
```

#### getStackForPath(path)

获取指定路径的技术栈配置。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| path | string | 文件路径 |

**返回:** `StackPack | undefined`

#### getStackMappings()

获取所有路径映射。

**返回:** `Record<string, string>`

**示例:**

```javascript
const mappings = resolver.getStackMappings();
// { 'src/frontend/': 'typescript-react', 'src/backend/': 'javascript' }
```

#### hasExplicitMapping(path)

检查路径是否有明确的技术栈映射。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| path | string | 文件路径 |

**返回:** `boolean`

**示例:**

```javascript
resolver.hasExplicitMapping('src/frontend/App.tsx');  // true
resolver.hasExplicitMapping('docs/readme.md');        // false
```

### parseSpecStackDeclaration(specContent)

从规格文件内容解析技术栈声明。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| specContent | string | 规格文件内容 |

**返回:** `string | null`

**支持的格式:**
- `> 技术栈: JavaScript`
- `> Tech Stack: TypeScript`
- `> 模板: react-component`

**示例:**

```javascript
const stack = parseSpecStackDeclaration(`
# Feature: 用户登录

> 状态: draft
> 技术栈: TypeScript
`);
// 'TypeScript'
```

### parseSpecOutputPath(specContent)

从规格文件内容解析派生路径。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| specContent | string | 规格文件内容 |

**返回:** `string | null`

**支持的格式:**
- `> 派生路径: src/auth/`
- `> Output Path: lib/core/`

**示例:**

```javascript
const outputPath = parseSpecOutputPath(`
# Feature: 用户登录

> 派生路径: src/auth/
`);
// 'src/auth/'
```

## 配置示例

`.seed/config.json` 中的技术栈配置：

```json
{
  "stacks": {
    "default": "javascript",
    "stacks": {
      "src/frontend/": "typescript-react",
      "src/backend/": "javascript",
      "src/cli/": "javascript",
      "scripts/": "javascript"
    }
  }
}
```

## 路径匹配规则

1. **最长匹配优先**: 对于 `src/frontend/components/Button.tsx`，优先匹配 `src/frontend/` 而非 `src/`
2. **扩展名回退**: 若无路径匹配，按文件扩展名匹配
3. **默认回退**: 若仍无匹配，使用默认技术栈

## 相关模块

- [loader](./loader.md) - 技术栈加载器
- [types](./types.md) - 类型定义
