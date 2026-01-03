/**
 * 历史模式学习测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md
 *
 * 测试覆盖:
 * - REQ-001: 历史数据收集 (AC-001 ~ AC-004)
 * - REQ-002: 模式特征提取 (AC-005 ~ AC-009)
 * - REQ-003: 相似度匹配 (AC-010 ~ AC-013)
 * - REQ-004: 历史建议增强 (AC-014 ~ AC-017)
 * - REQ-005: 反馈闭环 (AC-018 ~ AC-021)
 * - REQ-006: 学习数据管理 (AC-022 ~ AC-025)
 * - REQ-007: 学习统计 (AC-026 ~ AC-029)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 测试模块
const {
  extractFeatures,
  extractFeaturesFromAll,
  aggregateFeatures,
  extractType,
  extractModule,
  extractErrorType,
  extractKeywords,
  calculateTimeCluster,
  calculateTimeDensity
} = require('../../lib/ace/feature-extractor');

const {
  matchHistoricalPatterns,
  findBestMatch,
  calculateSimilarity,
  jaccardSimilarity,
  hasTypeOverlap,
  hasModuleOverlap,
  hasErrorTypeOverlap
} = require('../../lib/ace/similarity-matcher');

const {
  FeedbackCollector,
  checkRecurrence,
  generateFeedbackPrompt,
  parseFeedbackChoice,
  EFFECTIVENESS_OPTIONS
} = require('../../lib/ace/feedback-collector');

const {
  PatternLearner,
  formatHistoricalReference
} = require('../../lib/ace/pattern-learner');

// ============================================================================
// REQ-002: 模式特征提取 (AC-005 ~ AC-009)
// ============================================================================

describe('REQ-002: 模式特征提取', () => {
  describe('AC-005: 提取类型特征', () => {
    it('should extract type from observation', () => {
      assert.strictEqual(extractType({ type: 'test_failure' }), 'test_failure');
      assert.strictEqual(extractType({ type: 'spec_drift' }), 'spec_drift');
      assert.strictEqual(extractType({ type: 'coverage_gap' }), 'coverage_gap');
    });

    it('should infer type from context', () => {
      assert.strictEqual(
        extractType({ context: { test_name: 'test_foo' } }),
        'test_failure'
      );
      assert.strictEqual(
        extractType({ context: { spec_file: 'parser.fspec.md' } }),
        'spec_drift'
      );
    });

    it('should return general for unknown type', () => {
      assert.strictEqual(extractType({}), 'general');
      assert.strictEqual(extractType(null), 'unknown');
    });
  });

  describe('AC-006: 提取模块特征', () => {
    it('should extract module from file path', () => {
      assert.strictEqual(extractModule('lib/parser/core.js'), 'lib/parser');
      assert.strictEqual(extractModule('src/components/Button.tsx'), 'src/components');
      assert.strictEqual(extractModule('test/unit/parser.test.js'), 'test/unit');
    });

    it('should handle short paths', () => {
      assert.strictEqual(extractModule('file.js'), 'root');
      assert.strictEqual(extractModule('dir/file.js'), 'dir');
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(extractModule(null), 'unknown');
      assert.strictEqual(extractModule(undefined), 'unknown');
    });
  });

  describe('AC-007: 提取错误类型特征', () => {
    it('should extract JavaScript error types', () => {
      // 注意：含有具体模式的会优先匹配根因（如 'cannot read property' → NullError）
      // 纯粹的类型名只有在无具体模式时才返回
      assert.strictEqual(extractErrorType('TypeError: value is invalid'), 'TypeError');
      assert.strictEqual(extractErrorType('ReferenceError: x is not defined'), 'ReferenceError');
      assert.strictEqual(extractErrorType('SyntaxError: unexpected token'), 'SyntaxError');
    });

    it('should detect null/undefined errors', () => {
      assert.strictEqual(extractErrorType('Cannot read property of null'), 'NullError');
      assert.strictEqual(extractErrorType('value is undefined'), 'NullError');
    });

    it('should detect common error patterns', () => {
      assert.strictEqual(extractErrorType('connection timeout'), 'TimeoutError');
      assert.strictEqual(extractErrorType('ENOENT: file not found'), 'NotFoundError');
      assert.strictEqual(extractErrorType('AssertionError: expected true'), 'AssertionError');
    });

    it('should handle null input', () => {
      assert.strictEqual(extractErrorType(null), null);
      assert.strictEqual(extractErrorType(''), null);
    });
  });

  describe('AC-008: 提取关键词特征', () => {
    it('should extract meaningful keywords', () => {
      const keywords = extractKeywords('Failed to parse JSON response from API');
      assert.ok(keywords.includes('failed'));
      assert.ok(keywords.includes('parse'));
      assert.ok(keywords.includes('json'));
      assert.ok(keywords.includes('response'));
    });

    it('should filter stop words', () => {
      const keywords = extractKeywords('The parser is not working as expected');
      assert.ok(!keywords.includes('the'));
      assert.ok(!keywords.includes('is'));
      assert.ok(!keywords.includes('as'));
      assert.ok(keywords.includes('parser'));
      assert.ok(keywords.includes('working'));
    });

    it('should limit keyword count', () => {
      const longText = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
      const keywords = extractKeywords(longText);
      assert.ok(keywords.length <= 10);
    });

    it('should deduplicate keywords', () => {
      const keywords = extractKeywords('error error error different error');
      const errorCount = keywords.filter(k => k === 'error').length;
      assert.strictEqual(errorCount, 1);
    });
  });

  describe('AC-009: 计算时间聚类特征', () => {
    it('should return date string for valid timestamp', () => {
      const cluster = calculateTimeCluster('2024-01-15T10:30:00Z');
      assert.strictEqual(cluster, '2024-01-15');
    });

    it('should handle Date object', () => {
      const cluster = calculateTimeCluster(new Date('2024-06-20'));
      assert.strictEqual(cluster, '2024-06-20');
    });

    it('should return unknown for invalid input', () => {
      assert.strictEqual(calculateTimeCluster(null), 'unknown');
      assert.strictEqual(calculateTimeCluster('invalid'), 'unknown');
    });
  });

  describe('Time density calculation', () => {
    it('should detect dense observations', () => {
      const clusters = ['2024-01-15', '2024-01-15', '2024-01-16'];
      assert.strictEqual(calculateTimeDensity(clusters), 'dense');
    });

    it('should detect sparse observations', () => {
      const clusters = ['2024-01-01', '2024-01-10', '2024-01-20'];
      assert.strictEqual(calculateTimeDensity(clusters), 'sparse');
    });

    it('should handle single observation', () => {
      assert.strictEqual(calculateTimeDensity(['2024-01-15']), 'single');
      assert.strictEqual(calculateTimeDensity([]), 'single');
    });
  });

  describe('Feature extraction integration', () => {
    it('should extract all features from observation', () => {
      const observation = {
        type: 'test_failure',
        context: {
          file: 'lib/parser/core.js',
          error_message: 'TypeError: null is not iterable'
        },
        description: 'Failed to iterate over null array',
        created: '2024-01-15T10:00:00Z',
        related_spec: 'parser.fspec.md'
      };

      const features = extractFeatures(observation);

      assert.strictEqual(features.type, 'test_failure');
      assert.strictEqual(features.module, 'lib/parser');
      assert.strictEqual(features.errorType, 'NullError');
      assert.ok(features.keywords.includes('failed'));
      assert.strictEqual(features.timeCluster, '2024-01-15');
      assert.strictEqual(features.spec, 'parser.fspec.md');
    });

    it('should aggregate features from multiple observations', () => {
      const observations = [
        { type: 'test_failure', description: 'null error' },
        { type: 'test_failure', description: 'undefined error' },
        { type: 'spec_drift', description: 'spec mismatch' }
      ];

      const features = extractFeaturesFromAll(observations);
      const aggregated = aggregateFeatures(features);

      assert.strictEqual(aggregated.types[0], 'test_failure');  // Most common
      assert.ok(aggregated.keywords.length > 0);
    });
  });
});

// ============================================================================
// REQ-003: 相似度匹配 (AC-010 ~ AC-013)
// ============================================================================

describe('REQ-003: 相似度匹配', () => {
  describe('AC-010: 实现特征相似度计算', () => {
    it('should calculate Jaccard similarity', () => {
      assert.strictEqual(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
      assert.strictEqual(jaccardSimilarity(['a', 'b'], ['c', 'd']), 0);
      assert.strictEqual(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b']), 2 / 3);
    });

    it('should handle empty arrays', () => {
      assert.strictEqual(jaccardSimilarity([], []), 1);
      assert.strictEqual(jaccardSimilarity(['a'], []), 0);
    });
  });

  describe('AC-011: 支持多维度加权匹配', () => {
    it('should calculate weighted similarity', () => {
      const current = {
        types: ['test_failure'],
        keywords: ['null', 'error'],
        modules: ['lib/parser'],
        errorTypes: ['NullError']
      };

      const historical = {
        types: ['test_failure'],
        keywords: ['null', 'undefined'],
        modules: ['lib/parser'],
        errorTypes: ['NullError']
      };

      const similarity = calculateSimilarity(current, historical);

      assert.ok(similarity > 0.5);  // Should be fairly similar
      assert.ok(similarity <= 1);
    });

    it('should give 0 for completely different features', () => {
      const current = {
        types: ['test_failure'],
        keywords: ['error'],
        modules: ['lib/a'],
        errorTypes: ['TypeError']
      };

      const historical = {
        types: ['spec_drift'],
        keywords: ['different'],
        modules: ['lib/b'],
        errorTypes: ['ReferenceError']
      };

      const similarity = calculateSimilarity(current, historical);
      assert.ok(similarity < 0.3);
    });
  });

  describe('AC-012: 返回相似度排序的匹配结果', () => {
    it('should return matches sorted by similarity', () => {
      const observations = [
        { type: 'test_failure', description: 'null error' }
      ];

      const samples = [
        {
          id: 'sample-1',
          features: {
            types: ['test_failure'],
            keywords: ['null', 'error'],
            modules: [],
            errorTypes: []
          },
          lesson: 'Handle null',
          actions: ['Add null check'],
          effective: true
        },
        {
          id: 'sample-2',
          features: {
            types: ['spec_drift'],
            keywords: ['spec'],
            modules: [],
            errorTypes: []
          },
          lesson: 'Update spec',
          actions: ['Sync spec'],
          effective: true
        }
      ];

      const matches = matchHistoricalPatterns(observations, samples, { threshold: 0 });

      assert.ok(matches.length >= 1);
      // Should be sorted by similarity (descending)
      for (let i = 1; i < matches.length; i++) {
        assert.ok(matches[i - 1].similarity >= matches[i].similarity);
      }
    });
  });

  describe('AC-013: 配置相似度阈值', () => {
    it('should filter by threshold', () => {
      const observations = [
        { type: 'test_failure', description: 'error' }
      ];

      const samples = [
        {
          id: 'sample-1',
          features: { types: ['test_failure'], keywords: [], modules: [], errorTypes: [] },
          lesson: 'Test',
          effective: true
        }
      ];

      const withLowThreshold = matchHistoricalPatterns(observations, samples, { threshold: 0.1 });
      const withHighThreshold = matchHistoricalPatterns(observations, samples, { threshold: 0.9 });

      assert.ok(withLowThreshold.length >= withHighThreshold.length);
    });
  });

  describe('Overlap detection', () => {
    it('should detect type overlap', () => {
      assert.strictEqual(hasTypeOverlap(['test_failure'], ['test_failure', 'spec_drift']), true);
      assert.strictEqual(hasTypeOverlap(['test_failure'], ['spec_drift']), false);
    });

    it('should detect module overlap with prefix matching', () => {
      assert.strictEqual(hasModuleOverlap(['lib/parser'], ['lib/parser']), true);
      assert.strictEqual(hasModuleOverlap(['lib/parser/core'], ['lib/parser']), true);
      assert.strictEqual(hasModuleOverlap(['lib/parser'], ['lib/loader']), false);
    });

    it('should detect error type overlap', () => {
      assert.strictEqual(hasErrorTypeOverlap(['NullError'], ['NullError', 'TypeError']), true);
      assert.strictEqual(hasErrorTypeOverlap(['NullError'], ['TypeError']), false);
    });
  });
});

// ============================================================================
// REQ-001: 历史数据收集 & REQ-004: 历史建议增强
// ============================================================================

describe('REQ-001 & REQ-004: 数据收集与增强', () => {
  let tempDir;
  let learner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-test-'));
    learner = new PatternLearner(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe('AC-001: 定义学习样本结构', () => {
    it('should create sample with required fields', () => {
      const reflection = {
        id: 'ref-001',
        pattern: 'null_handling',
        lesson: 'Always check for null',
        suggested_actions: ['Add null check', 'Add tests']
      };

      const observations = [
        { type: 'test_failure', description: 'null error' }
      ];

      const sample = learner.collectSample(reflection, observations);

      assert.strictEqual(sample.id, 'ref-001');
      assert.strictEqual(sample.pattern, 'null_handling');
      assert.strictEqual(sample.lesson, 'Always check for null');
      assert.deepStrictEqual(sample.actions, ['Add null check', 'Add tests']);
      assert.ok(sample.features);
      assert.ok(sample.created);
    });
  });

  describe('AC-002: 反思接受时收集样本', () => {
    it('should save sample to storage', () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      learner.collectSample(reflection, []);

      const samples = learner.loadSamples();
      assert.strictEqual(samples.length, 1);
      assert.strictEqual(samples[0].id, 'ref-001');
    });
  });

  describe('AC-003: 提案归档时更新有效性', () => {
    it('should update effectiveness', () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      learner.collectSample(reflection, []);

      const updated = learner.updateEffectiveness('ref-001', true, 'Problem solved');
      assert.strictEqual(updated, true);

      const samples = learner.loadSamples();
      assert.strictEqual(samples[0].effective, true);
      assert.strictEqual(samples[0].outcome, 'Problem solved');
    });
  });

  describe('AC-004: 支持手动标记问题复发', () => {
    it('should mark recurrence', () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      learner.collectSample(reflection, []);
      learner.updateEffectiveness('ref-001', true);

      const marked = learner.markRecurrence('ref-001', 'ref-002');
      assert.strictEqual(marked, true);

      const samples = learner.loadSamples();
      assert.strictEqual(samples[0].effective, false);
      assert.ok(samples[0].outcome.includes('ref-002'));
    });
  });

  describe('AC-014 ~ AC-017: 历史建议增强', () => {
    it('should enhance candidate with historical reference', () => {
      // Create historical sample
      const historicalReflection = {
        id: 'hist-001',
        pattern: 'null_handling',
        lesson: 'Add null checks',
        suggested_actions: ['Add validation']
      };
      const histObs = [{ type: 'test_failure', description: 'null error' }];
      learner.collectSample(historicalReflection, histObs);
      learner.updateEffectiveness('hist-001', true);

      // Enhance new candidate
      const candidate = {
        id: 'new-001',
        pattern: 'null_handling',
        confidence: 0.7
      };
      const newObs = [{ type: 'test_failure', description: 'null reference' }];

      const enhanced = learner.enhanceWithHistory(candidate, newObs);

      assert.ok(enhanced.historical);
      assert.strictEqual(enhanced.historical.reference, 'hist-001');
      assert.strictEqual(enhanced.historical.previousLesson, 'Add null checks');
      assert.ok(enhanced.confidence >= 0.7);  // Should be boosted
    });

    it('should not enhance when no historical matches', () => {
      const candidate = { id: 'new-001', confidence: 0.5 };
      const enhanced = learner.enhanceWithHistory(candidate, []);

      assert.strictEqual(enhanced.historical, undefined);
      assert.strictEqual(enhanced.confidence, 0.5);
    });
  });
});

// ============================================================================
// REQ-005: 反馈闭环 (AC-018 ~ AC-021)
// ============================================================================

describe('REQ-005: 反馈闭环', () => {
  let tempDir;
  let collector;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-test-'));
    collector = new FeedbackCollector(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe('AC-018: 归档后请求效果反馈', () => {
    it('should create pending feedback record', () => {
      const record = collector.createPendingFeedback('ref-001', 'fix-null-handling');

      assert.strictEqual(record.reflection_id, 'ref-001');
      assert.strictEqual(record.proposal, 'fix-null-handling');
      assert.strictEqual(record.effectiveness, EFFECTIVENESS_OPTIONS.PENDING);
      assert.strictEqual(record.feedback_at, null);
    });

    it('should generate feedback prompt', () => {
      const prompt = generateFeedbackPrompt('fix-null-handling');

      assert.ok(prompt.includes('fix-null-handling'));
      assert.ok(prompt.includes('[1]'));
      assert.ok(prompt.includes('[2]'));
      assert.ok(prompt.includes('[3]'));
      assert.ok(prompt.includes('[4]'));
    });
  });

  describe('AC-019: 存储反馈记录', () => {
    it('should submit and store feedback', () => {
      collector.createPendingFeedback('ref-001', 'proposal-1');

      const updated = collector.submitFeedback(
        'ref-001',
        EFFECTIVENESS_OPTIONS.FULLY_RESOLVED,
        'Problem completely fixed'
      );

      assert.strictEqual(updated.effectiveness, EFFECTIVENESS_OPTIONS.FULLY_RESOLVED);
      assert.ok(updated.feedback_at);
      assert.strictEqual(updated.notes, 'Problem completely fixed');
    });

    it('should parse feedback choices correctly', () => {
      assert.strictEqual(parseFeedbackChoice('1'), EFFECTIVENESS_OPTIONS.FULLY_RESOLVED);
      assert.strictEqual(parseFeedbackChoice('2'), EFFECTIVENESS_OPTIONS.PARTIALLY_RESOLVED);
      assert.strictEqual(parseFeedbackChoice('3'), EFFECTIVENESS_OPTIONS.NOT_RESOLVED);
      assert.strictEqual(parseFeedbackChoice('4'), EFFECTIVENESS_OPTIONS.PENDING);
    });
  });

  describe('AC-020: 自动检测问题复发', () => {
    it('should detect recurrence', () => {
      const newReflection = {
        pattern: 'null_handling',
        lesson: 'Handle null values properly'
      };

      const resolvedPatterns = [
        {
          reflection_id: 'ref-old',
          pattern: 'null_handling',
          lesson: 'Add null checks everywhere'
        }
      ];

      const result = checkRecurrence(newReflection, resolvedPatterns);

      assert.strictEqual(result.recurrence, true);
      assert.strictEqual(result.originalReflection, 'ref-old');
      assert.ok(result.similarity > 0.5);
    });

    it('should not detect recurrence for different patterns', () => {
      const newReflection = {
        pattern: 'error_handling',
        lesson: 'Add error boundaries'
      };

      const resolvedPatterns = [
        {
          reflection_id: 'ref-old',
          pattern: 'null_handling',
          lesson: 'Add null checks'
        }
      ];

      const result = checkRecurrence(newReflection, resolvedPatterns);

      assert.strictEqual(result.recurrence, false);
    });
  });

  describe('AC-021: 复发时标记历史记录', () => {
    it('should mark recurrence in feedback', () => {
      collector.createPendingFeedback('ref-001', 'proposal-1');
      collector.submitFeedback('ref-001', EFFECTIVENESS_OPTIONS.FULLY_RESOLVED);

      const marked = collector.markRecurrence('ref-001', 'ref-002');
      assert.strictEqual(marked, true);

      const feedback = collector.getFeedback('ref-001');
      assert.strictEqual(feedback.effectiveness, EFFECTIVENESS_OPTIONS.NOT_RESOLVED);
      assert.ok(feedback.notes.includes('复发'));
    });
  });
});

// ============================================================================
// REQ-006: 学习数据管理 (AC-022 ~ AC-025)
// ============================================================================

describe('REQ-006: 学习数据管理', () => {
  let tempDir;
  let learner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-test-'));
    learner = new PatternLearner(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe('AC-022: 定义学习数据存储结构', () => {
    it('should create learning directory structure', () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      learner.collectSample(reflection, []);

      const learningDir = path.join(tempDir, '.seed', 'learning');
      assert.ok(fs.existsSync(learningDir));
      assert.ok(fs.existsSync(path.join(learningDir, 'samples.json')));
    });
  });

  describe('AC-023: 实现敏感信息脱敏', () => {
    it('should sanitize sample data', () => {
      const sample = {
        id: 'ref-001',
        pattern: 'null_handling',
        features: {
          types: ['test_failure'],
          modules: ['lib/parser/core'],
          errorTypes: ['NullError'],
          keywords: ['secret', 'password', 'token', 'key', 'api', 'extra'],
          timeClusters: ['2024-01-15T10:30:00Z'],
          specs: ['parser.fspec.md']
        },
        lesson: 'Fix the bug in parser.js with function parseData()',
        actions: ['Update /path/to/secret/file.js', 'Modify `secretFunction`'],
        effective: true,
        outcome: 'Fixed on 2024-01-15',
        created: '2024-01-15T10:30:00Z'
      };

      const sanitized = learner.sanitizeSample(sample);

      // Should keep basic info
      assert.strictEqual(sanitized.id, 'ref-001');
      assert.strictEqual(sanitized.pattern, 'null_handling');

      // Should limit keywords
      assert.ok(sanitized.features.keywords.length <= 5);

      // Should remove time clusters
      assert.strictEqual(sanitized.features.timeClusters.length, 0);

      // Should only keep top-level module
      assert.strictEqual(sanitized.features.modules[0], 'lib');

      // Should generalize lesson
      assert.ok(sanitized.lesson.includes('[file]') || sanitized.lesson.includes('[code]'));

      // Should generalize actions
      assert.ok(sanitized.actions[0].includes('[path]') || sanitized.actions[0].includes('[name]'));

      // Should remove outcome
      assert.strictEqual(sanitized.outcome, null);

      // Should only keep date
      assert.strictEqual(sanitized.created, '2024-01-15');
    });
  });

  describe('AC-024: 支持数据过期清理', () => {
    it('should remove old samples', () => {
      // Add old sample
      const oldSample = {
        id: 'old-001',
        pattern: 'test',
        features: {},
        lesson: 'Old',
        actions: [],
        effective: false,
        created: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()  // 400 days ago
      };

      // Add new sample
      const newSample = {
        id: 'new-001',
        pattern: 'test',
        features: {},
        lesson: 'New',
        actions: [],
        effective: false,
        created: new Date().toISOString()
      };

      learner.saveSamples([oldSample, newSample]);

      const result = learner.cleanupOldData(365);

      assert.strictEqual(result.removed, 1);
      assert.strictEqual(result.kept, 1);

      const samples = learner.loadSamples();
      assert.strictEqual(samples[0].id, 'new-001');
    });
  });

  describe('AC-025: 保留有效样本不过期', () => {
    it('should keep effective samples regardless of age', () => {
      const oldEffective = {
        id: 'old-effective',
        pattern: 'test',
        features: {},
        lesson: 'Old but effective',
        actions: [],
        effective: true,  // This should be kept
        created: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
      };

      learner.saveSamples([oldEffective]);

      const result = learner.cleanupOldData(365);

      assert.strictEqual(result.removed, 0);
      assert.strictEqual(result.kept, 1);
    });
  });

  describe('Export/Import', () => {
    it('should export and import data', () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      learner.collectSample(reflection, []);

      const exported = learner.exportData(false);

      assert.ok(exported.samples.length > 0);
      assert.ok(exported.version);
      assert.ok(exported.exported_at);

      // Create new learner and import
      const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-'));
      const learner2 = new PatternLearner(tempDir2);

      const result = learner2.importData(exported);
      assert.strictEqual(result.samples, 1);

      const imported = learner2.loadSamples();
      assert.strictEqual(imported[0].id, 'ref-001');

      fs.rmSync(tempDir2, { recursive: true });
    });

    it('should sanitize on export when requested', () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'Fix parser.js'
      };
      learner.collectSample(reflection, []);

      const exported = learner.exportData(true);

      assert.ok(exported.samples[0].lesson.includes('[file]'));
    });
  });
});

// ============================================================================
// REQ-007: 学习统计 (AC-026 ~ AC-029)
// ============================================================================

describe('REQ-007: 学习统计', () => {
  let tempDir;
  let learner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-test-'));
    learner = new PatternLearner(tempDir);

    // Create test samples
    const samples = [
      {
        id: 'ref-001',
        pattern: 'null_handling',
        features: {},
        lesson: 'Add null check',
        actions: ['创建规范', '添加工具函数'],
        effective: true,
        created: new Date().toISOString()
      },
      {
        id: 'ref-002',
        pattern: 'null_handling',
        features: {},
        lesson: 'Validate input',
        actions: ['创建规范', '增加测试'],
        effective: true,
        created: new Date().toISOString()
      },
      {
        id: 'ref-003',
        pattern: 'error_handling',
        features: {},
        lesson: 'Add error boundary',
        actions: ['添加工具函数'],
        effective: false,
        created: new Date().toISOString()
      }
    ];

    learner.saveSamples(samples);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe('AC-026: 统计样本数量和有效率', () => {
    it('should count samples and calculate effectiveness rate', () => {
      const stats = learner.getStats();

      assert.strictEqual(stats.totalSamples, 3);
      assert.strictEqual(stats.effectiveSamples, 2);
      assert.ok(Math.abs(stats.effectivenessRate - 2 / 3) < 0.01);
    });
  });

  describe('AC-027: 识别最常见模式', () => {
    it('should identify top patterns', () => {
      const stats = learner.getStats();

      assert.ok(stats.topPatterns.length > 0);
      assert.strictEqual(stats.topPatterns[0].pattern, 'null_handling');
      assert.strictEqual(stats.topPatterns[0].count, 2);
    });
  });

  describe('AC-028: 识别最有效策略', () => {
    it('should identify effective strategies', () => {
      const stats = learner.getStats();

      assert.ok(stats.topStrategies.length > 0);

      // 创建规范 should have high success rate (2 uses, 2 effective)
      const specStrategy = stats.topStrategies.find(s => s.strategy === '创建规范/规格');
      if (specStrategy) {
        assert.strictEqual(specStrategy.successRate, 1);  // 100% effective
      }
    });
  });

  describe('AC-029: 计算问题复发率', () => {
    it('should calculate recurrence rate', () => {
      const stats = learner.getStats();

      assert.ok(typeof stats.recurrenceRate === 'number');
      assert.ok(stats.recurrenceRate >= 0 && stats.recurrenceRate <= 1);
    });
  });

  describe('Stats formatting', () => {
    it('should format stats for display', () => {
      const stats = learner.getStats();
      const formatted = learner.formatStats(stats);

      assert.ok(formatted.includes('学习统计'));
      assert.ok(formatted.includes('样本总数'));
      assert.ok(formatted.includes('有效样本'));
      assert.ok(formatted.includes('最常见模式'));
      assert.ok(formatted.includes('复发率'));
    });
  });
});

// ============================================================================
// 格式化测试
// ============================================================================

describe('Formatting', () => {
  describe('Historical reference formatting', () => {
    it('should format historical reference', () => {
      const historical = {
        reference: 'ref-001',
        similarity: 0.85,
        previousLesson: 'Add null checks everywhere',
        previousActions: ['Add validation', 'Add tests'],
        wasEffective: true,
        date: '2024-01-15T10:00:00Z'
      };

      const formatted = formatHistoricalReference(historical);

      assert.ok(formatted.includes('历史参考'));
      assert.ok(formatted.includes('85%'));  // similarity
      assert.ok(formatted.includes('ref-001'));
      assert.ok(formatted.includes('Add null checks'));
      assert.ok(formatted.includes('✅'));  // effective
    });

    it('should handle ineffective history', () => {
      const historical = {
        reference: 'ref-002',
        similarity: 0.7,
        previousLesson: 'Failed approach',
        previousActions: ['Bad action'],
        wasEffective: false,
        date: '2024-01-10'
      };

      const formatted = formatHistoricalReference(historical);

      assert.ok(formatted.includes('❌'));  // ineffective
      assert.ok(formatted.includes('无效'));
    });

    it('should handle null historical', () => {
      assert.strictEqual(formatHistoricalReference(null), '');
      assert.strictEqual(formatHistoricalReference(undefined), '');
    });
  });
});
