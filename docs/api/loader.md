# Stack Loader (技术栈加载器)

> 运行时技术栈包发现与加载

## 概述

运行时自动扫描 stacks/ 目录，发现并加载所有技术栈包，支持扩展名匹配和派生提示获取。

## 安装

```javascript
const { StackLoader } = require('mob-seed/lib/stacks/loader');
```

## API

### constructor(stacksDir)

创建 StackLoader 实例。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| stacksDir | string | stacks 目录路径 |

**示例:**

```javascript
const loader = new StackLoader('/path/to/stacks');
```

### discover()

扫描并发现所有技术栈包。

**参数:** 无

**返回:**

```javascript
{
  stacks: Map<string, StackPack>,  // 技术栈映射
  skipped: [                        // 跳过的目录
    { dir: string, reason: string }
  ]
}
```

**示例:**

```javascript
const result = await loader.discover();
// { stacks: Map(5), skipped: [] }
```

### get(name)

获取指定技术栈包。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 技术栈名称 |

**返回:** `StackPack | undefined`

**示例:**

```javascript
const tsPack = loader.get('typescript');
// { name: 'typescript', extensions: ['.ts', '.tsx'], ... }
```

### matchByExtension(filename)

根据文件扩展名匹配技术栈。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filename | string | 文件名或扩展名 |

**返回:** `StackPack | undefined`

**示例:**

```javascript
const pack = loader.matchByExtension('.ts');
// TypeScript 技术栈包
const pack2 = loader.matchByExtension('app.tsx');
// TypeScript 技术栈包
```

### parseStackDeclaration(declaration)

解析技术栈声明字符串。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| declaration | string | 声明字符串 |

**返回:** `StackPack[]` - 匹配的技术栈列表

**示例:**

```javascript
const packs = loader.parseStackDeclaration('Vue 3 + TypeScript');
// [vuePack, typescriptPack]

const packs2 = loader.parseStackDeclaration('React, Node.js');
// [reactPack, nodePack]
```

**支持的分隔符:** `+`, `/`, `,`

### getPrompt(stackName, promptType)

获取派生提示模板。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| stackName | string | 技术栈名称 |
| promptType | string | 提示类型 ('code' | 'test' | 'docs') |

**返回:** `Promise<string | null>` - 提示模板内容

**示例:**

```javascript
const prompt = await loader.getPrompt('typescript', 'code');
// 返回 code.prompt.md 文件内容
```

### getTemplate(stackName)

获取规格模板。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| stackName | string | 技术栈名称 |

**返回:** `Promise<string | null>` - 模板内容

**示例:**

```javascript
const template = await loader.getTemplate('typescript');
// 返回 spec.template.md 文件内容
```

### list()

列出所有已加载的技术栈。

**参数:** 无

**返回:** `StackPack[]` - 技术栈列表

### has(name)

检查技术栈是否存在。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 技术栈名称 |

**返回:** `boolean`

### size

获取已加载的技术栈数量。

**返回:** `number`

### names()

获取所有技术栈名称。

**返回:** `string[]`

## StackPack 结构

```javascript
{
  name: string,           // 技术栈名称
  displayName: string,    // 显示名称
  extensions: string[],   // 支持的扩展名 ['.ts', '.tsx']
  runtime: string,        // 运行时 ('node', 'browser', 'both')
  prompts: {
    code: string,         // 代码生成提示文件
    test: string,         // 测试生成提示文件
    docs: string          // 文档生成提示文件
  },
  template: string        // 规格模板文件
}
```

## stack.json 格式

```json
{
  "name": "typescript",
  "displayName": "TypeScript",
  "extensions": [".ts", ".tsx"],
  "runtime": "node",
  "prompts": {
    "code": "prompts/code.prompt.md",
    "test": "prompts/test.prompt.md",
    "docs": "prompts/docs.prompt.md"
  },
  "template": "spec.template.md"
}
```

## 目录结构

```
stacks/
├── typescript/
│   ├── stack.json
│   ├── spec.template.md
│   └── prompts/
│       ├── code.prompt.md
│       └── test.prompt.md
├── javascript/
│   ├── stack.json
│   └── ...
└── python/
    ├── stack.json
    └── ...
```

## 使用示例

```javascript
const { StackLoader } = require('mob-seed/lib/stacks/loader');

// 创建加载器
const loader = new StackLoader('./stacks');

// 发现所有技术栈
await loader.discover();

// 按扩展名匹配
const stack = loader.matchByExtension('.ts');
console.log(stack.name); // 'typescript'

// 解析声明
const stacks = loader.parseStackDeclaration('React + TypeScript');
console.log(stacks.map(s => s.name)); // ['react', 'typescript']

// 获取代码生成提示
const prompt = await loader.getPrompt('typescript', 'code');
```

## 相关链接

- [规格文件](../../openspec/specs/stacks/loader.fspec.md)
- [源代码](../../skills/mob-seed/lib/stacks/loader.js)
- [测试](../../skills/mob-seed/test/stacks/loader.test.js)
