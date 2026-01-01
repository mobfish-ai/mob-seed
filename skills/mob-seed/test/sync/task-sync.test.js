/**
 * task-sync 测试
 * @see openspec/changes/v2.0-seed-complete/specs/core/task-sync.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  parseTasksFile,
  writeTasksFile,
  findTasksFiles,
  detectConflict,
  checkCrashRecovery,
  generateTaskId,
  mapTaskIds,
  formatTaskLine,
  parseTaskLine,
  TASK_ID_PREFIX,
  SYNC_ANCHOR
} = require('../../lib/sync/task-sync.js');

describe('task-sync', () => {
  const testDir = '/tmp/task-sync-test';

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('constants', () => {
    it('should have TASK_ID_PREFIX defined', () => {
      assert.strictEqual(TASK_ID_PREFIX, 'TASK');
    });

    it('should have SYNC_ANCHOR defined', () => {
      assert.ok(SYNC_ANCHOR.includes('CC_SYNC_ANCHOR'));
    });
  });

  // =============================================================
  // REQ-001: tasks.md 文件格式
  // =============================================================

  describe('parseTaskLine', () => {
    it('should parse completed task', () => {
      const line = '- [x] TASK-001: 需求分析 <!-- completed:2025-01-01T10:30 -->';
      const task = parseTaskLine(line);

      assert.strictEqual(task.id, 'TASK-001');
      assert.strictEqual(task.content, '需求分析');
      assert.strictEqual(task.status, 'completed');
    });

    it('should parse in_progress task', () => {
      const line = '- [ ] TASK-002: 代码实现 <!-- in_progress:2025-01-01T11:00 -->';
      const task = parseTaskLine(line);

      assert.strictEqual(task.id, 'TASK-002');
      assert.strictEqual(task.content, '代码实现');
      assert.strictEqual(task.status, 'in_progress');
    });

    it('should parse pending task', () => {
      const line = '- [ ] TASK-003: 测试验证 <!-- pending -->';
      const task = parseTaskLine(line);

      assert.strictEqual(task.id, 'TASK-003');
      assert.strictEqual(task.content, '测试验证');
      assert.strictEqual(task.status, 'pending');
    });

    it('should parse task without metadata', () => {
      const line = '- [ ] TASK-004: 简单任务';
      const task = parseTaskLine(line);

      assert.strictEqual(task.id, 'TASK-004');
      assert.strictEqual(task.content, '简单任务');
      assert.strictEqual(task.status, 'pending');
    });

    it('should return null for non-task line', () => {
      const line = '这不是任务行';
      const task = parseTaskLine(line);
      assert.strictEqual(task, null);
    });
  });

  describe('formatTaskLine', () => {
    it('should format completed task', () => {
      const task = {
        id: 'TASK-001',
        content: '需求分析',
        status: 'completed',
        timestamp: '2025-01-01T10:30:00+08:00'
      };
      const line = formatTaskLine(task);

      assert.ok(line.includes('[x]'));
      assert.ok(line.includes('TASK-001'));
      assert.ok(line.includes('需求分析'));
      assert.ok(line.includes('completed'));
    });

    it('should format in_progress task', () => {
      const task = {
        id: 'TASK-002',
        content: '代码实现',
        status: 'in_progress'
      };
      const line = formatTaskLine(task);

      assert.ok(line.includes('[ ]'));
      assert.ok(line.includes('TASK-002'));
      assert.ok(line.includes('in_progress'));
    });

    it('should format pending task', () => {
      const task = {
        id: 'TASK-003',
        content: '测试验证',
        status: 'pending'
      };
      const line = formatTaskLine(task);

      assert.ok(line.includes('[ ]'));
      assert.ok(line.includes('pending'));
    });
  });

  describe('parseTasksFile', () => {
    it('should parse valid tasks.md', () => {
      const content = `# Tasks: Test Feature

> 状态: in_progress
> 创建时间: 2025-01-01 10:00
> 最后更新: 2025-01-01 14:30

## 任务列表

- [x] TASK-001: 需求分析 <!-- completed:2025-01-01T10:30 -->
- [ ] TASK-002: 代码实现 <!-- in_progress:2025-01-01T11:00 -->
- [ ] TASK-003: 测试验证 <!-- pending -->

${SYNC_ANCHOR}
<!-- LAST_SYNC: 2025-01-01T14:30:00+08:00 -->
`;
      const filePath = path.join(testDir, 'tasks.md');
      fs.writeFileSync(filePath, content);

      const result = parseTasksFile(filePath);

      assert.strictEqual(result.title, 'Test Feature');
      assert.strictEqual(result.status, 'in_progress');
      assert.strictEqual(result.tasks.length, 3);
      assert.strictEqual(result.tasks[0].status, 'completed');
      assert.strictEqual(result.tasks[1].status, 'in_progress');
    });

    it('should return empty task list for missing file', () => {
      const result = parseTasksFile(path.join(testDir, 'nonexistent.md'));
      assert.strictEqual(result.tasks.length, 0);
    });
  });

  describe('writeTasksFile', () => {
    it('should write tasks.md file', () => {
      const filePath = path.join(testDir, 'write-test.md');
      const taskList = {
        title: 'Write Test',
        status: 'in_progress',
        tasks: [
          { id: 'TASK-001', content: '第一个任务', status: 'completed' },
          { id: 'TASK-002', content: '第二个任务', status: 'in_progress' }
        ]
      };

      writeTasksFile(filePath, taskList);

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('# Tasks: Write Test'));
      assert.ok(content.includes('[x] TASK-001'));
      assert.ok(content.includes('[ ] TASK-002'));
      assert.ok(content.includes(SYNC_ANCHOR));
    });

    it('should update LAST_SYNC timestamp', () => {
      const filePath = path.join(testDir, 'timestamp-test.md');
      const taskList = {
        title: 'Timestamp Test',
        status: 'in_progress',
        tasks: []
      };

      writeTasksFile(filePath, taskList);

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('LAST_SYNC:'));
    });
  });

  // =============================================================
  // REQ-005: 任务 ID 管理
  // =============================================================

  describe('generateTaskId', () => {
    it('should generate TASK-001 for empty list', () => {
      const id = generateTaskId({ tasks: [] });
      assert.strictEqual(id, 'TASK-001');
    });

    it('should generate next sequential ID', () => {
      const taskList = {
        tasks: [
          { id: 'TASK-001' },
          { id: 'TASK-003' }
        ]
      };
      const id = generateTaskId(taskList);
      assert.strictEqual(id, 'TASK-004');
    });

    it('should handle gaps in ID sequence', () => {
      const taskList = {
        tasks: [
          { id: 'TASK-001' },
          { id: 'TASK-005' }
        ]
      };
      const id = generateTaskId(taskList);
      assert.strictEqual(id, 'TASK-006');
    });
  });

  describe('mapTaskIds', () => {
    it('should map matching tasks by content', () => {
      const todoWriteTasks = [
        { content: '需求分析', status: 'completed' },
        { content: '代码实现', status: 'in_progress' }
      ];
      const fileTasks = [
        { id: 'TASK-001', content: '需求分析', status: 'completed' },
        { id: 'TASK-002', content: '代码实现', status: 'pending' }
      ];

      const mapping = mapTaskIds(todoWriteTasks, fileTasks);

      assert.strictEqual(mapping['需求分析'], 'TASK-001');
      assert.strictEqual(mapping['代码实现'], 'TASK-002');
    });

    it('should handle new tasks without ID', () => {
      const todoWriteTasks = [
        { content: '新任务', status: 'pending' }
      ];
      const fileTasks = [];

      const mapping = mapTaskIds(todoWriteTasks, fileTasks);

      assert.ok(mapping['新任务']);
      assert.ok(mapping['新任务'].startsWith('TASK-'));
    });
  });

  // =============================================================
  // REQ-003: 崩溃恢复机制
  // =============================================================

  describe('checkCrashRecovery', () => {
    it('should detect incomplete session', () => {
      const content = `# Tasks: Recovery Test

> 状态: in_progress

## 任务列表

- [x] TASK-001: 完成的任务 <!-- completed -->
- [ ] TASK-002: 进行中的任务 <!-- in_progress -->

${SYNC_ANCHOR}
<!-- LAST_SYNC: 2025-01-01T14:30:00+08:00 -->
`;
      const filePath = path.join(testDir, 'recovery.md');
      fs.writeFileSync(filePath, content);

      const recovery = checkCrashRecovery(filePath);

      assert.ok(recovery, 'Should detect recovery needed');
      assert.ok(recovery.hasIncomplete);
      assert.strictEqual(recovery.inProgressCount, 1);
    });

    it('should return null for completed session', () => {
      const content = `# Tasks: Completed Test

> 状态: completed

## 任务列表

- [x] TASK-001: 完成的任务 <!-- completed -->

${SYNC_ANCHOR}
<!-- LAST_SYNC: 2025-01-01T14:30:00+08:00 -->
<!-- SESSION_COMPLETE: 2025-01-01T15:00:00+08:00 -->
`;
      const filePath = path.join(testDir, 'completed.md');
      fs.writeFileSync(filePath, content);

      const recovery = checkCrashRecovery(filePath);

      assert.strictEqual(recovery, null);
    });
  });

  // =============================================================
  // REQ-004: 冲突解决
  // =============================================================

  describe('detectConflict', () => {
    it('should detect when file is newer than last sync', () => {
      const content = `# Tasks: Conflict Test

${SYNC_ANCHOR}
<!-- LAST_SYNC: 2025-01-01T10:00:00+08:00 -->
`;
      const filePath = path.join(testDir, 'conflict.md');
      fs.writeFileSync(filePath, content);

      // Simulate memory state with older sync time
      const memoryState = {
        lastSync: '2025-01-01T09:00:00+08:00'
      };

      const conflict = detectConflict(filePath, memoryState);

      assert.ok(conflict, 'Should detect conflict');
      assert.strictEqual(conflict.type, 'file_newer');
    });

    it('should return null when in sync', () => {
      const content = `# Tasks: In Sync Test

${SYNC_ANCHOR}
<!-- LAST_SYNC: 2025-01-01T10:00:00+08:00 -->
`;
      const filePath = path.join(testDir, 'in-sync.md');
      fs.writeFileSync(filePath, content);

      const memoryState = {
        lastSync: '2025-01-01T10:00:00+08:00'
      };

      const conflict = detectConflict(filePath, memoryState);

      assert.strictEqual(conflict, null);
    });
  });

  // =============================================================
  // REQ-006: 多文件支持
  // =============================================================

  describe('findTasksFiles', () => {
    it('should find tasks.md files recursively', () => {
      const subDir = path.join(testDir, 'sub', 'dir');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'tasks.md'), '# Tasks');
      fs.writeFileSync(path.join(subDir, 'tasks.md'), '# Tasks');

      const files = findTasksFiles(testDir);

      assert.strictEqual(files.length, 2);
    });

    it('should return empty array when no files found', () => {
      const emptyDir = path.join(testDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      const files = findTasksFiles(emptyDir);

      assert.strictEqual(files.length, 0);
    });

    it('should skip node_modules and .git directories', () => {
      const nodeModules = path.join(testDir, 'node_modules');
      const gitDir = path.join(testDir, '.git');
      fs.mkdirSync(nodeModules, { recursive: true });
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(nodeModules, 'tasks.md'), '# Tasks');
      fs.writeFileSync(path.join(gitDir, 'tasks.md'), '# Tasks');

      const files = findTasksFiles(testDir);

      assert.strictEqual(files.length, 0);
    });
  });
});
