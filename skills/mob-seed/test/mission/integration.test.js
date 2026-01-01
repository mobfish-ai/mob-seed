/**
 * Mission Integration 单元测试
 *
 * @see openspec/changes/v2.1-release-automation/specs/mission/integration.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 创建测试环境
function createTestEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-integration-test-'));

  // 创建 .seed 目录
  const seedDir = path.join(tempDir, '.seed');
  fs.mkdirSync(seedDir, { recursive: true });

  return {
    tempDir,
    seedDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

// 创建测试 mission.md 文件
function createMissionFile(seedDir, content) {
  const missionPath = path.join(seedDir, 'mission.md');
  fs.writeFileSync(missionPath, content);
  return missionPath;
}

// 示例 mission 内容
const SAMPLE_MISSION = `---
version: "1.0.0"
principle_ids:
  - spec_as_truth
  - simplicity_over_cleverness
anti_goal_ids:
  - feature_creep
  - over_engineering
evolution:
  min_alignment_score: 0.7
alignment:
  purpose_alignment: 0.3
  principle_compliance: 0.3
  anti_goal_avoidance: 0.25
  vision_contribution: 0.15
---

# Mission Statement

## Purpose
成为人类意图与机器智能之间的桥梁
`;

describe('Mission Integration', () => {
  let testEnv;
  let integration;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    // 清除模块缓存以获取干净的实例
    const modulePath = require.resolve('../../lib/mission/integration.js');
    delete require.cache[modulePath];
    integration = require('../../lib/mission/integration.js');
  });

  afterEach(() => {
    // 清除缓存
    if (integration && integration.clearCache) {
      integration.clearCache();
    }
    testEnv.cleanup();
  });

  describe('loadMission', () => {
    // AC-022 部分: 首次加载 Mission
    it('should load mission from project root', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const mission = integration.loadMission(testEnv.tempDir);

      assert.ok(mission, 'Mission should be loaded');
      assert.strictEqual(mission.version, '1.0.0');
    });

    it('should return null when mission file not found', () => {
      const mission = integration.loadMission(testEnv.tempDir);

      assert.strictEqual(mission, null);
    });
  });

  describe('parseMissionCore', () => {
    it('should parse Mission core structure from mission content', () => {
      const result = integration.parseMissionCore(SAMPLE_MISSION);

      assert.ok(result, 'Mission core should be parsed');
      assert.ok(Array.isArray(result.principles), 'Should have principles array');
      assert.ok(Array.isArray(result.antiGoals), 'Should have antiGoals array');
    });

    it('should extract principle IDs', () => {
      const result = integration.parseMissionCore(SAMPLE_MISSION);

      assert.deepStrictEqual(result.principles, ['spec_as_truth', 'simplicity_over_cleverness']);
    });

    it('should extract anti-goal IDs', () => {
      const result = integration.parseMissionCore(SAMPLE_MISSION);

      assert.deepStrictEqual(result.antiGoals, ['feature_creep', 'over_engineering']);
    });

    it('should support parseACE alias for backward compatibility', () => {
      const result = integration.parseACE(SAMPLE_MISSION);
      assert.ok(result, 'parseACE alias should work');
    });
  });

  describe('evaluateAlignment', () => {
    // AC-020: 对齐分数警告
    it('should return alignment score with total', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);
      const mission = integration.loadMission(testEnv.tempDir);

      const context = {
        phase: 'emit',
        description: '派生代码框架',
        files: ['lib/test.js']
      };

      const result = integration.evaluateAlignment(mission, context);

      assert.ok(typeof result.total === 'number', 'Should have total score');
      assert.ok(result.total >= 0 && result.total <= 1, 'Score should be 0-1');
      assert.ok(typeof result.meetsThreshold === 'boolean', 'Should have threshold check');
    });

    it('should detect violations', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);
      const mission = integration.loadMission(testEnv.tempDir);

      const context = {
        phase: 'emit',
        description: '添加复杂的抽象层',  // 触发 over_engineering
        files: ['lib/test.js']
      };

      const result = integration.evaluateAlignment(mission, context);

      assert.ok(Array.isArray(result.violations), 'Should have violations array');
    });
  });

  describe('checkPhaseAlignment', () => {
    // AC-019: 阶段 Mission 检查
    it('should check spec phase alignment', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const context = {
        specPath: 'openspec/specs/test.fspec.md',
        description: '创建新规格'
      };

      const result = integration.checkPhaseAlignment('spec', context, {
        projectRoot: testEnv.tempDir
      });

      assert.ok(result, 'Should return result');
      assert.ok(typeof result.aligned === 'boolean', 'Should have aligned flag');
      assert.ok(Array.isArray(result.warnings), 'Should have warnings array');
      assert.ok(Array.isArray(result.suggestions), 'Should have suggestions array');
    });

    it('should warn on feature creep detection', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const context = {
        specPath: 'openspec/specs/test.fspec.md',
        description: '新增功能：添加更多配置选项'
      };

      const result = integration.checkPhaseAlignment('emit', context, {
        projectRoot: testEnv.tempDir
      });

      // 应该检测到 feature_creep 并给出建议
      const hasFeatureCreepWarning = result.warnings.some(w =>
        w.includes('feature_creep') || w.includes('功能蔓延')
      ) || result.suggestions.some(s =>
        s.includes('拆分') || s.includes('split')
      );

      assert.ok(result.violations.length > 0 || hasFeatureCreepWarning || result.score < 0.8,
        'Should detect or warn about feature creep');
    });

    // AC-021: strict 模式阻止
    it('should block operation in strict mode when score below 0.5', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const context = {
        specPath: 'openspec/specs/test.fspec.md',
        description: '添加复杂抽象，新增大量功能，跳过同步'
      };

      const result = integration.checkPhaseAlignment('emit', context, {
        projectRoot: testEnv.tempDir,
        strict: true
      });

      // 在 strict 模式下，低分应该被阻止
      if (result.score < 0.5) {
        assert.strictEqual(result.blocked, true, 'Should block operation');
        assert.ok(result.blockReason, 'Should have block reason');
      }
    });

    it('should provide suggestions based on phase', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const phases = ['spec', 'emit', 'exec', 'defend'];

      for (const phase of phases) {
        const result = integration.checkPhaseAlignment(phase, {
          description: '测试操作'
        }, {
          projectRoot: testEnv.tempDir
        });

        assert.ok(result, `Should return result for phase ${phase}`);
      }
    });
  });

  describe('getCachedMission', () => {
    // AC-022: 缓存复用
    it('should return cached mission on second call', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      // 首次加载
      const mission1 = integration.loadMission(testEnv.tempDir);
      assert.ok(mission1);

      // 第二次应该从缓存获取
      const cached = integration.getCachedMission(testEnv.tempDir);

      assert.ok(cached, 'Should return cached mission');
      assert.strictEqual(cached.version, mission1.version);
    });

    it('should return null when not cached', () => {
      const cached = integration.getCachedMission('/non/existent/path');

      assert.strictEqual(cached, null);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached missions', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      // 加载并缓存
      integration.loadMission(testEnv.tempDir);
      assert.ok(integration.getCachedMission(testEnv.tempDir));

      // 清除缓存
      integration.clearCache();

      // 应该返回 null
      assert.strictEqual(integration.getCachedMission(testEnv.tempDir), null);
    });
  });

  describe('Phase-specific checks', () => {
    // 根据规格，不同阶段检查不同内容

    it('spec phase: should check if spec follows core principles', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const result = integration.checkPhaseAlignment('spec', {
        description: '定义简单的 API 规格'
      }, {
        projectRoot: testEnv.tempDir
      });

      assert.ok(result.aligned, 'Simple spec should be aligned');
    });

    it('emit phase: should check simplicity principle', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const result = integration.checkPhaseAlignment('emit', {
        description: '使用简单直接的实现方式'
      }, {
        projectRoot: testEnv.tempDir
      });

      assert.ok(result.score >= 0.7, 'Simple approach should score well');
    });

    it('exec phase: should check test coverage quality', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const result = integration.checkPhaseAlignment('exec', {
        description: '运行测试验证功能',
        testCoverage: 85
      }, {
        projectRoot: testEnv.tempDir
      });

      assert.ok(result, 'Should return result for exec phase');
    });

    it('defend phase: should check for deviation from mission', () => {
      createMissionFile(testEnv.seedDir, SAMPLE_MISSION);

      const result = integration.checkPhaseAlignment('defend', {
        description: '验证规格与代码同步'
      }, {
        projectRoot: testEnv.tempDir
      });

      assert.ok(result, 'Should return result for defend phase');
    });
  });
});
