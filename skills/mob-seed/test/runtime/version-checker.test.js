/**
 * Version Checker Tests
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const versionChecker = require('../../lib/runtime/version-checker');

// 临时目录用于测试
const TEMP_DIR = path.join(os.tmpdir(), 'mob-seed-test-' + Date.now());

function setupTestEnvironment() {
  // 创建测试目录结构
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEMP_DIR, 'skills/mob-seed'), { recursive: true });
  fs.mkdirSync(path.join(TEMP_DIR, '.seed'), { recursive: true });
  fs.mkdirSync(path.join(TEMP_DIR, '.seed/cache'), { recursive: true });

  // 创建测试 package.json
  const testPkg = {
    name: 'mob-seed',
    version: '3.5.0'
  };
  fs.writeFileSync(
    path.join(TEMP_DIR, 'skills/mob-seed/package.json'),
    JSON.stringify(testPkg, null, 2)
  );
}

function cleanupTestEnvironment() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

test('version-checker: getLocalVersion - dogfooding mode', (t) => {
  const originalCwd = process.cwd();
  setupTestEnvironment();
  process.chdir(TEMP_DIR);

  try {
    const result = versionChecker.getLocalVersion();

    assert.strictEqual(result.version, '3.5.0', '应该读取到正确版本号');
    assert.strictEqual(result.scenario, 'dogfooding', '应该识别为 dogfooding 模式');
    assert.ok(result.path, '应该返回 package.json 路径');
  } finally {
    process.chdir(originalCwd);
    cleanupTestEnvironment();
  }
});

test('version-checker: getLocalVersion - missing package.json', (t) => {
  const originalCwd = process.cwd();
  setupTestEnvironment();
  process.chdir(TEMP_DIR);

  // 删除 package.json
  fs.unlinkSync(path.join(TEMP_DIR, 'skills/mob-seed/package.json'));

  try {
    const result = versionChecker.getLocalVersion();

    assert.strictEqual(result.version, null, '没有 package.json 时返回 null');
    assert.strictEqual(result.scenario, 'missing', '应该标记为 missing');
  } finally {
    process.chdir(originalCwd);
    cleanupTestEnvironment();
  }
});

test('version-checker: getUpdateCommand - all scenarios', (t) => {
  assert.strictEqual(
    versionChecker.getUpdateCommand('user-plugin'),
    'claude plugins update mob-seed'
  );

  assert.strictEqual(
    versionChecker.getUpdateCommand('user-env'),
    'npm update -g mob-seed'
  );

  assert.strictEqual(
    versionChecker.getUpdateCommand('dogfooding'),
    'git pull'
  );

  assert.strictEqual(
    versionChecker.getUpdateCommand('compat'),
    'npm update mob-seed'
  );

  assert.strictEqual(
    versionChecker.getUpdateCommand('unknown'),
    'npm update mob-seed',
    '未知场景使用默认命令'
  );
});

test('version-checker: getVersionInfoSync', (t) => {
  const originalCwd = process.cwd();
  setupTestEnvironment();
  process.chdir(TEMP_DIR);

  try {
    const info = versionChecker.getVersionInfoSync();

    assert.strictEqual(info.version, '3.5.0', '应该返回版本号');
    assert.strictEqual(info.scenario, 'dogfooding', '应该返回场景');
    assert.strictEqual(typeof info.updateAvailable, 'boolean', 'updateAvailable 应该是布尔值');
  } finally {
    process.chdir(originalCwd);
    cleanupTestEnvironment();
  }
});

test('version-checker: getLatestVersionFromNpm - returns promise', (t) => {
  const promise = versionChecker.getLatestVersionFromNpm();
  assert.ok(promise instanceof Promise, '应该返回 Promise');
  assert.ok(promise.then && promise.catch, 'Promise 应该有 then 和 catch 方法');
});

test('version-checker: checkRemoteVersion - async function', async (t) => {
  const originalCwd = process.cwd();
  setupTestEnvironment();
  process.chdir(TEMP_DIR);

  try {
    const result = await versionChecker.checkRemoteVersion();

    assert.ok(result, '应该返回结果对象');
    assert.ok('current' in result, '应该有 current 字段');
    assert.ok('latest' in result, '应该有 latest 字段');
    assert.ok('checkedAt' in result, '应该有 checkedAt 字段');
    assert.ok('updateAvailable' in result, '应该有 updateAvailable 字段');
  } finally {
    process.chdir(originalCwd);
    cleanupTestEnvironment();
  }
});
