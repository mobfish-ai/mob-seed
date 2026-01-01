# Interactive Prompt API

> Derived from: `skills/mob-seed/lib/ux/interactive-prompt.js`

## Overview

交互式提示模块，提供用户交互界面，包括确认流程、菜单选择、上下文感知和错误恢复。

## Functions

### formatConfirmMessage(message, options)

格式化确认消息。

**Parameters:**
- `message` (string): 确认信息
- `options` (Object): 选项
  - `danger` (boolean): 是否为危险操作

**Returns:** `string` - 格式化的确认消息

**Example:**
```javascript
const msg = formatConfirmMessage('删除所有文件？', { danger: true });
// ⚠️  警告
//
// 删除所有文件？
//
// [Y] 确认 / [N] 取消
```

### formatMenu(title, options, menuOptions)

格式化选项菜单。

**Parameters:**
- `title` (string): 标题
- `options` (Array<{label: string, action: string}>): 选项列表
- `menuOptions` (Object): 菜单选项
  - `allowBatch` (boolean): 是否允许批量选择

**Returns:** `string` - 格式化的菜单

**Example:**
```javascript
const menu = formatMenu('选择操作:', [
  { label: '派生代码', action: 'emit' },
  { label: '运行测试', action: 'exec' }
]);
// 选择操作:
//
//   [1] 派生代码
//   [2] 运行测试
//
//   [a] 全部执行
//   [n] 跳过
//   [q] 退出
//
// >
```

### formatMenuForCI(title, options)

格式化 CI 模式菜单（非交互式）。

**Parameters:**
- `title` (string): 标题
- `options` (Array): 选项列表

**Returns:** `string` - CI 友好的输出

### saveCheckpoint(operation, state)

保存恢复点。

**Parameters:**
- `operation` (string): 操作名称
- `state` (Object): 状态数据

### loadCheckpoint()

加载恢复点。

**Returns:** `Checkpoint|null`

### clearCheckpoint()

清除恢复点。

### detectContext(projectStatus)

检测项目上下文并推荐操作。

**Parameters:**
- `projectStatus` (Object): 项目状态

**Returns:** `Recommendation`

```javascript
// Recommendation 结构
{
  type: 'new_spec' | 'spec_modified' | 'tests_passed' | 'ready_release',
  message: string,
  suggestedAction: string
}
```

## Usage

```javascript
const { formatMenu, formatConfirmMessage, detectContext } = require('./interactive-prompt');

// 显示确认对话框
console.log(formatConfirmMessage('确认执行？'));

// 显示菜单
console.log(formatMenu('选择操作:', options));

// 检测上下文
const recommendation = detectContext(projectStatus);
```

## Related

- Spec: `openspec/specs/ux/interactive-mode.fspec.md`
- Test: `test/ux/interactive-prompt.test.js`
