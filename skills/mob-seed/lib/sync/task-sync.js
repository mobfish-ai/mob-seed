/**
 * Task Sync (任务同步)
 *
 * 实现 tasks.md 文件与 Claude Code TodoWrite 工具的双向同步。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/core/task-sync.fspec.md
 * @module lib/sync/task-sync
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 任务 ID 前缀
 */
const TASK_ID_PREFIX = 'TASK';

/**
 * 同步锚点标记
 */
const SYNC_ANCHOR = '<!-- CC_SYNC_ANCHOR: 用于 Claude Code 解析的锚点 -->';

/**
 * 解析任务行
 *
 * @param {string} line - Markdown 任务行
 * @returns {Object|null} 任务对象或 null
 */
function parseTaskLine(line) {
  // 匹配 "- [x] TASK-XXX: content <!-- status:timestamp -->" 或 "- [ ] TASK-XXX: content"
  const taskMatch = line.match(/^-\s*\[([ x])\]\s*(TASK-\d+):\s*(.+?)(?:\s*<!--\s*(\w+)(?::([^>]+))?\s*-->)?$/);

  if (!taskMatch) return null;

  const [, checkbox, id, content, status, timestamp] = taskMatch;
  const isCompleted = checkbox === 'x';

  return {
    id,
    content: content.trim(),
    status: status || (isCompleted ? 'completed' : 'pending'),
    timestamp: timestamp || null
  };
}

/**
 * 格式化任务行
 *
 * @param {Object} task - 任务对象
 * @returns {string} Markdown 格式的任务行
 */
function formatTaskLine(task) {
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
  const timestamp = task.timestamp ? `:${task.timestamp}` : '';
  return `- ${checkbox} ${task.id}: ${task.content} <!-- ${task.status}${timestamp} -->`;
}

/**
 * 解析 tasks.md 文件
 *
 * @see REQ-001 AC-001: 支持 Markdown checkbox 格式
 * @see REQ-001 AC-002: 解析 HTML 注释中的元数据
 *
 * @param {string} filePath - 文件路径
 * @returns {Object} 任务列表对象
 */
function parseTasksFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { title: '', status: '', tasks: [], lastSync: null };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let title = '';
  let status = '';
  let lastSync = null;
  const tasks = [];

  for (const line of lines) {
    // 解析标题
    const titleMatch = line.match(/^#\s*Tasks:\s*(.+)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // 解析状态
    const statusMatch = line.match(/^>\s*状态:\s*(\w+)/);
    if (statusMatch) {
      status = statusMatch[1];
      continue;
    }

    // 解析最后同步时间
    const syncMatch = line.match(/<!--\s*LAST_SYNC:\s*([^>]+)\s*-->/);
    if (syncMatch) {
      lastSync = syncMatch[1].trim();
      continue;
    }

    // 解析任务行
    const task = parseTaskLine(line);
    if (task) {
      tasks.push(task);
    }
  }

  return { title, status, tasks, lastSync };
}

/**
 * 写入 tasks.md 文件
 *
 * @param {string} filePath - 文件路径
 * @param {Object} taskList - 任务列表对象
 */
function writeTasksFile(filePath, taskList) {
  const now = new Date().toISOString();
  const lines = [
    `# Tasks: ${taskList.title}`,
    '',
    `> 状态: ${taskList.status || 'in_progress'}`,
    `> 最后更新: ${now}`,
    '',
    '## 任务列表',
    ''
  ];

  for (const task of taskList.tasks) {
    lines.push(formatTaskLine(task));
  }

  lines.push('');
  lines.push(SYNC_ANCHOR);
  lines.push(`<!-- LAST_SYNC: ${now} -->`);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, lines.join('\n'));
}

/**
 * 查找 tasks.md 文件
 *
 * @see REQ-006 AC-016: 自动发现 tasks.md 文件
 *
 * @param {string} rootDir - 根目录
 * @returns {Array<string>} 文件路径列表
 */
function findTasksFiles(rootDir) {
  const results = [];
  const skipDirs = ['node_modules', '.git', '.seed', 'dist', 'build'];

  function scan(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.name === 'tasks.md') {
        results.push(fullPath);
      }
    }
  }

  scan(rootDir);
  return results;
}

/**
 * 从文件同步到 TodoWrite
 *
 * @see REQ-002 AC-004: 启动时自动检测 tasks.md
 * @see REQ-002 AC-005: 状态变更实时同步
 *
 * @param {string} filePath - 文件路径
 * @returns {Object} 解析后的任务列表
 */
function syncFromFile(filePath) {
  return parseTasksFile(filePath);
}

