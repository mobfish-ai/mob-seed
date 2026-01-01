# Scenario Test Mapper (场景测试映射器)

> 从 fspec 场景自动生成测试代码

## 概述

从 fspec 文件中的 WHEN/THEN 场景描述自动生成测试代码骨架，支持多种测试框架。

## 安装

```javascript
const {
  parseScenarios,
  parseScenarioBlock,
  generateTestCode,
  generateTestFile,
  batchGenerate,
  getFrameworkAdapter,
  detectFramework,
  inferAssertion,
  diffScenarios,
  mergeTestFile
} = require('mob-seed/lib/automation/scenario-test-mapper');
```

## API

### parseScenarios(fspecContent)

从 fspec 内容中解析所有场景。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fspecContent | string | fspec 文件内容 |

**返回:**

```javascript
[
  {
    name: string,       // 场景名称
    when: string[],     // WHEN 条件列表
    then: string[]      // THEN 断言列表
  },
  ...
]
```

**示例:**

```javascript
const scenarios = parseScenarios(`
**Scenario: 用户登录成功**
- WHEN 用户输入正确的用户名和密码
- AND 点击登录按钮
- THEN 显示欢迎消息
`);
// [{ name: '用户登录成功', when: [...], then: [...] }]
```

### parseScenarioBlock(block)

解析单个场景块。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| block | string | 场景文本块 |

**返回:** `Scenario` 对象

### generateTestCode(scenario, options)

从场景生成测试代码。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| scenario | Scenario | 解析后的场景对象 |
| options.framework | string | 测试框架 (jest/mocha/node/vitest) |
| options.typescript | boolean | 是否生成 TypeScript |

**返回:** `string` - 测试代码

**示例:**

```javascript
const code = generateTestCode(scenario, { framework: 'jest' });
// describe('用户登录成功', () => {
//   beforeEach(() => {
//     // WHEN: 用户输入正确的用户名和密码
//   });
//   it('should 显示欢迎消息', () => {
//     // TODO: expect(...)
//   });
// });
```

### generateTestFile(scenarios, options)

从多个场景生成完整测试文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| scenarios | Scenario[] | 场景数组 |
| options.framework | string | 测试框架 |
| options.typescript | boolean | 是否 TypeScript |

**返回:** `string` - 完整测试文件内容

### batchGenerate(fspecDir, outputDir, options)

批量从 fspec 目录生成测试文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fspecDir | string | fspec 文件目录 |
| outputDir | string | 测试输出目录 |
| options | object | 生成选项 |

**返回:**

```javascript
{
  generated: string[],  // 生成的文件列表
  skipped: string[],    // 跳过的文件列表
  errors: Error[]       // 错误列表
}
```

### getFrameworkAdapter(framework)

获取特定框架的适配器。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| framework | string | 框架名称 (jest/mocha/node/vitest) |

**返回:** `Adapter` - 框架适配器

### detectFramework(projectDir)

自动检测项目使用的测试框架。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| projectDir | string | 项目目录 |

**返回:** `string` - 检测到的框架名称

### inferAssertion(thenDescription)

从 THEN 描述推断断言类型。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| thenDescription | string | THEN 描述文本 |

**返回:**

```javascript
{
  type: string,       // 断言类型
  template: string    // 断言模板
}
```

**推断规则:**

| THEN 描述模式 | 推断的断言 |
|--------------|-----------|
| 显示/展示 XXX | `expect(...).toBeVisible()` |
| 返回 XXX | `expect(result).toBe(...)` |
| 包含 XXX | `expect(...).toContain(...)` |
| 等于 XXX | `expect(...).toEqual(...)` |
| 跳转到 XXX | `expect(location).toBe(...)` |
| 抛出 XXX 错误 | `expect(...).toThrow(...)` |

### diffScenarios(oldScenarios, newScenarios)

比较新旧场景差异。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| oldScenarios | Scenario[] | 旧场景列表 |
| newScenarios | Scenario[] | 新场景列表 |

**返回:**

```javascript
{
  added: Scenario[],    // 新增的场景
  modified: Scenario[], // 修改的场景
  removed: Scenario[]   // 删除的场景
}
```

### mergeTestFile(existingCode, newScenarios)

合并已存在的测试代码和新场景。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| existingCode | string | 已存在的测试代码 |
| newScenarios | Scenario[] | 新场景列表 |

**返回:** `string` - 合并后的测试代码

## 支持的框架

| 框架 | 配置值 | 文件后缀 |
|------|--------|----------|
| Jest | jest | .test.js |
| Mocha | mocha | .spec.js |
| Node Test Runner | node | .test.js |
| Vitest | vitest | .test.ts |

## 配置项

```json
{
  "scenarioMapper": {
    "framework": "auto",
    "typescript": false,
    "outputDir": "test/",
    "preserveManual": true,
    "inferAssertions": true,
    "todoMarker": "TODO: "
  }
}
```

## 相关链接

- [规格文件](../../openspec/specs/automation/scenario-test-mapper.fspec.md)
- [源代码](../../skills/mob-seed/lib/automation/scenario-test-mapper.js)
- [测试](../../skills/mob-seed/test/automation/scenario-test-mapper.test.js)
