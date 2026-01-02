#!/usr/bin/env node
/**
 * 任务进度验证脚本
 *
 * 功能：
 * 1. 解析 tasks.md 获取任务和 AC 状态
 * 2. 检查对应测试文件是否存在
 * 3. 运行测试获取实际通过状态
 * 4. 对比 tasks.md 中的 checkbox 与实际测试结果
 * 5. 报告不一致项
 *
 * 用法：
 *   node scripts/verify-task-progress.js [proposal-name]
 *   node scripts/verify-task-progress.js v3.0-ace-integration
 *   node scripts/verify-task-progress.js --check  # 只检查不运行测试
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// 解析 tasks.md
// ============================================================================

/**
 * 解析 tasks.md 文件
 * @param {string} tasksPath - tasks.md 路径
 * @returns {Object} 解析结果
 */
function parseTasksFile(tasksPath) {
  if (!fs.existsSync(tasksPath)) {
    return { error: `tasks.md 不存在: ${tasksPath}` };
  }

  const content = fs.readFileSync(tasksPath, 'utf-8');
  const tasks = [];
  let currentTask = null;

  const lines = content.split('\n');

  for (const line of lines) {
    // 匹配任务标题: ### 任务 1.1: xxx
    const taskMatch = line.match(/^###\s+任务\s+(\d+\.\d+):\s*(.*)$/);
    if (taskMatch) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = {
        id: taskMatch[1],
        name: taskMatch[2],
        spec: null,
        acs: [],
        derivedOutputs: []
      };
      continue;
    }

    // 匹配关联规格: **关联规格**: `xxx`
    const specMatch = line.match(/\*\*关联规格\*\*:\s*`([^`]+)`/);
    if (specMatch && currentTask) {
      currentTask.spec = specMatch[1];
      continue;
    }

    // 匹配 AC checkbox: - [x] AC-001: xxx 或 - [ ] AC-001: xxx
    const acMatch = line.match(/^-\s*\[([ x])\]\s*(AC-\d+):\s*(.*)$/);
    if (acMatch && currentTask) {
      currentTask.acs.push({
        completed: acMatch[1] === 'x',
        id: acMatch[2],
        description: acMatch[3]
      });
      continue;
    }

    // 匹配派生产物: - `path` ✅ 或 - `path`
    const outputMatch = line.match(/^-\s*`([^`]+)`\s*(✅)?/);
    if (outputMatch && currentTask && line.includes('派生产物')) {
      // 这行之后的都是派生产物
    } else if (outputMatch && currentTask) {
      currentTask.derivedOutputs.push({
        path: outputMatch[1],
        verified: outputMatch[2] === '✅'
      });
    }
  }

  if (currentTask) {
    tasks.push(currentTask);
  }

  return { tasks };
}

// ============================================================================
// 检查文件存在性
// ============================================================================

/**
 * 检查派生产物是否存在
 * @param {Object[]} tasks - 任务列表
 * @returns {Object[]} 检查结果
 */
function checkDerivedOutputs(tasks) {
  const results = [];

  for (const task of tasks) {
    for (const output of task.derivedOutputs) {
      const fullPath = path.join(PROJECT_ROOT, output.path);
      const exists = fs.existsSync(fullPath);

      if (output.verified && !exists) {
        results.push({
          type: 'missing',
          task: task.id,
          path: output.path,
          message: `标记为 ✅ 但文件不存在`
        });
      } else if (!output.verified && exists) {
        results.push({
          type: 'unverified',
          task: task.id,
          path: output.path,
          message: `文件存在但未标记 ✅`
        });
      }
    }
  }

  return results;
}

// ============================================================================
// 运行测试并解析结果
// ============================================================================

/**
 * 运行测试并获取结果
 * @param {string} testPath - 测试文件路径
 * @returns {Object} 测试结果
 */
