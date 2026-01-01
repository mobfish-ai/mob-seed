# Progress Panel API

> Derived from: `skills/mob-seed/lib/ux/progress-panel.js`

## Overview

进度面板模块，提供进度条和状态面板渲染功能。

## Functions

### createProgressBar(label, total)

创建进度条对象。

**Parameters:**
- `label` (string): 标签
- `total` (number): 总数

**Returns:** `ProgressBar` - 进度条对象

```javascript
// ProgressBar 接口
{
  label: string,
  total: number,
  current: number,
  percent: number,
  update(current: number): void,
  increment(amount?: number): void,
  render(options?: { width?: number }): string
}
```

**Example:**
```javascript
const bar = createProgressBar('测试进度', 10);
bar.update(5);
console.log(bar.render());
// 测试进度: ██████████░░░░░░░░░░ 5/10 (50%)
```

### renderProgressBar(percent, options)

渲染 ASCII 进度条。

**Parameters:**
- `percent` (number): 百分比 (0-100)
- `options` (Object): 选项
  - `width` (number): 进度条宽度，默认 20

**Returns:** `string` - 进度条字符串

**Example:**
```javascript
renderProgressBar(75, { width: 10 });
// ████████░░
```

### renderPanel(data)

渲染状态面板。

**Parameters:**
- `data` (Object): 面板数据
  - `title` (string): 标题
  - `status` (string): 状态（可选）
  - `items` (Array): 项目列表

**Returns:** `string` - 格式化的面板

**Example:**
```javascript
const panel = renderPanel({
  title: 'SEED 状态',
  status: '同步中',
  items: [
    { label: '规格', current: 5, total: 5, status: '✅' },
    { label: '测试', current: 3, total: 5, status: '⏳' }
  ]
});
// ┌──────────────────────────────────────────────────┐
// │ SEED 状态                              同步中    │
// ├──────────────────────────────────────────────────┤
// │ 规格: ████████████████████ 5/5 (100%) ✅        │
// │ 测试: ████████████░░░░░░░░ 3/5 (60%)  ⏳        │
// └──────────────────────────────────────────────────┘
```

### formatStatusPanel(status)

格式化 SEED 状态面板。

**Parameters:**
- `status` (Object): SEED 状态对象

**Returns:** `string`

## Usage

```javascript
const { createProgressBar, renderPanel, renderProgressBar } = require('./progress-panel');

// 创建进度条
const bar = createProgressBar('下载', 100);
bar.update(50);

// 渲染面板
const panel = renderPanel({
  title: '构建状态',
  items: [...]
});
```

## Related

- Spec: `openspec/specs/ux/interactive-mode.fspec.md`
- Test: `test/ux/progress-panel.test.js`
