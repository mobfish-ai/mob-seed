#!/usr/bin/env node
/**
 * SEED 检查缓存
 *
 * 检查文件是否有变更，决定是否需要重新检查
 * 如果缓存命中（文件未变更），返回 exit code 0
 * 如果需要重新检查，返回 exit code 1
 *
 * @module skills/mob-seed/lib/hooks/cache-checker
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_FILE = '.seed/check-cache.json';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 计算文件内容的 SHA256 hash
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
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
 * 检查缓存是否有效
 */
function isCacheValid(entry) {
  if (!entry || !entry.checkedAt) return false;

  const age = Date.now() - new Date(entry.checkedAt).getTime();
  if (age > CACHE_MAX_AGE) return false;

  return entry.result && entry.result.syncStatus === 'pass';
}

/**
 * 检查文件是否命中缓存
 */
function checkCache(files) {
  const cache = loadCache();
  const fileList = files.split('\n').filter(f => f.trim());

  for (const file of fileList) {
    const entry = cache.entries[file];

    // 检查缓存是否存在且有效
    if (!isCacheValid(entry)) {
      return false;
    }

    // 检查文件 hash 是否匹配
    const currentHash = hashFile(file);
    if (!currentHash) continue;

    if (entry.specHash !== currentHash && !entry.codeHashes?.[file]?.startsWith(currentHash.substring(0, 16))) {
      return false;
    }
  }

  return true;
}

// 导出函数供其他模块使用
module.exports = {
  hashFile,
  loadCache,
  isCacheValid,
  checkCache
};

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  let files = '';

  for (const arg of args) {
    if (arg.startsWith('--files=')) {
      files = arg.substring(8);
    }
  }

  if (!files) {
    console.error('Usage: cache-checker.js --files="file1\\nfile2"');
    process.exit(1);
  }

  const cacheHit = checkCache(files);
  process.exit(cacheHit ? 0 : 1);
}