/**
 * 从 TodoWrite 同步到文件
 *
 * @see REQ-002 AC-006: 保持任务 ID 对应关系
 *
 * @param {string} filePath - 文件路径
 * @param {Object} taskList - 任务列表
 */
function syncToFile(filePath, taskList) {
  writeTasksFile(filePath, taskList);
}

/**
 * 检测同步冲突
 *
 * @see REQ-004 AC-010: 基于 LAST_SYNC 检测冲突
 *
 * @param {string} filePath - 文件路径
 * @param {Object} memoryState - 内存中的状态
 * @returns {Object|null} 冲突信息或 null
 */
function detectConflict(filePath, memoryState = {}) {
  if (!fs.existsSync(filePath)) return null;

  const fileContent = parseTasksFile(filePath);
  const fileSync = fileContent.lastSync;
  const memorySync = memoryState.lastSync;

  if (!memorySync || !fileSync) return null;

  const fileTime = new Date(fileSync).getTime();
  const memoryTime = new Date(memorySync).getTime();

  if (fileTime > memoryTime) {
    return {
      type: 'file_newer',
      fileSync,
      memorySync
    };
  } else if (fileTime < memoryTime) {
    return {
      type: 'memory_newer',
      fileSync,
      memorySync
    };
  }

  return null;
}

/**
 * 检查崩溃恢复
 *
 * @see REQ-003 AC-007: 检测异常中断
 * @see REQ-003 AC-008: 显示中断前的任务状态
 *
 * @param {string} filePath - 文件路径
 * @returns {Object|null} 恢复信息或 null
 */
function checkCrashRecovery(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  // 检查是否有 SESSION_COMPLETE 标记
  if (content.includes('SESSION_COMPLETE:')) {
    return null;
  }

  const taskList = parseTasksFile(filePath);

  // 检查是否有进行中或待处理的任务
  const inProgressTasks = taskList.tasks.filter(t => t.status === 'in_progress');
  const pendingTasks = taskList.tasks.filter(t => t.status === 'pending');

  if (inProgressTasks.length > 0 || pendingTasks.length > 0) {
    return {
      hasIncomplete: true,
      inProgressCount: inProgressTasks.length,
      pendingCount: pendingTasks.length,
      tasks: taskList.tasks,
      lastSync: taskList.lastSync
    };
  }

  return null;
}

/**
 * 执行恢复
 *
 * @see REQ-003 AC-009: 用户确认后恢复
 *
 * @param {string} filePath - 文件路径
 * @returns {Object} 恢复后的任务列表
 */
function performRecovery(filePath) {
  return parseTasksFile(filePath);
}

/**
 * 生成任务 ID
 *
 * @see REQ-005 AC-013: TASK ID 格式
 * @see REQ-005 AC-014: ID 全局唯一
 *
 * @param {Object} taskList - 现有任务列表
 * @returns {string} 新的任务 ID
 */
function generateTaskId(taskList) {
  const tasks = taskList.tasks || [];

  // 找出现有的最大 ID
  let maxId = 0;
  for (const task of tasks) {
    const match = task.id && task.id.match(/TASK-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxId) maxId = num;
    }
  }

  return `TASK-${String(maxId + 1).padStart(3, '0')}`;
}

/**
 * 映射任务 ID
 *
 * @param {Array} todoWriteTasks - TodoWrite 任务
 * @param {Array} fileTasks - 文件任务
 * @returns {Object} ID 映射关系
 */
function mapTaskIds(todoWriteTasks, fileTasks) {
  const mapping = {};
  const usedIds = new Set(fileTasks.map(t => t.id));

  // 按内容匹配现有任务
  for (const todo of todoWriteTasks) {
    const existingTask = fileTasks.find(f => f.content === todo.content);
    if (existingTask) {
      mapping[todo.content] = existingTask.id;
    } else {
      // 生成新 ID
      let maxId = 0;
      for (const id of usedIds) {
        const match = id && id.match(/TASK-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      }
      const newId = `TASK-${String(maxId + 1).padStart(3, '0')}`;
      mapping[todo.content] = newId;
      usedIds.add(newId);
    }
  }

  return mapping;
}

module.exports = {
  // 文件操作
  parseTasksFile,
  writeTasksFile,
  findTasksFiles,

  // 同步操作
  syncFromFile,
  syncToFile,
  detectConflict,

  // 恢复操作
  checkCrashRecovery,
  performRecovery,

  // ID 管理
  generateTaskId,
  mapTaskIds,

  // 工具函数
  formatTaskLine,
  parseTaskLine,

  // 常量导出
  TASK_ID_PREFIX,
  SYNC_ANCHOR
};
