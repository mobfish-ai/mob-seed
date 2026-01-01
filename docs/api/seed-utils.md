# SEED Utils (SEED 工具函数库)

> 提供 SEED 命令所需的核心工具函数

## 概述

提供 SEED 命令所需的核心工具函数，包括配置管理、项目扫描、状态检查和同步支持。

## 安装

```javascript
const {
  loadConfig,
  saveConfig,
  isInitialized,
  scanProjectStructure,
  initProject,
  scanSpecs,
  getSpecStatus,
  getProjectStatus,
  diffSpec,
  generateCodeSkeleton,
  generateTestSkeleton
} = require('mob-seed/adapters/seed-utils');
```

## API

### loadConfig(projectPath)

加载 SEED 项目配置。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
{
  // 合并了默认配置的完整配置对象
  ...config
}
```

**示例:**

```javascript
const config = await loadConfig('/path/to/project');
// { specsDir: 'openspec/specs', ... }
```

### saveConfig(projectPath, config)

保存 SEED 项目配置。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |
| config | object | 配置对象 |

**返回:** void

**示例:**

```javascript
await saveConfig('/path/to/project', { specsDir: 'specs' });
// 创建 .seed/ 目录并写入 config.json
```

### isInitialized(projectPath)

检查 SEED 结构是否已初始化。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |

**返回:** `boolean` - .seed/config.json 是否存在

**示例:**

```javascript
const initialized = await isInitialized('/path/to/project');
// true 或 false
```

### scanProjectStructure(projectPath)

智能扫描项目结构。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
{
  specs: string,   // 检测到的 specs 目录
  src: string,     // 检测到的 src 目录
  test: string,    // 检测到的 test 目录
  docs: string,    // 检测到的 docs 目录
  type: string     // 项目类型 (node, typescript, go, python)
}
```

**示例:**

```javascript
const structure = await scanProjectStructure('/path/to/project');
// { specs: 'openspec/specs', src: 'src', test: 'test', type: 'node' }
```

### initProject(projectPath, options)

初始化 SEED 项目结构。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |
| options.force | boolean | 强制重新初始化 |
| options.manual | boolean | 跳过自动扫描 |
| options.customPaths | object | 自定义路径 |

**返回:** 初始化结果

**示例:**

```javascript
await initProject('/path/to/project', { force: true });
// 创建 .seed/config.json 和 output 目录
```

### scanSpecs(projectPath)

扫描项目中的规格文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
[
  { name: string, path: string, filename: string },
  ...
]
```

**示例:**

```javascript
const specs = await scanSpecs('/path/to/project');
// [{ name: 'parser', path: 'openspec/specs/parser.fspec.md', filename: 'parser.fspec.md' }]
```

### getSpecStatus(specPath, projectPath)

检查单个规格的状态。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| specPath | string | 规格文件路径 |
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
{
  manifest: boolean,  // seed-manifest.json 是否存在
  code: boolean,      // 代码文件是否存在
  test: boolean,      // 测试文件是否存在
  docs: boolean,      // 文档是否存在
  synced: boolean     // 是否同步
}
```

### getProjectStatus(projectPath)

获取整个项目的状态。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
{
  initialized: boolean,
  config: object,
  specs: array,
  summary: {
    total: number,
    emitted: number,
    synced: number
  }
}
```

### diffSpec(specPath, projectPath)

检测规格与代码之间的差异。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| specPath | string | 规格文件路径 |
| projectPath | string | 项目根目录路径 |

**返回:**

```javascript
{
  frs: {            // 功能需求状态
    implemented: string[],
    missing: string[]
  },
  acs: {            // 验收标准状态
    covered: string[],
    missing: string[]
  },
  syncRate: number  // 同步率 (0-100)
}
```

### generateCodeSkeleton(frId, description)

为功能需求生成代码骨架。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| frId | string | 功能需求 ID (如 FR-001) |
| description | string | 需求描述 |

**返回:** `string` - 代码骨架字符串

**示例:**

```javascript
const skeleton = generateCodeSkeleton('FR-001', '解析配置文件');
// /**
//  * @see FR-001: 解析配置文件
//  * TODO: Implement this function
//  */
// function parseConfig() {
//   throw new Error('Not implemented');
// }
```

### generateTestSkeleton(acId, title)

为验收标准生成测试骨架。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| acId | string | 验收标准 ID (如 AC-001) |
| title | string | 测试标题 |

**返回:** `string` - 测试骨架字符串

**示例:**

```javascript
const skeleton = generateTestSkeleton('AC-001', '配置文件解析正确');
// describe('AC-001: 配置文件解析正确', () => {
//   it('should ...', () => {
//     // Given: ...
//     // When: ...
//     // Then: ...
//   });
// });
```

## 常量

| 常量 | 值 | 说明 |
|------|-----|------|
| SEED_DIR | `.seed` | SEED 配置目录 |
| CONFIG_FILE | `config.json` | 配置文件名 |
| Status | enum | 状态枚举 |
| DETECT_PATTERNS | object | 目录检测模式 |

## 相关链接

- [规格文件](../../openspec/specs/adapters/seed-utils.fspec.md)
- [源代码](../../skills/mob-seed/adapters/seed-utils.js)
- [测试](../../skills/mob-seed/test/adapters/seed-utils.test.js)
