/**
 * v3.0 升级模块测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/migration-guide.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  upgrade,
  checkUpgradeNeeded,
  rollback,
  getUpgradeStatus,
  CURRENT_VERSION,
  DEFAULT_ACE_CONFIG,
  formatUpgradeSummary
} = require('../../lib/init/upgrade');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-test-'));
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 创建 v2.x 风格的配置
function createV2Config(extra = {}) {
  const seedDir = path.join(testDir, '.seed');
  fs.mkdirSync(seedDir, { recursive: true });

  const config = {
    name: 'test-project',
    paths: {
      src: 'lib',
      test: 'test'
    },
    ...extra
  };

  fs.writeFileSync(
    path.join(seedDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  return config;
}

// 创建 v3.0 风格的配置（带 ACE）
function createV3Config() {
  const config = createV2Config();
  config.ace = DEFAULT_ACE_CONFIG;

  fs.writeFileSync(
    path.join(testDir, '.seed', 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  return config;
}

// ============================================================================
// REQ-005: 升级命令 (AC-017 ~ AC-020)
// ============================================================================

describe('REQ-005: 升级命令', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-017: 检查当前版本', () => {
    createV2Config();

    // 实际升级（非 dry-run）才显示完整版本信息
    const result = upgrade(testDir);

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('v2.x → v3.0'), `消息应包含版本: ${result.message}`);
  });

  it('AC-018: 备份现有配置', () => {
    createV2Config();

    upgrade(testDir);

    const backupPath = path.join(testDir, '.seed', 'config.json.backup');
    assert.ok(fs.existsSync(backupPath), '应创建备份文件');
  });

  it('AC-019: 自动添加新目录和配置', () => {
    createV2Config();

    upgrade(testDir);

    // 检查 ACE 配置
    const configPath = path.join(testDir, '.seed', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.ok(config.ace, '应添加 ace 配置');
    assert.strictEqual(config.ace.enabled, true);

    // 检查目录
    const obsDir = path.join(testDir, '.seed', 'observations');
    const refDir = path.join(testDir, '.seed', 'reflections');
    assert.ok(fs.existsSync(obsDir), '应创建 observations 目录');
    assert.ok(fs.existsSync(refDir), '应创建 reflections 目录');

    // 检查索引文件
    assert.ok(fs.existsSync(path.join(obsDir, 'index.json')), '应创建观察索引');
    assert.ok(fs.existsSync(path.join(refDir, 'index.json')), '应创建反思索引');
  });

  it('AC-020: 显示升级摘要和下一步提示', () => {
    createV2Config();

    const result = upgrade(testDir);

    assert.ok(result.message.includes('升级完成'), '应显示完成消息');
    assert.ok(result.message.includes('命令变更'), '应说明命令变更');
    assert.ok(result.message.includes('下一步'), '应显示下一步');
    assert.ok(result.message.includes('/mob-seed:spec observe'), '应提示 observe 命令');
  });

  it('未初始化项目返回错误', () => {
    // 不创建配置
    const result = upgrade(testDir);

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('未找到'));
  });

  it('已升级项目不重复升级', () => {
    createV3Config();

    const result = upgrade(testDir);

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('已包含 ACE 配置'));
  });

  it('--force 强制重新配置', () => {
    createV3Config();

    const result = upgrade(testDir, { force: true });

    assert.strictEqual(result.success, true);
  });

  it('--dryRun 预览模式不修改文件', () => {
    createV2Config();

    const result = upgrade(testDir, { dryRun: true });

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('dry-run'));

    // 检查配置未被修改
    const configPath = path.join(testDir, '.seed', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.ok(!config.ace, 'dry-run 不应添加 ace 配置');

    // 检查目录未被创建
    const obsDir = path.join(testDir, '.seed', 'observations');
    assert.ok(!fs.existsSync(obsDir), 'dry-run 不应创建目录');
  });
});

// ============================================================================
// checkUpgradeNeeded 测试
// ============================================================================

describe('checkUpgradeNeeded', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('未初始化项目返回不需要升级', () => {
    const result = checkUpgradeNeeded(testDir);

    assert.strictEqual(result.needsUpgrade, false);
    assert.ok(result.reason.includes('未初始化'));
  });

  it('v2.x 项目返回需要升级', () => {
    createV2Config();

    const result = checkUpgradeNeeded(testDir);

    assert.strictEqual(result.needsUpgrade, true);
    assert.ok(result.reason.includes('ACE'));
  });

  it('v3.0 项目返回不需要升级', () => {
    createV3Config();

    const result = checkUpgradeNeeded(testDir);

    assert.strictEqual(result.needsUpgrade, false);
    assert.ok(result.reason.includes('v3.0'));
  });
});

// ============================================================================
// rollback 测试
// ============================================================================

describe('rollback', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('回滚恢复原始配置', () => {
    const originalConfig = createV2Config();

    // 执行升级
    upgrade(testDir);

    // 验证已升级
    let config = JSON.parse(fs.readFileSync(path.join(testDir, '.seed', 'config.json'), 'utf-8'));
    assert.ok(config.ace, '升级后应有 ace 配置');

    // 回滚
    const result = rollback(testDir);

    assert.strictEqual(result.success, true);

    // 验证已回滚
    config = JSON.parse(fs.readFileSync(path.join(testDir, '.seed', 'config.json'), 'utf-8'));
    assert.ok(!config.ace, '回滚后不应有 ace 配置');
  });

  it('无备份文件返回错误', () => {
    createV2Config();
    // 不执行升级，直接回滚

    const result = rollback(testDir);

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('未找到备份'));
  });
});

// ============================================================================
// getUpgradeStatus 测试
// ============================================================================

describe('getUpgradeStatus', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('未初始化项目状态', () => {
    const status = getUpgradeStatus(testDir);

    assert.strictEqual(status.initialized, false);
    assert.strictEqual(status.hasACEConfig, false);
    assert.strictEqual(status.hasObservationsDir, false);
    assert.strictEqual(status.hasReflectionsDir, false);
  });

  it('v2.x 项目状态', () => {
    createV2Config();

    const status = getUpgradeStatus(testDir);

    assert.strictEqual(status.initialized, true);
    assert.strictEqual(status.hasACEConfig, false);
    assert.strictEqual(status.version, '2.x');
  });

  it('v3.0 项目状态', () => {
    createV3Config();
    fs.mkdirSync(path.join(testDir, '.seed', 'observations'), { recursive: true });
    fs.mkdirSync(path.join(testDir, '.seed', 'reflections'), { recursive: true });

    const status = getUpgradeStatus(testDir);

    assert.strictEqual(status.initialized, true);
    assert.strictEqual(status.hasACEConfig, true);
    assert.strictEqual(status.hasObservationsDir, true);
    assert.strictEqual(status.hasReflectionsDir, true);
    assert.strictEqual(status.version, '3.0');
  });
});

// ============================================================================
// formatUpgradeSummary 测试
// ============================================================================

describe('formatUpgradeSummary', () => {
  it('正常升级摘要', () => {
    const summary = formatUpgradeSummary(
      ['添加 ace 配置', '创建 observations 目录'],
      [],
      false
    );

    assert.ok(summary.includes('升级完成'));
    assert.ok(summary.includes('添加 ace 配置'));
    assert.ok(summary.includes('创建 observations 目录'));
    assert.ok(summary.includes('/mob-seed-* → /mob-seed:*'));
  });

  it('dry-run 模式摘要', () => {
    const summary = formatUpgradeSummary(
      ['[dry-run] 将添加 ace 配置'],
      [],
      true
    );

    assert.ok(summary.includes('升级预览'));
    assert.ok(summary.includes('dry-run'));
  });

  it('包含警告的摘要', () => {
    const summary = formatUpgradeSummary(
      ['添加 ace 配置'],
      ['observations/ 目录已存在'],
      false
    );

    assert.ok(summary.includes('警告'));
    assert.ok(summary.includes('observations/ 目录已存在'));
  });
});

// ============================================================================
// 常量测试
// ============================================================================

describe('常量', () => {
  it('CURRENT_VERSION 是 3.0.0', () => {
    assert.strictEqual(CURRENT_VERSION, '3.0.0');
  });

  it('DEFAULT_ACE_CONFIG 结构正确', () => {
    assert.strictEqual(DEFAULT_ACE_CONFIG.enabled, true);
    assert.ok(Array.isArray(DEFAULT_ACE_CONFIG.sources.core));
    assert.ok(DEFAULT_ACE_CONFIG.sources.core.includes('test_failure'));
    assert.ok(DEFAULT_ACE_CONFIG.reflect.auto_trigger);
    assert.strictEqual(DEFAULT_ACE_CONFIG.reflect.thresholds.same_type, 3);
    assert.strictEqual(DEFAULT_ACE_CONFIG.reflect.thresholds.same_spec, 2);
  });
});
