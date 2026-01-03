/**
 * LLM 分析器测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  LLMAnalyzer,
  formatReflectionCandidate,
  formatReflectionDetails
} = require('../../lib/ace/llm-analyzer');

const {
  BaseLLMProvider,
  registerProvider,
  getProvider,
  mergeConfig,
  DEFAULT_LLM_CONFIG
} = require('../../lib/ace/llm-provider');

const { MockProvider } = require('../../lib/ace/providers/mock');
const { LLMRateLimiter, DEFAULT_LIMITS } = require('../../lib/ace/llm-rate-limiter');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-analyzer-test-'));
  fs.mkdirSync(path.join(testDir, '.seed'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 创建测试观察
function createTestObservations() {
  return [
    {
      id: 'obs-001',
      type: 'test_failure',
      description: 'TypeError: Cannot read property of undefined',
      context: {
        file: 'lib/parser.js',
        error_message: 'Cannot read property \'name\' of undefined'
      }
    },
    {
      id: 'obs-002',
      type: 'test_failure',
      description: 'null check failed in validator',
      context: {
        file: 'lib/validator.js',
        error_message: 'Expected value but got null'
      }
    },
    {
      id: 'obs-003',
      type: 'test_failure',
      description: 'undefined returned from parser',
      context: {
        file: 'lib/parser.js',
        error_message: 'Function returned undefined'
      }
    }
  ];
}

// 模拟规则分析函数
function mockRuleBasedAnalysis(observations) {
  if (observations.length < 2) {
    return [];
  }
  return [{
    pattern: 'test_failure_aggregation',
    confidence: 0.75,
    lesson: '检测到多个测试失败',
    observations: observations.map(o => o.id),
    suggested_actions: ['分析失败原因', '修复测试']
  }];
}

// ============================================================================
// REQ-001: LLM 提供商抽象
// ============================================================================

describe('REQ-001: LLM 提供商抽象', () => {
  it('AC-001: 定义 LLMProvider 接口', () => {
    // BaseLLMProvider 定义了接口
    assert.ok(BaseLLMProvider);
    assert.ok(typeof BaseLLMProvider === 'function');

    const provider = new BaseLLMProvider('test', {});
    assert.strictEqual(provider.name, 'test');
    assert.ok(typeof provider.analyzeObservations === 'function');
    assert.ok(typeof provider.suggestProposal === 'function');
    assert.ok(typeof provider.isAvailable === 'function');
  });

  it('AC-005: 提供 Mock 适配器用于测试', () => {
    const mock = new MockProvider({});
    assert.strictEqual(mock.name, 'mock');
  });

  it('Mock 提供商可以生成模拟反思', async () => {
    const mock = new MockProvider({});
    const observations = createTestObservations();

    const result = await mock.analyzeObservations(observations, {});

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    assert.ok(result[0].pattern);
    assert.ok(result[0].confidence >= 0 && result[0].confidence <= 1);
  });

  it('Mock 提供商可以设置自定义响应', async () => {
    const mock = new MockProvider({});
    const customResponse = [{
      pattern: 'custom_pattern',
      confidence: 0.9,
      lesson: 'Custom lesson',
      observations: ['obs-001'],
      suggested_actions: ['Action 1']
    }];

    mock.setMockResponse('analyzeObservations', customResponse);

    const result = await mock.analyzeObservations([], {});
    assert.deepStrictEqual(result, customResponse);
  });

  it('Mock 提供商可以模拟错误', async () => {
    const mock = new MockProvider({});
    mock.setMockError('analyzeObservations', new Error('Test error'));

    await assert.rejects(
      () => mock.analyzeObservations([], {}),
      { message: 'Test error' }
    );
  });

  it('Mock 提供商记录调用历史', async () => {
    const mock = new MockProvider({});
    await mock.analyzeObservations([{ id: 'obs-1' }], { project: 'test' });

    const history = mock.getCallHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].method, 'analyzeObservations');
  });
});

// ============================================================================
// REQ-002: 配置支持
// ============================================================================

describe('REQ-002: 配置支持', () => {
  it('AC-006: 支持 LLM 配置读取', () => {
    const config = mergeConfig({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4'
    });

    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.provider, 'openai');
    assert.strictEqual(config.model, 'gpt-4');
  });

  it('AC-009: 提供合理默认值', () => {
    const config = mergeConfig({});

    assert.strictEqual(config.enabled, false);
    assert.strictEqual(config.provider, 'mock');
    assert.strictEqual(config.fallback, 'rule-based');
    assert.strictEqual(config.options.temperature, 0.3);
    assert.strictEqual(config.limits.max_calls_per_day, 50);
  });

  it('DEFAULT_LLM_CONFIG 结构正确', () => {
    assert.strictEqual(DEFAULT_LLM_CONFIG.enabled, false);
    assert.ok(DEFAULT_LLM_CONFIG.options);
    assert.ok(DEFAULT_LLM_CONFIG.limits);
  });
});

// ============================================================================
// REQ-003: 观察分析增强
// ============================================================================

describe('REQ-003: 观察分析增强', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-010: 实现提示词模板', () => {
    const provider = new BaseLLMProvider('test', {});
    const observations = createTestObservations();
    const context = { project_name: 'test-project' };

    const prompt = provider.buildAnalysisPrompt(observations, context);

    assert.ok(prompt.includes('test-project'));
    assert.ok(prompt.includes('obs-001'));
    assert.ok(prompt.includes('test_failure'));
    assert.ok(prompt.includes('JSON'));
  });

  it('AC-011: 支持上下文注入', () => {
    const provider = new BaseLLMProvider('test', {});
    const context = {
      project_name: 'my-project',
      tech_stack: 'TypeScript',
      specs: ['auth.fspec.md', 'api.fspec.md']
    };

    const prompt = provider.buildAnalysisPrompt([], context);

    assert.ok(prompt.includes('my-project'));
    assert.ok(prompt.includes('TypeScript'));
    assert.ok(prompt.includes('auth.fspec.md'));
  });

  it('AC-012: 解析 LLM JSON 响应', () => {
    const provider = new BaseLLMProvider('test', {});

    // 代码块格式
    const response1 = '```json\n{"reflections": [{"pattern": "test"}]}\n```';
    const parsed1 = provider.parseJSONResponse(response1);
    assert.deepStrictEqual(parsed1, { reflections: [{ pattern: 'test' }] });

    // 直接 JSON
    const response2 = '{"reflections": []}';
    const parsed2 = provider.parseJSONResponse(response2);
    assert.deepStrictEqual(parsed2, { reflections: [] });
  });

  it('AC-013: 处理格式错误响应', () => {
    const provider = new BaseLLMProvider('test', {});

    assert.throws(
      () => provider.parseJSONResponse('invalid json'),
      { message: /无法从响应中解析 JSON/ }
    );
  });

  it('AC-014: 与规则匹配结果合并', async () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock'
    });

    const observations = createTestObservations();
    const result = await analyzer.analyzeWithFallback(observations, mockRuleBasedAnalysis);

    assert.strictEqual(result.success, true);
    assert.ok(result.reflections.length > 0);
  });
});

// ============================================================================
// REQ-004: 回退机制
// ============================================================================

describe('REQ-004: 回退机制', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-015: LLM 禁用时使用规则匹配', async () => {
    const analyzer = new LLMAnalyzer(testDir, { enabled: false });
    const observations = createTestObservations();

    const result = await analyzer.analyzeWithFallback(observations, mockRuleBasedAnalysis);

    assert.strictEqual(result.source, 'rule');
    assert.strictEqual(result.meta.reason, 'LLM 未启用');
  });

  it('AC-016: API 失败时自动回退', async () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock'
    });

    // 设置 mock 抛出错误
    analyzer.provider.setMockError('analyzeObservations', new Error('API Error'));

    const observations = createTestObservations();
    const result = await analyzer.analyzeWithFallback(observations, mockRuleBasedAnalysis);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.source, 'rule');
    assert.strictEqual(result.meta.fallback, true);
  });

  it('AC-017: 记录回退原因', async () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock'
    });

    analyzer.provider.setMockError('analyzeObservations', new Error('Network timeout'));

    const result = await analyzer.analyzeWithFallback([], mockRuleBasedAnalysis);

    assert.ok(result.meta.reason.includes('Network timeout'));
  });

  it('AC-018: 回退后继续正常流程', async () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock'
    });

    analyzer.provider.setMockError('analyzeObservations', new Error('Error'));

    const observations = createTestObservations();
    const result = await analyzer.analyzeWithFallback(observations, mockRuleBasedAnalysis);

    // 应该使用规则匹配结果
    assert.strictEqual(result.success, true);
    assert.ok(result.reflections.length > 0);
    assert.strictEqual(result.reflections[0].source, 'rule');
  });
});

// ============================================================================
// REQ-005: 结果合并策略
// ============================================================================

describe('REQ-005: 结果合并策略', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-019: 实现结果合并逻辑', () => {
    const analyzer = new LLMAnalyzer(testDir, {});

    const llmResults = [
      { pattern: 'llm_pattern', confidence: 0.85, observations: ['obs-001'] }
    ];
    const ruleResults = [
      { pattern: 'rule_pattern', confidence: 0.70, observations: ['obs-002'] }
    ];

    const merged = analyzer.mergeResults(llmResults, ruleResults);

    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[0].source, 'llm');
    assert.strictEqual(merged[1].source, 'rule');
  });

  it('AC-020: 去除重复候选', () => {
    const analyzer = new LLMAnalyzer(testDir, {});

    const llmResults = [
      { pattern: 'pattern1', confidence: 0.85, observations: ['obs-001', 'obs-002'] }
    ];
    const ruleResults = [
      { pattern: 'pattern2', confidence: 0.70, observations: ['obs-001', 'obs-002'] } // 相同观察
    ];

    const merged = analyzer.mergeResults(llmResults, ruleResults);

    // 应该去重
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].source, 'llm');
  });

  it('AC-021: 保留来源标记', () => {
    const analyzer = new LLMAnalyzer(testDir, {});

    const llmResults = [
      { pattern: 'llm', confidence: 0.80, observations: ['obs-001'] }
    ];
    const ruleResults = [
      { pattern: 'rule', confidence: 0.75, observations: ['obs-002'] }
    ];

    const merged = analyzer.mergeResults(llmResults, ruleResults);

    const sources = merged.map(r => r.source);
    assert.ok(sources.includes('llm'));
    assert.ok(sources.includes('rule'));
  });

  it('AC-022: 按置信度排序', () => {
    const analyzer = new LLMAnalyzer(testDir, {});

    const llmResults = [
      { pattern: 'low', confidence: 0.75, observations: ['obs-001'] }
    ];
    const ruleResults = [
      { pattern: 'high', confidence: 0.90, observations: ['obs-002'] }
    ];

    const merged = analyzer.mergeResults(llmResults, ruleResults);

    // 高置信度应该在前面
    assert.strictEqual(merged[0].confidence, 0.90);
    assert.strictEqual(merged[1].confidence, 0.75);
  });

  it('低置信度 LLM 结果不优先', () => {
    const analyzer = new LLMAnalyzer(testDir, {});

    const llmResults = [
      { pattern: 'low_conf', confidence: 0.5, observations: ['obs-001'] } // 低于 0.7
    ];
    const ruleResults = [
      { pattern: 'rule', confidence: 0.75, observations: ['obs-001'] }
    ];

    const merged = analyzer.mergeResults(llmResults, ruleResults);

    // 低置信度 LLM 结果被规则结果替代
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].source, 'rule');
  });
});

// ============================================================================
// REQ-006: 用户确认增强
// ============================================================================

describe('REQ-006: 用户确认增强', () => {
  it('AC-023: 显示来源标记', () => {
    const candidate = {
      pattern: 'test_pattern',
      confidence: 0.85,
      lesson: 'Test lesson',
      observations: ['obs-001'],
      source: 'llm'
    };

    const formatted = formatReflectionCandidate(candidate, 1);

    assert.ok(formatted.includes('[LLM 分析] 🤖'));
  });

  it('规则匹配显示正确标记', () => {
    const candidate = {
      pattern: 'test_pattern',
      confidence: 0.75,
      lesson: 'Rule lesson',
      observations: ['obs-001'],
      source: 'rule'
    };

    const formatted = formatReflectionCandidate(candidate, 1);

    assert.ok(formatted.includes('[规则匹配]'));
  });

  it('AC-024: 支持详情查看', () => {
    const candidate = {
      pattern: 'test_pattern',
      source: 'llm',
      reasoning: 'This is the LLM reasoning',
      suggested_actions: ['Action 1', 'Action 2']
    };

    const observations = [
      { id: 'obs-001', description: 'Test observation' }
    ];

    const details = formatReflectionDetails(candidate, observations);

    assert.ok(details.includes('📊 分析依据'));
    assert.ok(details.includes('obs-001'));
  });

  it('AC-025: 显示 LLM 推理过程', () => {
    const candidate = {
      source: 'llm',
      reasoning: 'This is the detailed reasoning'
    };

    const details = formatReflectionDetails(candidate, []);

    assert.ok(details.includes('🤖 LLM 推理'));
    assert.ok(details.includes('This is the detailed reasoning'));
  });

  it('AC-026: 显示完整建议行动', () => {
    const candidate = {
      source: 'rule',
      suggested_actions: ['First action', 'Second action', 'Third action']
    };

    const details = formatReflectionDetails(candidate, []);

    assert.ok(details.includes('📝 建议行动'));
    assert.ok(details.includes('1. First action'));
    assert.ok(details.includes('2. Second action'));
    assert.ok(details.includes('3. Third action'));
  });
});

// ============================================================================
// REQ-007: 成本和限流控制
// ============================================================================

describe('REQ-007: 成本和限流控制', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-027: 限制每次调用的观察数量', () => {
    const limiter = new LLMRateLimiter(testDir, { max_observations_per_call: 5 });

    const check = limiter.checkObservationLimit(10);
    assert.strictEqual(check.allowed, false);
    assert.strictEqual(check.maxAllowed, 5);

    const check2 = limiter.checkObservationLimit(3);
    assert.strictEqual(check2.allowed, true);
  });

  it('AC-028: 限制每日调用次数', () => {
    const limiter = new LLMRateLimiter(testDir, { max_calls_per_day: 3 });

    // 记录 3 次调用
    limiter.recordCall();
    limiter.recordCall();
    limiter.recordCall();

    const check = limiter.checkLimit();
    assert.strictEqual(check.allowed, false);
    assert.ok(check.reason.includes('每日调用限制'));
  });

  it('AC-029: 实现调用间隔控制', () => {
    const limiter = new LLMRateLimiter(testDir, { min_interval_seconds: 60 });

    limiter.recordCall();

    const check = limiter.checkLimit();
    assert.strictEqual(check.allowed, false);
    assert.ok(check.reason.includes('等待'));
    assert.ok(check.waitSeconds > 0);
  });

  it('AC-030: 超限时给出明确提示', () => {
    const limiter = new LLMRateLimiter(testDir, { max_calls_per_day: 1 });

    limiter.recordCall();
    const check = limiter.checkLimit();

    assert.ok(check.reason);
    assert.ok(typeof check.waitSeconds === 'number');
  });

  it('使用统计跨天重置', () => {
    const limiter = new LLMRateLimiter(testDir, {});

    // 手动写入昨天的数据
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const usagePath = path.join(testDir, '.seed', 'llm-usage.json');
    fs.writeFileSync(usagePath, JSON.stringify({
      date: yesterday.toISOString().slice(0, 10),
      calls: 100,
      lastCallTime: yesterday.getTime()
    }), 'utf-8');

    // 今天应该重新计数
    const usage = limiter.loadUsage();
    assert.strictEqual(usage.calls, 0);
  });

  it('获取使用统计摘要', () => {
    const limiter = new LLMRateLimiter(testDir, { max_calls_per_day: 50 });
    limiter.recordCall();
    limiter.recordCall();

    const summary = limiter.getUsageSummary();

    assert.strictEqual(summary.callsToday, 2);
    assert.strictEqual(summary.callsRemaining, 48);
    assert.strictEqual(summary.maxCallsPerDay, 50);
  });

  it('限流集成到分析器', async () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock',
      limits: { max_calls_per_day: 1 }
    });

    // 第一次调用
    await analyzer.analyzeWithFallback(createTestObservations(), mockRuleBasedAnalysis);

    // 第二次调用应该因限流回退
    const result = await analyzer.analyzeWithFallback(createTestObservations(), mockRuleBasedAnalysis);

    assert.strictEqual(result.source, 'rule');
    assert.ok(result.meta.reason.includes('每日调用限制'));
  });
});

// ============================================================================
// LLMAnalyzer 综合测试
// ============================================================================

describe('LLMAnalyzer 综合测试', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('加载项目上下文', () => {
    // 创建配置文件
    fs.writeFileSync(
      path.join(testDir, '.seed', 'config.json'),
      JSON.stringify({ name: 'test-project', tech_stack: 'TypeScript' }),
      'utf-8'
    );

    const analyzer = new LLMAnalyzer(testDir, {});
    const context = analyzer.loadContext();

    assert.strictEqual(context.project_name, 'test-project');
    assert.strictEqual(context.tech_stack, 'TypeScript');
  });

  it('检查 LLM 可用性', async () => {
    const analyzer = new LLMAnalyzer(testDir, { enabled: true, provider: 'mock' });
    const available = await analyzer.isLLMAvailable();
    assert.strictEqual(available, true);
  });

  it('LLM 禁用时不可用', async () => {
    const analyzer = new LLMAnalyzer(testDir, { enabled: false });
    const available = await analyzer.isLLMAvailable();
    assert.strictEqual(available, false);
  });

  it('建议提案', async () => {
    const analyzer = new LLMAnalyzer(testDir, { enabled: true, provider: 'mock' });

    const reflection = {
      pattern: 'null_handling',
      lesson: 'Inconsistent null handling',
      suggested_actions: ['Create null handling spec']
    };

    const suggestion = await analyzer.suggestProposal(reflection);

    assert.ok(suggestion);
    assert.ok(suggestion.name);
    assert.ok(suggestion.phases);
  });

  it('获取使用统计', () => {
    const analyzer = new LLMAnalyzer(testDir, {
      enabled: true,
      provider: 'mock',
      model: 'test-model'
    });

    const summary = analyzer.getUsageSummary();

    assert.strictEqual(summary.enabled, true);
    assert.strictEqual(summary.provider, 'mock');
    assert.strictEqual(summary.model, 'test-model');
  });
});
