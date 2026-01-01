# Unified Command API

> Derived from: `skills/mob-seed/lib/workflow/unified-command.js`

## Overview

统一命令入口模块，将多个独立命令整合为统一入口，提供智能状态面板和子命令路由。

## Constants

### SUBCOMMANDS

子命令映射表：

| 子命令 | 说明 |
|--------|------|
| `init` | 初始化 SEED |
| `spec` | 规格操作 |
| `emit` | 派生产物 |
| `exec` | 执行测试 |
| `defend` | 守护检查 |
| `archive` | 归档提案 |

### GLOBAL_OPTIONS

全局选项定义：

| 选项 | 短选项 | 说明 |
|------|--------|------|
| `--quick` | `-q` | 快速检查（秒级） |
| `--fix` | `-f` | 自动修复可修复问题 |
| `--auto` | `-a` | 自动执行所有建议 |
| `--ci` | - | CI 模式（严格检查） |
| `--strict` | - | 严格模式（警告算失败） |

## Functions

### loadSeedConfig(projectPath)

加载 SEED 配置文件。

**Parameters:**
- `projectPath` (string): 项目路径，默认 `'.'`

**Returns:** `Object|null` - 配置对象或 null

### isOpenSpecMode(projectPath)

检查是否为 OpenSpec 模式。

**Parameters:**
- `projectPath` (string): 项目路径，默认 `'.'`

**Returns:** `boolean`

### routeSubcommand(subcommand, args, options)

路由子命令到对应的命令处理器。

**Parameters:**
- `subcommand` (string): 子命令名称
- `args` (string[]): 参数列表
- `options` (Object): 选项对象

**Returns:** `Promise<CommandResult>`

```javascript
// CommandResult 结构
{
  success: boolean,
  subcommand?: string,
  args?: string[],
  options?: Object,
  commandPath?: string,
  error?: string,
  suggestion?: string
}
```

### executeSmartEntry(args, options)

执行智能入口（无子命令时的默认行为）。

**Parameters:**
- `args` (string[]): 参数列表
- `options` (Object): 选项对象

**Returns:** `Promise<EntryResult>`

### formatStatusPanel(status)

格式化状态面板输出。

**Parameters:**
- `status` (Object): 状态对象
  - `projectName` (string): 项目名称
  - `specCount` (number): 规格数量
  - `syncStatus` (string): 同步状态
  - `issues` (Issue[]): 问题列表

**Returns:** `string` - 格式化的状态面板

## Usage

```javascript
const { routeSubcommand, executeSmartEntry } = require('./unified-command');

// 路由子命令
const result = await routeSubcommand('spec', ['create', 'feature-x']);

// 智能入口
const status = await executeSmartEntry([], { quick: true });
```

## Related

- Spec: `openspec/specs/workflow/unified-command.fspec.md`
- Test: `test/workflow/unified-command.test.js`
