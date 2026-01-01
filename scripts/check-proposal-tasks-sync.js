#!/usr/bin/env node
/**
 * check-proposal-tasks-sync.js
 *
 * 检查 proposal.md 和 tasks.md 中的 Phase 定义是否一致
 *
 * 用法: node scripts/check-proposal-tasks-sync.js [change-name]
 * 例如: node scripts/check-proposal-tasks-sync.js v2.1-release-automation
 */

const fs = require('fs');
const path = require('path');

const CHANGES_DIR = path.join(__dirname, '..', 'openspec', 'changes');

/**
 * 从 markdown 中提取 Phase 标题
 * @param {string} content - markdown 内容
 * @returns {string[]} - Phase 标题数组
 */
function extractPhases(content) {
  const phases = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // 匹配 ## Phase N: xxx 或 ### Phase N: xxx
    const match = line.match(/^#{2,3}\s*(Phase\s+\d+[：:].+?)(?:\s*[✅⏳🚧].*)?$/);
    if (match) {
      // 标准化：去掉状态标记，统一冒号
      const phase = match[1]
        .replace(/：/g, ':')  // 中文冒号转英文
        .replace(/\s+/g, ' ') // 多空格变单空格
        .trim();
      phases.push(phase);
    }
  }

  return phases;
}

/**
 * 比较两个 Phase 列表
 * @param {string[]} proposalPhases - proposal.md 中的 phases
 * @param {string[]} tasksPhases - tasks.md 中的 phases
 * @returns {Object} - 比较结果
 */
function comparePhases(proposalPhases, tasksPhases) {
  const result = {
    matched: true,
    errors: [],
    warnings: []
  };

  // 检查数量
  if (proposalPhases.length !== tasksPhases.length) {
    result.matched = false;
    result.errors.push(
      `Phase 数量不一致: proposal.md 有 ${proposalPhases.length} 个, tasks.md 有 ${tasksPhases.length} 个`
    );
  }

  // 逐个比较
  const maxLen = Math.max(proposalPhases.length, tasksPhases.length);
  for (let i = 0; i < maxLen; i++) {
    const p = proposalPhases[i];
    const t = tasksPhases[i];

    if (!p) {
      result.matched = false;
      result.errors.push(`tasks.md 多出: ${t}`);
    } else if (!t) {
      result.matched = false;
      result.errors.push(`proposal.md 多出: ${p}`);
    } else if (p !== t) {
      result.matched = false;
      result.errors.push(`Phase ${i + 1} 不一致:\n  proposal: ${p}\n  tasks:    ${t}`);
    }
  }

  return result;
}

/**
 * 检查单个变更提案
 * @param {string} changeName - 变更名称
 * @returns {Object} - 检查结果
 */
function checkChange(changeName) {
  const changeDir = path.join(CHANGES_DIR, changeName);
  const proposalPath = path.join(changeDir, 'proposal.md');
  const tasksPath = path.join(changeDir, 'tasks.md');

  // 检查文件存在
  if (!fs.existsSync(proposalPath)) {
    return { error: `proposal.md 不存在: ${proposalPath}` };
  }
  if (!fs.existsSync(tasksPath)) {
    return { error: `tasks.md 不存在: ${tasksPath}` };
  }

  // 读取并解析
  const proposalContent = fs.readFileSync(proposalPath, 'utf-8');
  const tasksContent = fs.readFileSync(tasksPath, 'utf-8');

  const proposalPhases = extractPhases(proposalContent);
  const tasksPhases = extractPhases(tasksContent);

  // 比较
  const comparison = comparePhases(proposalPhases, tasksPhases);

  return {
    changeName,
    proposalPhases,
    tasksPhases,
    ...comparison
  };
}

/**
 * 列出所有 implementing 状态的变更
 * @returns {string[]} - 变更名称列表
 */
function listImplementingChanges() {
  if (!fs.existsSync(CHANGES_DIR)) {
    return [];
  }

  const changes = [];
  const dirs = fs.readdirSync(CHANGES_DIR);

  for (const dir of dirs) {
    const proposalPath = path.join(CHANGES_DIR, dir, 'proposal.md');
    if (fs.existsSync(proposalPath)) {
      const content = fs.readFileSync(proposalPath, 'utf-8');
      if (content.includes('状态: implementing') || content.includes('status: implementing')) {
        changes.push(dir);
      }
    }
  }

  return changes;
}

// 主程序
function main() {
  const args = process.argv.slice(2);
  let changesToCheck = [];

  if (args.length > 0) {
    changesToCheck = [args[0]];
  } else {
    // 检查所有 implementing 状态的变更
    changesToCheck = listImplementingChanges();
    if (changesToCheck.length === 0) {
      console.log('✅ 没有 implementing 状态的变更提案');
      process.exit(0);
    }
  }

  console.log('🔍 检查 proposal.md 与 tasks.md 的 Phase 同步状态\n');

  let hasError = false;

  for (const change of changesToCheck) {
    console.log(`📁 ${change}`);
    const result = checkChange(change);

    if (result.error) {
      console.log(`   ❌ ${result.error}`);
      hasError = true;
      continue;
    }

    if (result.matched) {
      console.log(`   ✅ ${result.proposalPhases.length} 个 Phase 完全同步`);
    } else {
      hasError = true;
      console.log(`   ❌ Phase 不同步:`);
      for (const err of result.errors) {
        console.log(`      - ${err}`);
      }
    }
    console.log();
  }

  if (hasError) {
    console.log('\n⚠️  发现同步问题，请修复后重试');
    console.log('提示: proposal.md#实施路径 是 Phase 定义的唯一真相源');
    process.exit(1);
  } else {
    console.log('✅ 所有变更提案的 Phase 定义同步正常');
    process.exit(0);
  }
}

main();
