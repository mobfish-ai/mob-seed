/**
 * pre-impl-confirmation 测试
 * @see openspec/changes/v2.0-seed-complete/specs/workflow/pre-impl-confirmation.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  // 常量
  RISK_LEVELS,
  CHANGE_TYPES,
  USER_CHOICES,
  DEFAULT_CONFIG,

  // 预览生成
  generateChangePreview,
  analyzeChanges,
  formatPreviewText,

  // 风险评估
  assessRisk,
  getRiskLevel,

  // 用户交互
  parseUserChoice,
  processUserChoice,

  // 持久化
  saveImplPlan,
  loadImplPlan,

  // 回滚准备
  createRollbackPoint,
  executeRollback,

  // 辅助函数
  batchChanges,
  groupByModule,
  extractModule,
  isCoreFilePath
} = require('../../lib/workflow/pre-impl-confirmation.js');

describe('pre-impl-confirmation', () => {
  const testDir = '/tmp/pre-impl-confirmation-test';
  const seedDir = path.join(testDir, '.seed');
  const backupDir = path.join(seedDir, 'backups');

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(seedDir)) {
      fs.mkdirSync(seedDir, { recursive: true });
    }
    // 切换到测试目录
    process.chdir(testDir);
  });

  afterEach(() => {
    // 清理测试目录
    process.chdir('/tmp');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =============================================================
  // REQ-001: 变更预览生成
  // =============================================================

  describe('analyzeChanges', () => {
    it('AC-001: should extract all file changes from design plan', () => {
      const designPlan = {
        newFiles: [
          { path: 'lib/router/complexity.js', estimatedLines: 120 },
          { path: 'test/router.test.js', estimatedLines: 80 }
        ],
        modifyFiles: [
          { path: 'lib/core/engine.js', additions: 30, deletions: 10 }
        ],
        deleteFiles: [
          { path: 'lib/deprecated/old.js', hasBackup: true }
        ]
      };

      const changes = analyzeChanges(designPlan);

      assert.strictEqual(changes.length, 4);
      assert.strictEqual(changes.filter(c => c.type === CHANGE_TYPES.CREATE).length, 2);
      assert.strictEqual(changes.filter(c => c.type === CHANGE_TYPES.MODIFY).length, 1);
      assert.strictEqual(changes.filter(c => c.type === CHANGE_TYPES.DELETE).length, 1);
    });

    it('should handle empty design plan', () => {
      const changes = analyzeChanges({});
      assert.strictEqual(changes.length, 0);
    });

    it('should handle null design plan', () => {
      const changes = analyzeChanges(null);
      assert.strictEqual(changes.length, 0);
    });

    it('should extract module name from file path', () => {
      const designPlan = {
        newFiles: [
          { path: 'lib/router/complexity.js' },
          { path: 'lib/sync/task-sync.js' }
        ]
      };

      const changes = analyzeChanges(designPlan);

      assert.strictEqual(changes[0].module, 'router');
      assert.strictEqual(changes[1].module, 'sync');
    });
  });

  describe('getRiskLevel', () => {
    it('AC-002: should mark delete without backup as high risk', () => {
      const change = { type: CHANGE_TYPES.DELETE, path: 'file.js', hasBackup: false };
      assert.strictEqual(getRiskLevel(change), RISK_LEVELS.HIGH);
    });

    it('should mark delete with backup as medium risk', () => {
      const change = { type: CHANGE_TYPES.DELETE, path: 'file.js', hasBackup: true, risk: RISK_LEVELS.MEDIUM };
      assert.strictEqual(getRiskLevel(change), RISK_LEVELS.MEDIUM);
    });

    it('should mark core file modification as medium risk', () => {
      const change = { type: CHANGE_TYPES.MODIFY, path: 'lib/core/engine.js' };
      assert.strictEqual(getRiskLevel(change), RISK_LEVELS.MEDIUM);
    });

    it('should mark new dependency as medium risk', () => {
      const change = { type: 'dependency', action: 'add', name: 'lodash' };
      assert.strictEqual(getRiskLevel(change), RISK_LEVELS.MEDIUM);
    });
  });

  describe('generateChangePreview', () => {
    it('AC-003: should estimate change scope', () => {
      const designPlan = {
        newFiles: [
          { path: 'lib/a.js', estimatedLines: 100 },
          { path: 'lib/b.js', estimatedLines: 200 }
        ]
      };

      const preview = generateChangePreview(designPlan);

      assert.strictEqual(preview.summary.total, 2);
      assert.strictEqual(preview.summary.create, 2);
      assert.ok(preview.byType.create[0].estimatedLines > 0);
    });

    it('should group changes by type', () => {
      const designPlan = {
        newFiles: [{ path: 'lib/new.js' }],
        modifyFiles: [{ path: 'lib/modify.js' }],
        deleteFiles: [{ path: 'lib/delete.js' }]
      };

      const preview = generateChangePreview(designPlan);

      assert.strictEqual(preview.byType.create.length, 1);
      assert.strictEqual(preview.byType.modify.length, 1);
      assert.strictEqual(preview.byType.delete.length, 1);
    });

    it('should group changes by module', () => {
      const designPlan = {
        newFiles: [
          { path: 'lib/router/a.js' },
          { path: 'lib/router/b.js' },
          { path: 'lib/sync/c.js' }
        ]
      };

      const preview = generateChangePreview(designPlan);

      assert.strictEqual(preview.byModule.router.length, 2);
      assert.strictEqual(preview.byModule.sync.length, 1);
    });
  });

  // =============================================================
  // REQ-002: 确认交互流程
  // =============================================================

  describe('formatPreviewText', () => {
    it('AC-004: should generate clear confirmation interface', () => {
      const preview = generateChangePreview({
        newFiles: [{ path: 'lib/new.js', estimatedLines: 100 }],
        modifyFiles: [{ path: 'lib/core/engine.js', additions: 20, deletions: 5 }]
      });

      const text = formatPreviewText(preview);

      assert.ok(text.includes('📋 实现前确认'));
      assert.ok(text.includes('变更概览'));
      assert.ok(text.includes('新建: 1 个文件'));
      assert.ok(text.includes('修改: 1 个文件'));
      assert.ok(text.includes('🟢 新建文件'));
      assert.ok(text.includes('🟡 修改文件'));
    });

    it('should show delete files with backup status', () => {
      const preview = generateChangePreview({
        deleteFiles: [
          { path: 'lib/old.js', hasBackup: true },
          { path: 'lib/unsafe.js', hasBackup: false }
        ]
      });

      const text = formatPreviewText(preview);

      assert.ok(text.includes('🔴 删除文件'));
      assert.ok(text.includes('(已备份)'));
      assert.ok(text.includes('(无备份!)'));
    });
  });

  describe('parseUserChoice', () => {
    it('AC-005: should support multiple user choices', () => {
      const preview = { riskAssessment: { requiresConfirmPhrase: false } };

      assert.strictEqual(parseUserChoice('y', preview).choice, USER_CHOICES.CONFIRM);
      assert.strictEqual(parseUserChoice('yes', preview).choice, USER_CHOICES.CONFIRM);
      assert.strictEqual(parseUserChoice('', preview).choice, USER_CHOICES.CONFIRM);
      assert.strictEqual(parseUserChoice('n', preview).choice, USER_CHOICES.CANCEL);
      assert.strictEqual(parseUserChoice('no', preview).choice, USER_CHOICES.CANCEL);
      assert.strictEqual(parseUserChoice('v', preview).choice, USER_CHOICES.VIEW);
      assert.strictEqual(parseUserChoice('s', preview).choice, USER_CHOICES.SKIP);
      assert.strictEqual(parseUserChoice('e', preview).choice, USER_CHOICES.EDIT);
    });

    it('should require confirm phrase for high risk', () => {
      const preview = { riskAssessment: { requiresConfirmPhrase: true } };

      const result = parseUserChoice('y', preview);
      assert.strictEqual(result.choice, 'invalid');

      const confirmResult = parseUserChoice('我确认', preview);
      assert.strictEqual(confirmResult.choice, USER_CHOICES.CONFIRM);
    });
  });

  describe('processUserChoice', () => {
    it('AC-006: should process confirm choice', () => {
      const preview = generateChangePreview({
        newFiles: [{ path: 'lib/new.js' }]
      });

      const result = processUserChoice({ choice: USER_CHOICES.CONFIRM }, preview);

      assert.strictEqual(result.action, 'proceed');
      assert.ok(result.changes.length > 0);
    });

    it('should process cancel choice', () => {
      const preview = generateChangePreview({
        newFiles: [{ path: 'lib/new.js' }]
      });

      const result = processUserChoice({ choice: USER_CHOICES.CANCEL }, preview);

      assert.strictEqual(result.action, 'cancel');
      assert.strictEqual(result.changes.length, 0);
    });
  });

  // =============================================================
  // REQ-003: 风险评估
  // =============================================================

  describe('assessRisk', () => {
    it('AC-007: should assess multiple dimensions', () => {
      const changes = [
        { type: CHANGE_TYPES.CREATE, path: 'lib/a.js', risk: RISK_LEVELS.LOW },
        { type: CHANGE_TYPES.MODIFY, path: 'lib/core/engine.js', risk: RISK_LEVELS.MEDIUM },
        { type: CHANGE_TYPES.DELETE, path: 'lib/old.js', hasBackup: false, risk: RISK_LEVELS.HIGH }
      ];

      const assessment = assessRisk(changes);

      assert.strictEqual(assessment.fileCount, 3);
      assert.ok(assessment.highRiskCount >= 1);
      assert.ok(assessment.warnings.length > 0);
    });

    it('AC-008: should require confirm phrase for high risk', () => {
      const changes = [
        { type: CHANGE_TYPES.DELETE, path: 'lib/critical.js', hasBackup: false }
      ];

      const assessment = assessRisk(changes);

      assert.strictEqual(assessment.requiresConfirmPhrase, true);
      assert.strictEqual(assessment.totalRisk, RISK_LEVELS.HIGH);
    });

    it('AC-009: should provide clear risk explanation', () => {
      const changes = Array(20).fill(null).map((_, i) => ({
        type: CHANGE_TYPES.CREATE,
        path: `lib/file${i}.js`,
        risk: RISK_LEVELS.LOW
      }));

      const assessment = assessRisk(changes);

      assert.ok(assessment.warnings.some(w => w.includes('变更文件数量较多')));
    });

    it('should warn about core file modifications', () => {
      const changes = [
        { type: CHANGE_TYPES.MODIFY, path: 'lib/core/a.js' },
        { type: CHANGE_TYPES.MODIFY, path: 'lib/core/b.js' },
        { type: CHANGE_TYPES.MODIFY, path: 'lib/core/c.js' }
      ];

      const assessment = assessRisk(changes);

      assert.ok(assessment.warnings.some(w => w.includes('核心文件')));
    });
  });

  // =============================================================
  // REQ-004: 变更清单持久化
  // =============================================================

  describe('saveImplPlan', () => {
    it('AC-010: should save in JSON format', () => {
      const preview = generateChangePreview({
        newFiles: [{ path: 'lib/new.js' }]
      });

      const savedPath = saveImplPlan(preview, { confirmed: true }, 'test-flow-001');

      assert.ok(fs.existsSync(savedPath));

      const saved = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
      assert.strictEqual(saved.version, '1.0');
      assert.ok(saved.confirmed_at);
    });

    it('AC-011: should record user choices', () => {
      const preview = generateChangePreview({
        newFiles: [
          { path: 'lib/a.js' },
          { path: 'lib/b.js' }
        ]
      });

      const savedPath = saveImplPlan(preview, {
        confirmed: true,
        skipped: ['lib/b.js']
      }, 'test-flow-002');

      const saved = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
      assert.deepStrictEqual(saved.skipped, ['lib/b.js']);
      assert.strictEqual(saved.user_confirmed, true);
    });
  });

  describe('loadImplPlan', () => {
    it('AC-012: should support checkpoint recovery', () => {
      const preview = generateChangePreview({
        newFiles: [{ path: 'lib/new.js' }]
      });

      saveImplPlan(preview, { confirmed: true }, 'test-flow-003');

      const loaded = loadImplPlan('test-flow-003');

      assert.ok(loaded);
      assert.strictEqual(loaded.flow_id, 'test-flow-003');
      assert.ok(loaded.changes.length > 0);
    });

    it('should return null for non-existent plan', () => {
      const loaded = loadImplPlan('non-existent');
      assert.strictEqual(loaded, null);
    });
  });

  // =============================================================
  // REQ-005: 增量确认
  // =============================================================

  describe('batchChanges', () => {
    it('AC-013: should support batch confirmation', () => {
      const changes = Array(25).fill(null).map((_, i) => ({
        type: CHANGE_TYPES.CREATE,
        path: `lib/file${i}.js`
      }));

      const batches = batchChanges(changes, 10);

      assert.strictEqual(batches.length, 3);
      assert.strictEqual(batches[0].length, 10);
      assert.strictEqual(batches[1].length, 10);
      assert.strictEqual(batches[2].length, 5);
    });
  });

  describe('groupByModule', () => {
    it('AC-014: should support module-level confirmation', () => {
      const changes = [
        { path: 'lib/router/a.js', module: 'router' },
        { path: 'lib/router/b.js', module: 'router' },
        { path: 'lib/sync/c.js', module: 'sync' }
      ];

      const groups = groupByModule(changes);

      assert.strictEqual(Object.keys(groups).length, 2);
      assert.strictEqual(groups.router.length, 2);
      assert.strictEqual(groups.sync.length, 1);
    });
  });

  // =============================================================
  // REQ-006: 回滚准备
  // =============================================================

  describe('createRollbackPoint', () => {
    it('AC-016: should create backup automatically', () => {
      // 创建一个将被修改的测试文件
      const testFile = path.join(testDir, 'lib', 'test-file.js');
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'original content');

      const changes = [
        { type: CHANGE_TYPES.MODIFY, path: testFile }
      ];

      const rollbackInfo = createRollbackPoint(changes, 'test-rollback-001');

      assert.ok(rollbackInfo.flowId);
      assert.ok(rollbackInfo.createdAt);
      assert.ok(rollbackInfo.files.length > 0);
      assert.ok(fs.existsSync(rollbackInfo.files[0].backup));
    });

    it('AC-017: should generate rollback script', () => {
      const testFile = path.join(testDir, 'lib', 'modify.js');
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'content');

      const changes = [
        { type: CHANGE_TYPES.MODIFY, path: testFile },
        { type: CHANGE_TYPES.CREATE, path: 'lib/new-file.js' }
      ];

      const rollbackInfo = createRollbackPoint(changes, 'test-rollback-002');

      assert.ok(rollbackInfo.rollbackScript);
      assert.ok(fs.existsSync(rollbackInfo.rollbackScript));

      const scriptContent = fs.readFileSync(rollbackInfo.rollbackScript, 'utf-8');
      assert.ok(scriptContent.includes('#!/bin/bash'));
      assert.ok(scriptContent.includes('cp'));
    });
  });

  describe('executeRollback', () => {
    it('AC-018: should restore files from backup', () => {
      // 创建原始文件
      const testFile = path.join(testDir, 'lib', 'rollback-test.js');
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'original content');

      // 创建回滚点
      const changes = [{ type: CHANGE_TYPES.MODIFY, path: testFile }];
      createRollbackPoint(changes, 'test-rollback-003');

      // 模拟文件被修改
      fs.writeFileSync(testFile, 'modified content');
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), 'modified content');

      // 执行回滚
      const result = executeRollback('test-rollback-003');

      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), 'original content');
    });

    it('should handle non-existent rollback point', () => {
      const result = executeRollback('non-existent-flow');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('未找到'));
    });
  });

  // =============================================================
  // 辅助函数测试
  // =============================================================

  describe('extractModule', () => {
    it('should extract module from lib path', () => {
      assert.strictEqual(extractModule('lib/router/file.js'), 'router');
      assert.strictEqual(extractModule('lib/sync/task.js'), 'sync');
    });

    it('should extract module from src path', () => {
      assert.strictEqual(extractModule('src/auth/login.js'), 'auth');
    });

    it('should return root for top-level files', () => {
      assert.strictEqual(extractModule('index.js'), 'root');
    });
  });

  describe('isCoreFilePath', () => {
    it('should identify core files', () => {
      assert.strictEqual(isCoreFilePath('lib/core/engine.js'), true);
      assert.strictEqual(isCoreFilePath('config/settings.json'), true);
      assert.strictEqual(isCoreFilePath('src/index.js'), true);
      assert.strictEqual(isCoreFilePath('lib/main.js'), true);
    });

    it('should not flag non-core files', () => {
      assert.strictEqual(isCoreFilePath('lib/utils/helper.js'), false);
      assert.strictEqual(isCoreFilePath('test/sample.test.js'), false);
    });
  });

  describe('constants', () => {
    it('should export RISK_LEVELS', () => {
      assert.strictEqual(RISK_LEVELS.LOW, 'low');
      assert.strictEqual(RISK_LEVELS.MEDIUM, 'medium');
      assert.strictEqual(RISK_LEVELS.HIGH, 'high');
    });

    it('should export CHANGE_TYPES', () => {
      assert.strictEqual(CHANGE_TYPES.CREATE, 'create');
      assert.strictEqual(CHANGE_TYPES.MODIFY, 'modify');
      assert.strictEqual(CHANGE_TYPES.DELETE, 'delete');
    });

    it('should export USER_CHOICES', () => {
      assert.strictEqual(USER_CHOICES.CONFIRM, 'confirm');
      assert.strictEqual(USER_CHOICES.CANCEL, 'cancel');
    });

    it('should export DEFAULT_CONFIG', () => {
      assert.ok(DEFAULT_CONFIG.enabled);
      assert.strictEqual(DEFAULT_CONFIG.batchSize, 10);
      assert.ok(DEFAULT_CONFIG.highRiskConfirmPhrase);
    });
  });
});
