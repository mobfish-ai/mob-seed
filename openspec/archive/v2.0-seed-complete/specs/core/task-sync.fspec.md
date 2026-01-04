---
status: archived
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/sync/
priority: P0
estimated_effort: 2-3天
---
# Feature: Task Sync (任务同步)
## 概述

实现 tasks.md 文件与 Claude Code TodoWrite 工具的双向同步，支持会话崩溃后从文件恢复任务状态。

## ADDED Requirements

### REQ-001: tasks.md 文件格式

The system SHALL define standardized tasks.md format.

**文件格式:**

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

**Scenario: 解析 tasks.md**
- WHEN 读取 tasks.md 文件
- THEN 解析出任务列表、状态、时间戳
- AND 返回结构化的 TaskList 对象

**Acceptance Criteria:**
- [x] AC-001: 支持 Markdown checkbox 格式
- [x] AC-002: 解析 HTML 注释中的元数据
- [x] AC-003: 支持中英文状态标记

### REQ-002: TodoWrite 状态同步

The system SHALL sync tasks.md changes to TodoWrite.

**Scenario: 启动时同步 (File → TodoWrite)**
- WHEN Claude Code 会话启动
- AND tasks.md 存在且有未完成任务
- THEN 读取 tasks.md 并初始化 TodoWrite
- AND 恢复任务的 in_progress/pending 状态

**Scenario: 执行时同步 (TodoWrite → File)**
- WHEN TodoWrite 任务状态变更
- THEN 同步更新 tasks.md 文件
- AND 更新 LAST_SYNC 时间戳

**Acceptance Criteria:**
- [x] AC-004: 启动时自动检测 tasks.md
- [x] AC-005: 状态变更实时同步
- [x] AC-006: 保持任务 ID 对应关系

### REQ-003: 崩溃恢复机制

The system SHALL support crash recovery from tasks.md.

**Scenario: 会话崩溃恢复**
- WHEN 前一会话异常中断
- AND 新会话启动
- THEN 检测到 tasks.md 有未完成任务
- AND 提示用户是否继续
- AND 恢复 TodoWrite 到中断前状态

**恢复流程:**

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

**Acceptance Criteria:**
- [x] AC-007: 检测异常中断（无 completed 标记）
- [x] AC-008: 显示中断前的任务状态
- [x] AC-009: 用户确认后恢复

### REQ-004: 冲突解决

The system SHALL handle sync conflicts.

**Scenario: 文件被外部修改**
- WHEN tasks.md 被外部编辑器修改
- AND Claude Code 尝试同步
- THEN 检测到版本冲突
- AND 提示用户选择：使用文件版本 / 使用内存版本 / 合并

**Scenario: 同时编辑**
- WHEN 用户同时在文件和 TodoWrite 中修改
- THEN 以 TodoWrite 为准（最新操作）
- AND 记录冲突日志

**Acceptance Criteria:**
- [x] AC-010: 基于 LAST_SYNC 检测冲突
- [x] AC-011: 提供三种解决选项
- [x] AC-012: 记录冲突历史

### REQ-005: 任务 ID 管理

The system SHALL maintain task ID mapping.

**Scenario: 新增任务**
- WHEN 通过 TodoWrite 新增任务
- THEN 生成唯一 TASK-XXX ID
- AND 同步到 tasks.md

**Scenario: 任务重排序**
- WHEN 任务顺序变更
- THEN 保持原有 TASK ID 不变
- AND 更新文件中的顺序

**Acceptance Criteria:**
- [x] AC-013: TASK ID 格式: TASK-001, TASK-002, ...
- [x] AC-014: ID 全局唯一（同一 tasks.md 内）
- [x] AC-015: 支持手动指定 ID

### REQ-006: 多文件支持

The system SHALL support multiple tasks.md files.

**Scenario: 项目级 tasks.md**
- WHEN 项目根目录有 `openspec/changes/{proposal}/tasks.md`
- THEN 关联到对应的变更提案
- AND 使用提案名称区分

**Scenario: 功能级 tasks.md**
- WHEN 功能目录有 tasks.md
- THEN 作为子任务管理
- AND 支持嵌套结构

**Acceptance Criteria:**
- [x] AC-016: 自动发现 tasks.md 文件
- [x] AC-017: 支持相对路径引用
- [x] AC-018: 避免循环引用

## 导出接口

```javascript
module.exports = {
  // 文件操作
  parseTasksFile,        // (filePath) => TaskList
  writeTasksFile,        // (filePath, taskList) => void
  findTasksFiles,        // (rootDir) => string[]

  // 同步操作
  syncFromFile,          // (filePath) => void (File → TodoWrite)
  syncToFile,            // (filePath) => void (TodoWrite → File)
  detectConflict,        // (filePath) => ConflictInfo | null

  // 恢复操作
  checkCrashRecovery,    // (filePath) => RecoveryInfo | null
  performRecovery,       // (filePath) => void

  // ID 管理
  generateTaskId,        // (taskList) => string
  mapTaskIds,            // (todoWriteTasks, fileTasks) => IdMapping

  // 工具函数
  formatTaskLine,        // (task) => string
  parseTaskLine,         // (line) => Task
};
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

## 依赖

- `lib/lifecycle/parser.js` - Markdown 解析
- TodoWrite 工具 - Claude Code 内置

## 测试要点

1. 双向同步正确性
2. 崩溃恢复场景
3. 冲突检测和解决
4. 多文件管理
5. 边界情况（空文件、格式错误）
