#!/usr/bin/env node
/**
 * SEED 缓存更新
 *
 * 更新检查缓存，记录检查结果
 *
 * @module skills/mob-seed/lib/hooks/cache-updater
 */

const fs = require('fs');
const crypto = require('crypto');

const CACHE_FILE = '.seed/check-cache.json';

/**
 * 计算文件内容的 SHA256 hash
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch {
    return null;
  }
}

/**
 * 加载缓存
 */
function loadCache() {
  try {
    const content = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { version: '1.0.0', entries: {} };
  }
}

/**
 * 保存缓存
 */
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * 更新缓存
 */
function updateCache(files, result = { syncStatus: 'pass', principleScore: 1.0, antiGoalViolations: [] }) {
  const cache = loadCache();
  const fileList = files.split('\n').filter(f => f.trim());
  const now = new Date().toISOString();

  for (const file of fileList) {
    const hash = hashFile(file);
    if (!hash) continue;

    // 确定是规格文件还是代码文件
    if (file.endsWith('.fspec.md')) {
      cache.entries[file] = {
        specHash: hash,
        codeHashes: {},
        result,
        checkedAt: now
      };
    } else {
      // 找到对应的规格文件条目并更新代码 hash
      for (const [specPath, entry] of Object.entries(cache.entries)) {
        if (!entry.codeHashes) entry.codeHashes = {};
        entry.codeHashes[file] = hash;
        entry.checkedAt = now;
      }
    }
  }

  saveCache(cache);
  console.log(`✅ 缓存已更新: ${fileList.length} 个文件`);
}

// 导出函数供其他模块使用
module.exports = {
  hashFile,
  loadCache,
  saveCache,
  updateCache
};

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  let files = '';
  let result = { syncStatus: 'pass', principleScore: 1.0, antiGoalViolations: [] };

  for (const arg of args) {
    if (arg.startsWith('--files=')) {
      files = arg.substring(8);
    }
    if (arg.startsWith('--result=')) {
      try {
        result = JSON.parse(arg.substring(9));
      } catch {
        // 使用默认结果
      }
    }
  }

  if (!files) {
    console.error('Usage: cache-updater.js --files="file1\\nfile2" [--result=JSON]');
    process.exit(1);
  }

  updateCache(files, result);
}
