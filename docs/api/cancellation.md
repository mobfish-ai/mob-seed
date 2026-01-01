# Task Cancellation (任务取消)

> 安全的任务取消与状态回滚

## 概述

支持开发过程中的任务取消和状态回滚，确保取消操作不会导致数据不一致或丢失已完成的工作。

## 安装

```javascript
const {
  requestCancel,
  registerCancelHandler,
  markSafePoint,
  isAtSafePoint,
  waitForSafePoint,
  saveState,
  generateCancelReport,
  cleanup,
  terminateSubprocesses,
  releaseLocks,
  canResume,
  resume,
  getResumeOptions,
  logCancellation,
  getCancellationHistory
} = require('mob-seed/lib/ops/cancellation');
```

## API

### requestCancel(flowId, reason)

请求取消任务。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| reason | string | 取消原因 |

**返回:** void

**示例:**

```javascript
requestCancel('flow-20250101-143000', '用户主动取消');
```

### registerCancelHandler(handler)

注册取消处理器。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| handler | function | 取消处理回调函数 |

**返回:** void

### markSafePoint(flowId)

标记当前位置为安全取消点。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** void

### isAtSafePoint(flowId)

检查是否处于安全取消点。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `boolean`

### waitForSafePoint(flowId, timeout)

等待到达安全取消点。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| timeout | number | 超时时间（毫秒） |

**返回:** `Promise<boolean>` - 是否成功等到安全点

### saveState(flowId)

保存当前状态快照。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:**

```javascript
{
  timestamp: Date,
  stage: string,
  completedTasks: string[],
  inProgressTask: string | null,
  flowState: object
}
```

### generateCancelReport(flowId, snapshot)

生成取消报告。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| snapshot | StateSnapshot | 状态快照 |

**返回:** `string` - Markdown 格式的取消报告

### cleanup(flowId)

清理资源。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:**

```javascript
{
  tempFilesDeleted: number,
  locksReleased: number,
  processesTerminated: number
}
```

### terminateSubprocesses(flowId)

终止子进程。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** void

### releaseLocks(flowId)

释放锁资源。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** void

### canResume(flowId)

检查是否可以恢复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `boolean`

### resume(flowId, options)

恢复已取消的任务。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |
| options.mode | string | 恢复模式 ('continue' | 'restart' | 'from-stage') |
| options.stage | string | 起始阶段（当 mode='from-stage' 时） |

**返回:** void

### getResumeOptions(flowId)

获取可用的恢复选项。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:**

```javascript
[
  { mode: 'continue', description: '从取消点继续' },
  { mode: 'restart', description: '从头开始，保留配置' },
  { mode: 'from-stage', stages: ['design', 'implement', ...] }
]
```

### logCancellation(cancelEvent)

记录取消事件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| cancelEvent | object | 取消事件详情 |

**返回:** void

### getCancellationHistory(flowId?)

获取取消历史。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 可选，工作流 ID |

**返回:** `CancelEvent[]` - 取消事件列表

## 取消触发方式

| 方式 | 触发条件 | 处理方式 |
|------|----------|----------|
| 用户主动 | Ctrl+C 或命令取消 | 正常取消流程 |
| 超时 | 超过配置的时间限制 | 超时取消流程 |
| 错误累积 | 连续错误超过阈值 | 自动取消 |
| 外部中断 | 系统信号 (SIGTERM) | 优雅关闭 |

## 安全取消点

| 阶段 | 取消点 | 安全性 |
|------|--------|--------|
| 分析 | 任何时候 | 安全 |
| 设计 | 任何时候 | 安全 |
| 实现 | 文件写入完成后 | 需检查 |
| 测试 | 测试用例完成后 | 安全 |
| 验证 | 验证命令完成后 | 安全 |

## 配置项

```json
{
  "cancellation": {
    "safePointTimeout": 30,
    "keepPartialWork": true,
    "autoCleanTemp": true,
    "logFile": ".seed/cancellation.log",
    "maxLogSize": "10MB",
    "gracefulShutdownTimeout": 5
  }
}
```

## 恢复交互示例

```
📋 检测到未完成的任务
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

流程 ID: flow-20250101-143000
取消时间: 2025-01-01 14:30:00
取消阶段: 实现 (3/5)
已完成: 5/12 任务

选择操作:
[C] 继续 - 从取消点继续
[R] 重新开始 - 保留配置，重新执行
[S] 从阶段开始 - 选择开始阶段
[D] 放弃 - 清理状态，不恢复

请选择: [C/R/S/D]
```

## 相关链接

- [规格文件](../../openspec/specs/ops/cancellation.fspec.md)
- [源代码](../../skills/mob-seed/lib/ops/cancellation.js)
- [测试](../../skills/mob-seed/test/ops/cancellation.test.js)