function runTest(testPath) {
  const fullPath = path.join(PROJECT_ROOT, testPath);

  if (!fs.existsSync(fullPath)) {
    return { error: `测试文件不存在: ${testPath}`, passed: 0, failed: 0 };
  }

  try {
    // 使用 execFileSync 避免 shell 注入风险
    const result = execFileSync('timeout', ['60', 'node', '--test', fullPath], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 解析测试输出
    const passMatch = result.match(/# pass (\d+)/);
    const failMatch = result.match(/# fail (\d+)/);

    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      output: result
    };
  } catch (err) {
    // 测试失败时也返回结果
    const output = err.stdout || err.stderr || '';
    const passMatch = output.match(/# pass (\d+)/);
    const failMatch = output.match(/# fail (\d+)/);

    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      error: err.message,
      output
    };
  }
}

// ============================================================================
// 主逻辑
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const proposalName = args.find(a => !a.startsWith('--')) || 'v3.0-ace-integration';

  console.log('📋 任务进度验证');
  console.log('================\n');

  // 查找 tasks.md
  const tasksPath = path.join(PROJECT_ROOT, 'openspec/changes', proposalName, 'tasks.md');

  if (!fs.existsSync(tasksPath)) {
    console.error(`❌ 找不到 tasks.md: ${tasksPath}`);
    process.exit(1);
  }

  console.log(`提案: ${proposalName}`);
  console.log(`文件: ${tasksPath}\n`);

  // 解析 tasks.md
  const { tasks, error } = parseTasksFile(tasksPath);

  if (error) {
    console.error(`❌ 解析错误: ${error}`);
    process.exit(1);
  }

  console.log(`找到 ${tasks.length} 个任务\n`);

  // 检查派生产物
  console.log('📁 派生产物检查');
  console.log('----------------');

  const outputIssues = checkDerivedOutputs(tasks);

  if (outputIssues.length === 0) {
    console.log('✅ 所有派生产物状态一致\n');
  } else {
    for (const issue of outputIssues) {
      const icon = issue.type === 'missing' ? '❌' : '⚠️';
      console.log(`${icon} 任务 ${issue.task}: ${issue.path}`);
      console.log(`   ${issue.message}`);
    }
    console.log('');
  }

  // 统计 AC 完成情况
  console.log('📊 AC 完成统计');
  console.log('--------------');

  let totalACs = 0;
  let completedACs = 0;

  for (const task of tasks) {
    const completed = task.acs.filter(ac => ac.completed).length;
    const total = task.acs.length;
    totalACs += total;
    completedACs += completed;

    const status = completed === total ? '✅' : (completed > 0 ? '🔄' : '⏳');
    console.log(`${status} 任务 ${task.id}: ${completed}/${total} AC`);
  }

  console.log(`\n总计: ${completedACs}/${totalACs} AC (${Math.round(completedACs/totalACs*100)}%)\n`);

  // 运行测试（除非 --check）
  if (!checkOnly) {
    console.log('🧪 测试验证');
    console.log('-----------');

    const testResults = [];

    for (const task of tasks) {
      // 查找测试文件
      const testOutputs = task.derivedOutputs.filter(o => o.path.includes('.test.js'));

      for (const testOutput of testOutputs) {
        console.log(`运行: ${testOutput.path}...`);
        const result = runTest(testOutput.path);

        if (result.error && result.passed === 0) {
          console.log(`  ❌ 错误: ${result.error}`);
        } else {
          const status = result.failed === 0 ? '✅' : '❌';
          console.log(`  ${status} ${result.passed} pass, ${result.failed} fail`);
        }

        testResults.push({
          task: task.id,
          path: testOutput.path,
          ...result
        });
      }
    }

    // 汇总
    const totalPassed = testResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = testResults.reduce((sum, r) => sum + r.failed, 0);

    console.log(`\n测试汇总: ${totalPassed} pass, ${totalFailed} fail`);

    if (totalFailed > 0) {
      console.log('\n⚠️ 有失败的测试，请检查 AC 状态是否正确');
      process.exit(1);
    }
  }

  // 最终结果
  console.log('\n✅ 验证完成');

  if (outputIssues.length > 0) {
    console.log(`⚠️ 发现 ${outputIssues.length} 个派生产物状态不一致`);
    process.exit(1);
  }
}

main();
