# State Evolution API

> Derived from: `skills/mob-seed/lib/workflow/state-evolution.js`

## Overview

状态自动进化器，实现 AC 测试通过后自动更新状态、进度可视化面板等功能。

## Constants

### STATE_TRANSITIONS

状态转换规则：

| 当前状态 | 可转换到 |
|----------|----------|
| `draft` | `review` |
| `review` | `implementing`, `draft` |
| `implementing` | `archived`, `review` |
| `archived` | `draft` (需要 reopen) |

## Functions

### parseTestResults(testOutput)

解析测试输出，提取 AC 结果。

**Parameters:**
- `testOutput` (string): 测试输出文本

**Returns:** `Array<{acId: string, passed: boolean, description: string}>`

**Example:**
```javascript
const output = `
✔ AC-001: 用户登录成功
✖ AC-002: 密码验证失败
`;

const results = parseTestResults(output);
// [
//   { acId: 'AC-001', passed: true, description: '用户登录成功' },
//   { acId: 'AC-002', passed: false, description: '密码验证失败' }
// ]
```

### updateACStatus(specPath, results)

更新规格文件中的 AC 状态。

**Parameters:**
- `specPath` (string): 规格文件路径
- `results` (Array): 测试结果数组

**Returns:** `Promise<{success: boolean, updated: number, error?: string}>`

### canTransition(currentState, targetState)

检查状态转换是否有效。

**Parameters:**
- `currentState` (string): 当前状态
- `targetState` (string): 目标状态

**Returns:** `boolean`

### evolveState(specPath, testOutput, options)

基于测试结果自动进化规格状态。

**Parameters:**
- `specPath` (string): 规格文件路径
- `testOutput` (string): 测试输出
- `options` (Object): 选项
  - `autoTransition` (boolean): 是否自动转换状态

**Returns:** `Promise<EvolutionResult>`

```javascript
// EvolutionResult 结构
{
  success: boolean,
  updatedACs: string[],
  newState?: string,
  stateChanged: boolean,
  summary: string
}
```

## Usage

```javascript
const { parseTestResults, updateACStatus, evolveState } = require('./state-evolution');

// 解析测试结果
const results = parseTestResults(testOutput);

// 更新 AC 状态
await updateACStatus('spec.fspec.md', results);

// 自动进化状态
const evolution = await evolveState('spec.fspec.md', testOutput, { autoTransition: true });
```

## Related

- Spec: `openspec/specs/workflow/state-evolution.fspec.md`
- Test: `test/workflow/state-evolution.test.js`
