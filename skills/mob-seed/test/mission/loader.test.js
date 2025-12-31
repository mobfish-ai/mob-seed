/**
 * Mission Loader 测试
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  parseYaml,
  parseValue,
  findMissionPath,
  loadMission,
  validateMission,
  evaluateAlignment,
  requiresHumanReview,
  canAutoApply,
  getMissionSummary
} = require('../../lib/mission/loader');

// 测试用临时目录
const TEST_DIR = path.join(__dirname, '../fixtures/mission-test');

describe('Mission Loader', () => {
  before(() => {
    // 创建测试目录
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, '.seed'), { recursive: true });
  });

  after(() => {
    // 清理测试目录
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('parseValue', () => {
    it('should parse boolean true', () => {
      assert.strictEqual(parseValue('true'), true);
    });

    it('should parse boolean false', () => {
      assert.strictEqual(parseValue('false'), false);
    });

    it('should parse null', () => {
      assert.strictEqual(parseValue('null'), null);
    });

    it('should parse integers', () => {
      assert.strictEqual(parseValue('42'), 42);
      assert.strictEqual(parseValue('0'), 0);
    });

    it('should parse floats', () => {
      assert.strictEqual(parseValue('3.14'), 3.14);
      assert.strictEqual(parseValue('0.7'), 0.7);
    });

    it('should parse quoted strings', () => {
      assert.strictEqual(parseValue('"hello"'), 'hello');
      assert.strictEqual(parseValue("'world'"), 'world');
    });

    it('should keep plain strings as-is', () => {
      assert.strictEqual(parseValue('hello'), 'hello');
    });
  });

  describe('parseYaml', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = 'name: test\nversion: 1.0.0';
      const result = parseYaml(yaml);
      assert.strictEqual(result.name, 'test');
      assert.strictEqual(result.version, '1.0.0');
    });

    it('should parse nested objects', () => {
      const yaml = `
purpose:
  statement: Test mission
  essence: Test essence
`;
      const result = parseYaml(yaml);
      assert.strictEqual(result.purpose.statement, 'Test mission');
      assert.strictEqual(result.purpose.essence, 'Test essence');
    });

    it('should skip comments', () => {
      const yaml = `
# This is a comment
name: test
# Another comment
value: 42
`;
      const result = parseYaml(yaml);
      assert.strictEqual(result.name, 'test');
      assert.strictEqual(result.value, 42);
    });
  });

  describe('findMissionPath', () => {
    it('should find .seed/mission.yaml', () => {
      const missionPath = path.join(TEST_DIR, '.seed/mission.yaml');
      fs.writeFileSync(missionPath, 'purpose:\n  statement: Test');

      const found = findMissionPath(TEST_DIR);
      assert.strictEqual(found, missionPath);
    });

    it('should return null when no mission file exists', () => {
      const emptyDir = path.join(TEST_DIR, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      const found = findMissionPath(emptyDir);
      assert.strictEqual(found, null);

      fs.rmdirSync(emptyDir);
    });
  });

  describe('loadMission', () => {
    it('should load mission from file', () => {
      const missionPath = path.join(TEST_DIR, '.seed/mission.yaml');
      fs.writeFileSync(missionPath, `
purpose:
  statement: Test mission statement
principles:
  - id: test_principle
    name: Test Principle
    description: A test principle
anti_goals:
  - id: test_anti
    name: Test Anti-Goal
    description: A test anti-goal
`);

      const mission = loadMission({ startDir: TEST_DIR });
      assert.ok(mission);
      assert.strictEqual(mission.purpose.statement, 'Test mission statement');
      assert.ok(mission._meta);
      assert.ok(mission._meta.loadedAt);
    });

    it('should return null for non-existent file', () => {
      const mission = loadMission({ missionPath: '/non/existent/path.yaml' });
      assert.strictEqual(mission, null);
    });
  });

  describe('validateMission', () => {
    it('should validate valid mission', () => {
      const mission = {
        purpose: { statement: 'Test' },
        principles: [{ id: 'test', name: 'Test', description: 'Test' }],
        anti_goals: [{ id: 'test', name: 'Test', description: 'Test' }]
      };

      const result = validateMission(mission);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject missing purpose', () => {
      const mission = {
        principles: [{ id: 'test', name: 'Test', description: 'Test' }],
        anti_goals: [{ id: 'test', name: 'Test', description: 'Test' }]
      };

      const result = validateMission(mission);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('purpose')));
    });

    it('should reject empty principles', () => {
      const mission = {
        purpose: { statement: 'Test' },
        principles: [],
        anti_goals: [{ id: 'test', name: 'Test', description: 'Test' }]
      };

      const result = validateMission(mission);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('principles')));
    });

    it('should warn about missing optional fields', () => {
      const mission = {
        purpose: { statement: 'Test' },
        principles: [{ id: 'test', name: 'Test', description: 'Test' }],
        anti_goals: [{ id: 'test', name: 'Test', description: 'Test' }]
      };

      const result = validateMission(mission);
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings.some(w => w.includes('vision')));
    });

    it('should validate principle id format', () => {
      const mission = {
        purpose: { statement: 'Test' },
        principles: [{ id: 'Invalid-ID', name: 'Test', description: 'Test' }],
        anti_goals: [{ id: 'test', name: 'Test', description: 'Test' }]
      };

      const result = validateMission(mission);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('snake_case')));
    });
  });

  describe('evaluateAlignment', () => {
    const mission = {
      purpose: { statement: '规格驱动开发' },
      principles: [
        { id: 'simplicity', name: '简单', description: '保持简单' }
      ],
      anti_goals: [
        { id: 'feature_creep', name: '功能蔓延', description: '不添加多余功能' }
      ],
      evolution: {
        decision_criteria: {
          min_alignment_score: 0.7
        }
      }
    };

    it('should return alignment score', () => {
      const change = { description: '更新规格同步逻辑' };
      const score = evaluateAlignment(mission, change);

      assert.ok(score.total >= 0 && score.total <= 1);
      assert.ok(score.breakdown.purpose_alignment !== undefined);
      assert.ok(typeof score.meetsThreshold === 'boolean');
    });

    it('should detect anti-goal violations', () => {
      const change = { description: '新增功能：添加自动化功能' };
      const score = evaluateAlignment(mission, change);

      assert.ok(score.violations.includes('feature_creep'));
    });

    it('should give higher score for aligned changes', () => {
      const alignedChange = { description: '简单重构规格解析器' };
      const unalignedChange = { description: '添加复杂的抽象层' };

      const alignedScore = evaluateAlignment(mission, alignedChange);
      const unalignedScore = evaluateAlignment(mission, unalignedChange);

      assert.ok(alignedScore.total >= unalignedScore.total);
    });
  });

  describe('requiresHumanReview', () => {
    it('should require review for refactor by default', () => {
      const mission = {};
      assert.strictEqual(requiresHumanReview(mission, 'refactor'), true);
    });

    it('should not require review for document by default', () => {
      const mission = {};
      assert.strictEqual(requiresHumanReview(mission, 'document'), false);
    });

    it('should respect custom configuration', () => {
      const mission = {
        evolution: {
          decision_criteria: {
            human_review_required: ['test']
          }
        }
      };

      assert.strictEqual(requiresHumanReview(mission, 'test'), true);
      assert.strictEqual(requiresHumanReview(mission, 'refactor'), false);
    });
  });

  describe('canAutoApply', () => {
    it('should allow auto-apply for configured scopes', () => {
      const mission = {
        evolution: {
          allowed_scopes: [
            { id: 'document', name: '文档', auto_apply: true },
            { id: 'refactor', name: '重构', auto_apply: false }
          ]
        }
      };

      const goodScore = { total: 0.9, violations: [] };

      assert.strictEqual(canAutoApply(mission, 'document', goodScore), true);
      assert.strictEqual(canAutoApply(mission, 'refactor', goodScore), false);
    });

    it('should reject auto-apply on anti-goal violations', () => {
      const mission = {
        evolution: {
          allowed_scopes: [{ id: 'document', auto_apply: true }],
          decision_criteria: {
            auto_apply_conditions: [{ no_anti_goal_violation: true }]
          }
        }
      };

      const scoreWithViolation = { total: 0.9, violations: ['feature_creep'] };
      assert.strictEqual(canAutoApply(mission, 'document', scoreWithViolation), false);
    });
  });

  describe('getMissionSummary', () => {
    it('should generate readable summary in English by default', () => {
      const mission = {
        purpose: { statement: 'Test mission' },
        principles: [{ id: 'test', name: 'Test Principle', description: 'Test desc' }],
        anti_goals: [{ id: 'test_anti', name: 'Test Anti', description: 'Anti desc' }]
      };

      const summary = getMissionSummary(mission);

      assert.ok(summary.includes('## Mission'));
      assert.ok(summary.includes('Test mission'));
      assert.ok(summary.includes('## Core Principles'));
      assert.ok(summary.includes('Test Principle'));
      assert.ok(summary.includes('## Anti-Goals'));
      assert.ok(summary.includes('Test Anti'));
    });

    it('should generate readable summary in Chinese', () => {
      const mission = {
        purpose: { statement: { en: 'Test mission', zh: '测试使命' } },
        principles: [{ id: 'test', name: { en: 'Test', zh: '测试原则' }, description: { en: 'Test desc', zh: '测试描述' } }],
        anti_goals: [{ id: 'test_anti', name: { en: 'Test Anti', zh: '测试反目标' }, description: { en: 'Anti desc', zh: '反目标描述' } }]
      };

      const summary = getMissionSummary(mission, 'zh');

      assert.ok(summary.includes('## 使命'));
      assert.ok(summary.includes('测试使命'));
      assert.ok(summary.includes('## 核心原则'));
      assert.ok(summary.includes('测试原则'));
      assert.ok(summary.includes('## 反目标'));
      assert.ok(summary.includes('测试反目标'));
    });

    it('should handle null mission in English', () => {
      const summary = getMissionSummary(null);
      assert.ok(summary.includes('Mission Statement not found'));
    });

    it('should handle null mission in Chinese', () => {
      const summary = getMissionSummary(null, 'zh');
      assert.ok(summary.includes('未找到'));
    });
  });

  describe('getLocalizedValue', () => {
    const { getLocalizedValue } = require('../../lib/mission/loader');

    it('should return empty string for null/undefined', () => {
      assert.strictEqual(getLocalizedValue(null), '');
      assert.strictEqual(getLocalizedValue(undefined), '');
    });

    it('should return string as-is', () => {
      assert.strictEqual(getLocalizedValue('hello'), 'hello');
    });

    it('should extract English from bilingual object', () => {
      const field = { en: 'English', zh: '中文' };
      assert.strictEqual(getLocalizedValue(field, 'en'), 'English');
    });

    it('should extract Chinese from bilingual object', () => {
      const field = { en: 'English', zh: '中文' };
      assert.strictEqual(getLocalizedValue(field, 'zh'), '中文');
    });

    it('should fallback to English if language not found', () => {
      const field = { en: 'English only' };
      assert.strictEqual(getLocalizedValue(field, 'zh'), 'English only');
    });
  });

  describe('getLocalizedArray', () => {
    const { getLocalizedArray } = require('../../lib/mission/loader');

    it('should return empty array for null/undefined', () => {
      assert.deepStrictEqual(getLocalizedArray(null), []);
      assert.deepStrictEqual(getLocalizedArray(undefined), []);
    });

    it('should return array as-is', () => {
      assert.deepStrictEqual(getLocalizedArray(['a', 'b']), ['a', 'b']);
    });

    it('should extract English array from bilingual object', () => {
      const field = { en: ['one', 'two'], zh: ['一', '二'] };
      assert.deepStrictEqual(getLocalizedArray(field, 'en'), ['one', 'two']);
    });

    it('should extract Chinese array from bilingual object', () => {
      const field = { en: ['one', 'two'], zh: ['一', '二'] };
      assert.deepStrictEqual(getLocalizedArray(field, 'zh'), ['一', '二']);
    });
  });
});
