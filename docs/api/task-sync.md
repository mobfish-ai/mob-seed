# Task Sync (任务同步)

> tasks.md 与 TodoWrite 双向同步

## 概述

实现 tasks.md 文件与 Claude Code TodoWrite 工具的双向同步，支持会话崩溃后从文件恢复任务状态。

## 安装

```javascript
const {
  parseTasksFile,
  writeTasksFile,
  findTasksFiles,
  syncFromFile,
  syncToFile,
  detectConflict,
  checkCrashRecovery,
  performRecovery,
  generateTaskId,
  mapTaskIds,
  formatTaskLine,
  parseTaskLine
} = require('mob-seed/lib/sync/task-sync');
```

## API

### parseTasksFile(filePath)

解析 tasks.md 文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | tasks.md 文件路径 |

**返回:**

```javascript
{
  title: string,
  status: string,           // 'in_progress' | 'completed'
  createdAt: Date,
  lastUpdated: Date,
  tasks: [
    {
      id: string,           // 'TASK-001'
      content: string,
      status: string,       // 'completed' | 'in_progress' | 'pending'
      completedAt: Date | null
    }
  ],
  notes: string[]
}
```

**示例:**

```javascript
const taskList = await parseTasksFile('/project/tasks.md');
// { title: '功能开发', tasks: [...], ... }
```

### writeTasksFile(filePath, taskList)

写入 tasks.md 文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 文件路径 |
| taskList | TaskList | 任务列表对象 |

**返回:** void

### findTasksFiles(rootDir)

查找项目中的所有 tasks.md 文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| rootDir | string | 项目根目录 |

**返回:** `string[]` - 文件路径列表

### syncFromFile(filePath)

从文件同步到 TodoWrite (File → TodoWrite)。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | tasks.md 文件路径 |

**返回:** void

**示例:**

```javascript
// 会话启动时恢复任务状态
await syncFromFile('/project/openspec/changes/feature/tasks.md');
```

### syncToFile(filePath)

从 TodoWrite 同步到文件 (TodoWrite → File)。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | tasks.md 文件路径 |

**返回:** void

### detectConflict(filePath)

检测文件与内存状态的冲突。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 文件路径 |

**返回:**

```javascript
{
  hasConflict: boolean,
  fileVersion: Date,
  memoryVersion: Date,
  conflictDetails: string[]
} | null
```

### checkCrashRecovery(filePath)

检查是否需要崩溃恢复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 文件路径 |

**返回:**

```javascript
{
  needsRecovery: boolean,
  lastSync: Date,
  pendingTasks: number,
  inProgressTask: string | null
} | null
```

### performRecovery(filePath)

执行崩溃恢复。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 文件路径 |

**返回:** void

### generateTaskId(taskList)

生成唯一任务 ID。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| taskList | TaskList | 当前任务列表 |

**返回:** `string` - 新的任务 ID (如 'TASK-004')

### mapTaskIds(todoWriteTasks, fileTasks)

映射 TodoWrite 任务与文件任务的 ID。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| todoWriteTasks | Task[] | TodoWrite 任务列表 |
| fileTasks | Task[] | 文件任务列表 |

**返回:**

```javascript
{
  matched: Map<string, string>,   // TodoWrite ID -> File ID
  unmatched: string[]             // 未匹配的任务 ID
}
```

### formatTaskLine(task)

格式化任务为 Markdown 行。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| task | Task | 任务对象 |

**返回:** `string` - Markdown 格式的任务行

**示例:**

```javascript
const line = formatTaskLine({ id: 'TASK-001', content: '需求分析', status: 'completed' });
// '- [x] TASK-001: 需求分析 <!-- completed:2025-01-01T10:30 -->'
```

### parseTaskLine(line)

解析 Markdown 任务行。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| line | string | Markdown 任务行 |

**返回:** `Task` - 任务对象

## tasks.md 文件格式

```markdown
# Tasks: {功能名称}

> 状态: in_progress
> 创建时间: 2025-01-01 10:00
> 最后更新: 2025-01-01 14:30

## 任务列表

- [x] TASK-001: 需求分析 <!-- completed:2025-01-01T10:30 -->
- [ ] TASK-002: 代码实现 <!-- in_progress:2025-01-01T11:00 -->
- [ ] TASK-003: 测试验证 <!-- pending -->

## 进度备注

### 2025-01-01 14:30
- 完成需求分析
- 开始代码实现

## CC 解析标记

<!-- CC_SYNC_ANCHOR: 用于 Claude Code 解析的锚点 -->
<!-- LAST_SYNC: 2025-01-01T14:30:00+08:00 -->
```

## 配置项

```json
{
  "taskSync": {
    "autoSync": true,
    "syncInterval": 5000,
    "conflictStrategy": "ask",
    "recoveryPrompt": true,
    "taskIdPrefix": "TASK",
    "dateFormat": "YYYY-MM-DD HH:mm"
  }
}
```

## 恢复流程

```
新会话启动
    │
    ▼
检查 tasks.md
    │
    ├── 无文件 → 正常启动
    │
    └── 有文件 → 检查 LAST_SYNC
                    │
                    ├── 正常结束 → 询问是否继续
                    │
                    └── 异常中断 → 自动恢复提示
                            │
                            ▼
                        恢复 TodoWrite
```

## 相关链接

- [规格文件](../../openspec/specs/core/task-sync.fspec.md)
- [源代码](../../skills/mob-seed/lib/sync/task-sync.js)
- [测试](../../skills/mob-seed/test/sync/task-sync.test.js)
