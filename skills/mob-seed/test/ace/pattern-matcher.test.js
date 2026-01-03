/**
 * ACE 模式匹配测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-matcher.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  // 单独匹配器
  matchTypeAggregation,
  matchSpecAggregation,
  matchTimeClustering,
  matchKeywordSimilarity,

  // 工具函数
  jaccardSimilarity,
  generateCandidate,

  // 类
  PatternMatcher,

  // 配置
  DEFAULT_CONFIG,
  loadConfig,
  createMatcher
} = require('../../lib/ace/pattern-matcher');

const { PATTERN_TYPES } = require('../../lib/ace/reflection');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pattern-test-'));
  fs.mkdirSync(path.join(testDir, '.seed'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 创建测试观察
function createTestObservation(id, overrides = {}) {
  return {
    id,
    type: 'test_failure',
    status: 'triaged',
    created: new Date().toISOString(),
    description: '测试描述',
    ...overrides
  };
}

// ============================================================================
// REQ-001: 类型聚合模式 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 类型聚合模式', () => {

  it('AC-001: matchTypeAggregation 函数存在', () => {
    assert.strictEqual(typeof matchTypeAggregation, 'function');
  });

  it('AC-002: 只处理 triaged 状态的观察', () => {
    const observations = [
      createTestObservation('obs-1', { status: 'triaged', type: 'test_failure' }),
      createTestObservation('obs-2', { status: 'raw', type: 'test_failure' }),
      createTestObservation('obs-3', { status: 'triaged', type: 'test_failure' }),
      createTestObservation('obs-4', { status: 'triaged', type: 'test_failure' })
    ];

    const candidates = matchTypeAggregation(observations, 3);

    // 只有 3 个 triaged，刚好满足阈值
    assert.strictEqual(candidates.length, 1, '应返回 1 个候选');
    assert.strictEqual(candidates[0].observations.length, 3, '应只包含 triaged 观察');
    assert.ok(!candidates[0].observations.includes('obs-2'), '不应包含 raw 观察');
  });

  it('AC-003: 同一 type 数量 >= 阈值触发候选', () => {
    const observations = [
      createTestObservation('obs-1', { type: 'test_failure' }),
      createTestObservation('obs-2', { type: 'test_failure' }),
      createTestObservation('obs-3', { type: 'test_failure' }),
      createTestObservation('obs-4', { type: 'spec_violation' })
    ];

    const candidates = matchTypeAggregation(observations, 3);

    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].pattern, PATTERN_TYPES.TYPE_AGGREGATION);
    assert.strictEqual(candidates[0].metadata.type, 'test_failure');
  });

  it('AC-004: 返回 ReflectionCandidate 结构', () => {
    const observations = [
      createTestObservation('obs-1', { type: 'test_failure' }),
      createTestObservation('obs-2', { type: 'test_failure' }),
      createTestObservation('obs-3', { type: 'test_failure' })
    ];

    const candidates = matchTypeAggregation(observations, 3);

    assert.strictEqual(candidates.length, 1);
    const candidate = candidates[0];

    assert.ok(candidate.pattern, '应有 pattern');
    assert.ok(candidate.observations, '应有 observations');
    assert.ok(typeof candidate.confidence === 'number', '应有 confidence');
    assert.ok(candidate.suggestedLesson, '应有 suggestedLesson');
    assert.ok(candidate.suggestedActions, '应有 suggestedActions');
    assert.ok(candidate.metadata, '应有 metadata');
  });

  it('AC-004b: 数量不足不触发候选', () => {
    const observations = [
      createTestObservation('obs-1', { type: 'test_failure' }),
      createTestObservation('obs-2', { type: 'test_failure' })
    ];

    const candidates = matchTypeAggregation(observations, 3);
    assert.strictEqual(candidates.length, 0);
  });
});

// ============================================================================
// REQ-002: 规格聚合模式 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 规格聚合模式', () => {

  it('AC-005: matchSpecAggregation 函数存在', () => {
    assert.strictEqual(typeof matchSpecAggregation, 'function');
  });

  it('AC-006: 按 related_spec 字段分组', () => {
    const observations = [
      createTestObservation('obs-1', { spec: 'spec-a.fspec.md' }),
      createTestObservation('obs-2', { spec: 'spec-a.fspec.md' }),
      createTestObservation('obs-3', { spec: 'spec-b.fspec.md' })
    ];

    const candidates = matchSpecAggregation(observations, 2);

    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].metadata.spec, 'spec-a.fspec.md');
    assert.strictEqual(candidates[0].observations.length, 2);
  });

  it('AC-007: 同一规格数量 >= 阈值触发候选', () => {
    const observations = [
      createTestObservation('obs-1', { related_spec: 'module/feature.fspec.md' }),
      createTestObservation('obs-2', { related_spec: 'module/feature.fspec.md' }),
      createTestObservation('obs-3', { related_spec: 'other/other.fspec.md' })
    ];

    const candidates = matchSpecAggregation(observations, 2);

    assert.strictEqual(candidates.length, 1);
    assert.ok(candidates[0].metadata.spec.includes('feature.fspec.md'));
  });

  it('AC-008: 返回正确结构', () => {
    const observations = [
      createTestObservation('obs-1', { spec: 'test.fspec.md' }),
      createTestObservation('obs-2', { spec: 'test.fspec.md' })
    ];

    const candidates = matchSpecAggregation(observations, 2);

    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].pattern, PATTERN_TYPES.SPEC_AGGREGATION);
    assert.ok(candidates[0].suggestedLesson.includes('规格'));
  });

  it('AC-008b: 支持 context.file 作为规格来源', () => {
    const observations = [
      createTestObservation('obs-1', { context: { file: 'lib/module.js' } }),
      createTestObservation('obs-2', { context: { file: 'lib/module.js' } })
    ];

    const candidates = matchSpecAggregation(observations, 2);

    assert.strictEqual(candidates.length, 1);
    assert.ok(candidates[0].metadata.spec.includes('module.js'));
  });
});

// ============================================================================
// REQ-003: 时间窗口聚合模式 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: 时间窗口聚合模式', () => {

  it('AC-009: matchTimeClustering 函数存在', () => {
    assert.strictEqual(typeof matchTimeClustering, 'function');
  });

  it('AC-010: 按模块分组', () => {
    const now = new Date();
    const observations = [
      createTestObservation('obs-1', {
        context: { file: 'lib/moduleA.js' },
        created: now.toISOString()
      }),
      createTestObservation('obs-2', {
        context: { file: 'lib/moduleA.js' },
        created: new Date(now.getTime() + 1000).toISOString()
      }),
      createTestObservation('obs-3', {
        context: { file: 'lib/moduleB.js' },
        created: now.toISOString()
      })
    ];

    const candidates = matchTimeClustering(observations, 24, 2);

    // 只有 moduleA 有 2 个观察
    assert.ok(candidates.length >= 1, '应返回至少 1 个候选');
    assert.ok(
      candidates.some(c => c.metadata.module.includes('moduleA')),
      '应包含 moduleA 的候选'
    );
  });

  it('AC-011: 在时间窗口内聚合', () => {
    const now = new Date();
    const observations = [
      createTestObservation('obs-1', {
        context: { file: 'lib/module.js' },
        created: now.toISOString()
      }),
      createTestObservation('obs-2', {
        context: { file: 'lib/module.js' },
        created: new Date(now.getTime() + 3600000).toISOString() // 1小时后
      }),
      createTestObservation('obs-3', {
        context: { file: 'lib/module.js' },
        created: new Date(now.getTime() + 86400000 * 2).toISOString() // 2天后
      })
    ];

    // 24小时窗口应该包含前 2 个
    const candidates = matchTimeClustering(observations, 24, 2);

    assert.ok(candidates.length >= 1, '应返回候选');
    const candidate = candidates[0];
    assert.ok(candidate.observations.includes('obs-1'));
    assert.ok(candidate.observations.includes('obs-2'));
  });

  it('AC-012: 返回正确结构', () => {
    const now = new Date();
    const observations = [
      createTestObservation('obs-1', {
        context: { file: 'lib/module.js' },
        created: now.toISOString()
      }),
      createTestObservation('obs-2', {
        context: { file: 'lib/module.js' },
        created: now.toISOString()
      })
    ];

    const candidates = matchTimeClustering(observations, 24, 2);

    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].pattern, PATTERN_TYPES.TIME_CLUSTERING);
    assert.ok(candidates[0].metadata.windowHours, '应有 windowHours');
  });
});

// ============================================================================
// REQ-004: 关键词相似度模式 (AC-013 ~ AC-016)
// ============================================================================

describe('REQ-004: 关键词相似度模式', () => {

  it('AC-013: matchKeywordSimilarity 函数存在', () => {
    assert.strictEqual(typeof matchKeywordSimilarity, 'function');
  });

  it('AC-014: jaccardSimilarity 计算相似度', () => {
    const sim1 = jaccardSimilarity('hello world test', 'hello world example');
    const sim2 = jaccardSimilarity('abc def', 'xyz uvw');
    const sim3 = jaccardSimilarity('same text', 'same text');

    assert.ok(sim1 > 0 && sim1 < 1, '部分相同应有中等相似度');
    assert.strictEqual(sim2, 0, '完全不同应为 0');
    assert.strictEqual(sim3, 1, '完全相同应为 1');
  });

  it('AC-015: 相似度 >= 阈值触发候选', () => {
    const observations = [
      createTestObservation('obs-1', { description: 'test failure in module A' }),
      createTestObservation('obs-2', { description: 'test failure in module B' }),
      createTestObservation('obs-3', { description: 'completely different issue' })
    ];

    const candidates = matchKeywordSimilarity(observations, 0.5);

    // obs-1 和 obs-2 应该相似
    const relatedCandidate = candidates.find(c =>
      c.observations.includes('obs-1') && c.observations.includes('obs-2')
    );

    assert.ok(relatedCandidate, '应找到相似的观察组');
  });

  it('AC-016: 返回正确结构', () => {
    const observations = [
      createTestObservation('obs-1', { description: 'error in function foo' }),
      createTestObservation('obs-2', { description: 'error in function bar' })
    ];

    const candidates = matchKeywordSimilarity(observations, 0.3);

    if (candidates.length > 0) {
      assert.strictEqual(candidates[0].pattern, PATTERN_TYPES.KEYWORD_SIMILARITY);
      assert.ok(candidates[0].metadata.keywords, '应有 keywords');
    }
  });

  it('AC-016b: 空文本返回 0 相似度', () => {
    const sim1 = jaccardSimilarity('', 'hello');
    const sim2 = jaccardSimilarity('hello', '');
    const sim3 = jaccardSimilarity('', '');

    assert.strictEqual(sim1, 0);
    assert.strictEqual(sim2, 0);
    assert.strictEqual(sim3, 0);
  });
});

// ============================================================================
// REQ-005: 组合模式匹配 (AC-017 ~ AC-020)
// ============================================================================

describe('REQ-005: 组合模式匹配', () => {

  it('AC-017: PatternMatcher 类存在', () => {
    const matcher = new PatternMatcher();
    assert.ok(matcher instanceof PatternMatcher);
  });

  it('AC-018: runAllPatterns 执行所有匹配器', () => {
    const matcher = new PatternMatcher();
    const observations = [
      createTestObservation('obs-1', { type: 'test_failure' }),
      createTestObservation('obs-2', { type: 'test_failure' }),
      createTestObservation('obs-3', { type: 'test_failure' })
    ];

    const candidates = matcher.runAllPatterns(observations);

    // 应该至少返回类型聚合匹配
    assert.ok(Array.isArray(candidates), '应返回数组');
  });

  it('AC-019: 去除重复的匹配结果', () => {
    const matcher = new PatternMatcher();

    const candidates = [
      { pattern: 'a', observations: ['obs-1', 'obs-2'], confidence: 0.8 },
      { pattern: 'b', observations: ['obs-2', 'obs-1'], confidence: 0.6 } // 相同观察集
    ];

    const deduplicated = matcher.deduplicateCandidates(candidates);

    assert.strictEqual(deduplicated.length, 1, '应去重');
    assert.strictEqual(deduplicated[0].confidence, 0.8, '应保留高置信度');
  });

  it('AC-020: 按置信度排序', () => {
    const matcher = new PatternMatcher({
      thresholds: { same_type: 2, same_spec: 2 }
    });

    const observations = [
      createTestObservation('obs-1', { type: 'test_failure', spec: 'spec-a.md' }),
      createTestObservation('obs-2', { type: 'test_failure', spec: 'spec-a.md' }),
      createTestObservation('obs-3', { type: 'test_failure', spec: 'spec-a.md' }),
      createTestObservation('obs-4', { type: 'test_failure', spec: 'spec-a.md' })
    ];

    const candidates = matcher.runAllPatterns(observations);

    // 验证按置信度降序
    for (let i = 1; i < candidates.length; i++) {
      assert.ok(
        candidates[i - 1].confidence >= candidates[i].confidence,
        '应按置信度降序排序'
      );
    }
  });

  it('AC-020b: runPatterns 只运行指定模式', () => {
    const matcher = new PatternMatcher({
      thresholds: { same_type: 2, same_spec: 2 }
    });

    const observations = [
      createTestObservation('obs-1', { type: 'test_failure', spec: 'spec-a.md' }),
      createTestObservation('obs-2', { type: 'test_failure', spec: 'spec-a.md' })
    ];

    const candidates = matcher.runPatterns(observations, [PATTERN_TYPES.TYPE_AGGREGATION]);

    // 只应返回类型聚合
    assert.ok(candidates.every(c => c.pattern === PATTERN_TYPES.TYPE_AGGREGATION));
  });
});

// ============================================================================
// REQ-006: 反思建议生成 (AC-021 ~ AC-024)
// ============================================================================

describe('REQ-006: 反思建议生成', () => {

  it('AC-021: generateCandidate 函数存在', () => {
    assert.strictEqual(typeof generateCandidate, 'function');
  });

  it('AC-022: 生成建议的教训描述', () => {
    const candidate = generateCandidate(
      PATTERN_TYPES.TYPE_AGGREGATION,
      ['obs-1', 'obs-2', 'obs-3'],
      { type: 'test_failure', count: 3 }
    );

    assert.ok(candidate.suggestedLesson, '应有 suggestedLesson');
    assert.ok(candidate.suggestedLesson.includes('test_failure'), '应包含类型信息');
  });

  it('AC-023: 生成建议的行动列表', () => {
    const candidate = generateCandidate(
      PATTERN_TYPES.SPEC_AGGREGATION,
      ['obs-1', 'obs-2'],
      { spec: 'test.fspec.md', count: 2 }
    );

    assert.ok(Array.isArray(candidate.suggestedActions), '应有 suggestedActions');
    assert.ok(candidate.suggestedActions.length > 0, '应有建议行动');
  });

  it('AC-024: 置信度基于观察数量', () => {
    const candidate1 = generateCandidate(
      PATTERN_TYPES.TYPE_AGGREGATION,
      ['obs-1', 'obs-2'],
      { type: 'test', count: 2 }
    );

    const candidate2 = generateCandidate(
      PATTERN_TYPES.TYPE_AGGREGATION,
      ['obs-1', 'obs-2', 'obs-3', 'obs-4', 'obs-5'],
      { type: 'test', count: 5 }
    );

    assert.ok(candidate2.confidence > candidate1.confidence, '更多观察应有更高置信度');
    assert.ok(candidate2.confidence <= 1, '置信度不应超过 1');
  });
});

// ============================================================================
// REQ-007: 配置加载 (AC-025 ~ AC-027)
// ============================================================================

describe('REQ-007: 配置加载', () => {

  it('AC-025: loadConfig 从配置文件加载', () => {
    setupTestDir();
    try {
      const configPath = path.join(testDir, '.seed', 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        ace: {
          reflect: {
            thresholds: {
              same_type: 5,
              same_spec: 3
            }
          }
        }
      }));

      const config = loadConfig(testDir);

      assert.strictEqual(config.thresholds.same_type, 5);
      assert.strictEqual(config.thresholds.same_spec, 3);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-026: 配置缺失时使用默认值', () => {
    setupTestDir();
    try {
      const config = loadConfig(testDir);

      assert.strictEqual(config.thresholds.same_type, DEFAULT_CONFIG.thresholds.same_type);
      assert.strictEqual(config.thresholds.same_spec, DEFAULT_CONFIG.thresholds.same_spec);
      assert.strictEqual(
        config.thresholds.time_window_hours,
        DEFAULT_CONFIG.thresholds.time_window_hours
      );
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-027: createMatcher 创建配置化匹配器', () => {
    setupTestDir();
    try {
      const matcher = createMatcher(testDir, {
        thresholds: { same_type: 10 }
      });

      assert.ok(matcher instanceof PatternMatcher);
      assert.strictEqual(matcher.config.thresholds.same_type, 10);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-027b: 运行时覆盖优先于配置文件', () => {
    setupTestDir();
    try {
      const configPath = path.join(testDir, '.seed', 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        ace: {
          reflect: {
            thresholds: { same_type: 5 }
          }
        }
      }));

      const matcher = createMatcher(testDir, {
        thresholds: { same_type: 20 }
      });

      assert.strictEqual(matcher.config.thresholds.same_type, 20);
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// 默认配置测试
// ============================================================================

describe('默认配置', () => {

  it('DEFAULT_CONFIG 包含所有必要阈值', () => {
    assert.ok(DEFAULT_CONFIG.thresholds, '应有 thresholds');
    assert.ok(typeof DEFAULT_CONFIG.thresholds.same_type === 'number');
    assert.ok(typeof DEFAULT_CONFIG.thresholds.same_spec === 'number');
    assert.ok(typeof DEFAULT_CONFIG.thresholds.time_window_hours === 'number');
    assert.ok(typeof DEFAULT_CONFIG.thresholds.keyword_similarity === 'number');
  });
});
