/**
 * 自动建议提案测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/auto-propose.fspec.md
 *
 * 测试覆盖:
 * - REQ-001: 提案内容生成 (AC-001 ~ AC-004)
 * - REQ-002: 实施阶段分解 (AC-005 ~ AC-008)
 * - REQ-003: fspec 关联建议 (AC-009 ~ AC-012)
 * - REQ-004: 模板定制 (AC-013 ~ AC-016)
 * - REQ-005: 交互式编辑 (AC-017 ~ AC-020)
 * - REQ-006: LLM 增强建议 (AC-021 ~ AC-024)
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 测试模块
const { isPhaseMarker, extractPhaseInfo, breakdownToPhases, formatPhasesAsMarkdown, extractTasksFromText, mergePhases } = require('../../lib/ace/phase-breakdown');
const { suggestSpecs, countSpecOccurrences, needsNewSpec, extractTopic, sortByPriority, formatSuggestionsAsMarkdown } = require('../../lib/ace/spec-suggester');
const { ProposalGenerator, SimpleTemplateEngine, formatDraftSections, formatSectionBox } = require('../../lib/ace/proposal-generator');

// ============================================================================
// REQ-002: 实施阶段分解 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 实施阶段分解', () => {
  describe('AC-005: 识别 Phase 标记', () => {
    it('should recognize "Phase N:" format', () => {
      assert.strictEqual(isPhaseMarker('Phase 1: Setup'), true);
      assert.strictEqual(isPhaseMarker('Phase1: Setup'), true);
      assert.strictEqual(isPhaseMarker('Phase 2: Implementation'), true);
    });

    it('should recognize "阶段 N:" format', () => {
      assert.strictEqual(isPhaseMarker('阶段 1: 准备'), true);
      assert.strictEqual(isPhaseMarker('阶段1: 准备'), true);
      assert.strictEqual(isPhaseMarker('阶段 2: 实施'), true);
    });

    it('should recognize "Step N:" format', () => {
      assert.strictEqual(isPhaseMarker('Step 1: First'), true);
      assert.strictEqual(isPhaseMarker('Step1: First'), true);
      assert.strictEqual(isPhaseMarker('Step 3: Final'), true);
    });

    it('should recognize numbered list format', () => {
      assert.strictEqual(isPhaseMarker('1. Phase: Setup'), true);
      assert.strictEqual(isPhaseMarker('2. 阶段: 实施'), true);
    });

    it('should reject non-phase markers', () => {
      assert.strictEqual(isPhaseMarker('Add feature'), false);
      assert.strictEqual(isPhaseMarker('Fix bug'), false);
      assert.strictEqual(isPhaseMarker(''), false);
      assert.strictEqual(isPhaseMarker(null), false);
      assert.strictEqual(isPhaseMarker(undefined), false);
    });

    it('should extract phase info correctly', () => {
      const info = extractPhaseInfo('Phase 1: Setup Environment');
      assert.strictEqual(info.number, 1);
      assert.strictEqual(info.name, 'Setup Environment');
    });

    it('should extract Chinese phase info', () => {
      const info = extractPhaseInfo('阶段 2: 核心实现');
      assert.strictEqual(info.number, 2);
      assert.strictEqual(info.name, '核心实现');
    });
  });

  describe('AC-006: 正确分组任务', () => {
    it('should group tasks under phases', () => {
      const actions = [
        'Phase 1: Setup',
        'Install dependencies',
        'Configure environment',
        'Phase 2: Implementation',
        'Write code',
        'Add tests'
      ];

      const phases = breakdownToPhases(actions);

      assert.strictEqual(phases.length, 2);
      assert.strictEqual(phases[0].name, 'Setup');
      assert.deepStrictEqual(phases[0].tasks, ['Install dependencies', 'Configure environment']);
      assert.strictEqual(phases[1].name, 'Implementation');
      assert.deepStrictEqual(phases[1].tasks, ['Write code', 'Add tests']);
    });

    it('should handle Chinese phase names', () => {
      const actions = [
        '阶段 1: 准备工作',
        '安装依赖',
        '配置环境',
        '阶段 2: 核心开发',
        '编写代码'
      ];

      const phases = breakdownToPhases(actions);

      assert.strictEqual(phases.length, 2);
      assert.strictEqual(phases[0].name, '准备工作');
      assert.strictEqual(phases[1].name, '核心开发');
    });
  });

  describe('AC-007: 无标记时创建默认 Phase', () => {
    it('should create default phase when no markers', () => {
      const actions = [
        'Add feature X',
        'Fix bug Y',
        'Update documentation'
      ];

      const phases = breakdownToPhases(actions);

      assert.strictEqual(phases.length, 1);
      assert.strictEqual(phases[0].name, '实施');
      assert.deepStrictEqual(phases[0].tasks, actions);
    });

    it('should handle empty actions', () => {
      const phases = breakdownToPhases([]);
      assert.strictEqual(phases.length, 0);
    });

    it('should handle null/undefined actions', () => {
      assert.strictEqual(breakdownToPhases(null).length, 0);
      assert.strictEqual(breakdownToPhases(undefined).length, 0);
    });
  });

  describe('AC-008: 保持任务顺序', () => {
    it('should preserve task order within phases', () => {
      const actions = [
        'Phase 1: Setup',
        'Task A',
        'Task B',
        'Task C'
      ];

      const phases = breakdownToPhases(actions);

      assert.deepStrictEqual(phases[0].tasks, ['Task A', 'Task B', 'Task C']);
    });

    it('should preserve phase order', () => {
      const actions = [
        'Phase 3: Last',
        'Task C',
        'Phase 1: First',
        'Task A',
        'Phase 2: Middle',
        'Task B'
      ];

      const phases = breakdownToPhases(actions);

      assert.strictEqual(phases[0].name, 'Last');
      assert.strictEqual(phases[1].name, 'First');
      assert.strictEqual(phases[2].name, 'Middle');
    });
  });

  describe('Phase formatting', () => {
    it('should format phases as Markdown', () => {
      const phases = [
        { name: 'Setup', tasks: ['Install', 'Configure'] },
        { name: 'Build', tasks: ['Compile'] }
      ];

      const md = formatPhasesAsMarkdown(phases);

      assert.ok(md.includes('### Phase 1: Setup'));
      assert.ok(md.includes('- [ ] Install'));
      assert.ok(md.includes('- [ ] Configure'));
      assert.ok(md.includes('### Phase 2: Build'));
      assert.ok(md.includes('- [ ] Compile'));
    });

    it('should handle empty phases', () => {
      const md = formatPhasesAsMarkdown([]);
      assert.strictEqual(md, '');
    });
  });

  describe('Task extraction', () => {
    it('should extract tasks from Markdown list', () => {
      const text = `
- Task 1
- Task 2
* Task 3
+ Task 4
      `;

      const tasks = extractTasksFromText(text);

      assert.deepStrictEqual(tasks, ['Task 1', 'Task 2', 'Task 3', 'Task 4']);
    });

    it('should extract tasks from numbered list', () => {
      const text = `
1. First task
2. Second task
3) Third task
      `;

      const tasks = extractTasksFromText(text);

      assert.deepStrictEqual(tasks, ['First task', 'Second task', 'Third task']);
    });

    it('should extract tasks from checkbox list', () => {
      const text = `
- [ ] Todo 1
- [x] Done 1
- [ ] Todo 2
      `;

      const tasks = extractTasksFromText(text);

      assert.deepStrictEqual(tasks, ['Todo 1', 'Done 1', 'Todo 2']);
    });
  });

  describe('Phase merging', () => {
    it('should merge phases with same name', () => {
      const phases = [
        { name: 'Setup', tasks: ['Task A'] },
        { name: 'Setup', tasks: ['Task B'] },
        { name: 'Build', tasks: ['Task C'] }
      ];

      const merged = mergePhases(phases);

      assert.strictEqual(merged.length, 2);
      const setup = merged.find(p => p.name === 'Setup');
      assert.deepStrictEqual(setup.tasks, ['Task A', 'Task B']);
    });

    it('should deduplicate tasks', () => {
      const phases = [
        { name: 'Setup', tasks: ['Task A', 'Task B'] },
        { name: 'Setup', tasks: ['Task B', 'Task C'] }
      ];

      const merged = mergePhases(phases);

      const setup = merged.find(p => p.name === 'Setup');
      assert.deepStrictEqual(setup.tasks, ['Task A', 'Task B', 'Task C']);
    });
  });
});

// ============================================================================
// REQ-003: fspec 关联建议 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: fspec 关联建议', () => {
  describe('AC-009: 统计观察关联的规格', () => {
    it('should count spec occurrences', () => {
      const observations = [
        { id: 'obs-1', related_spec: 'parser.fspec.md' },
        { id: 'obs-2', related_spec: 'parser.fspec.md' },
        { id: 'obs-3', related_spec: 'loader.fspec.md' },
        { id: 'obs-4', related_spec: 'parser.fspec.md' },
        { id: 'obs-5' }  // No related spec
      ];

      const counts = countSpecOccurrences(observations);

      assert.strictEqual(counts.get('parser.fspec.md'), 3);
      assert.strictEqual(counts.get('loader.fspec.md'), 1);
      assert.strictEqual(counts.size, 2);
    });

    it('should handle empty observations', () => {
      const counts = countSpecOccurrences([]);
      assert.strictEqual(counts.size, 0);
    });
  });

  describe('AC-010: 建议修改高频规格', () => {
    it('should suggest modifying high-frequency specs', () => {
      const reflection = { lesson: 'Fix the bug' };
      const observations = [
        { id: 'obs-1', related_spec: 'parser.fspec.md' },
        { id: 'obs-2', related_spec: 'parser.fspec.md' },
        { id: 'obs-3', related_spec: 'loader.fspec.md' }
      ];

      const suggestions = suggestSpecs(reflection, observations);

      const parserSuggestion = suggestions.find(s => s.spec === 'parser.fspec.md');
      assert.ok(parserSuggestion);
      assert.strictEqual(parserSuggestion.type, 'modify');
      assert.strictEqual(parserSuggestion.priority, 'high');
      assert.ok(parserSuggestion.reason.includes('2'));
    });

    it('should mark single-occurrence as medium priority', () => {
      const reflection = { lesson: 'Fix bug' };
      const observations = [
        { id: 'obs-1', related_spec: 'loader.fspec.md' }
      ];

      const suggestions = suggestSpecs(reflection, observations);

      const loaderSuggestion = suggestions.find(s => s.spec === 'loader.fspec.md');
      assert.strictEqual(loaderSuggestion.priority, 'medium');
    });
  });

  describe('AC-011: 识别需要新建的规格场景', () => {
    it('should detect "统一" keyword', () => {
      const reflection = { lesson: '需要统一空值处理策略' };
      assert.strictEqual(needsNewSpec(reflection), true);
    });

    it('should detect "策略" keyword', () => {
      const reflection = { lesson: '制定错误处理策略' };
      assert.strictEqual(needsNewSpec(reflection), true);
    });

    it('should detect "规范" keyword', () => {
      const reflection = { lesson: '建立编码规范' };
      assert.strictEqual(needsNewSpec(reflection), true);
    });

    it('should detect "缺乏" keyword', () => {
      const reflection = { lesson: '缺乏统一的日志规范' };
      assert.strictEqual(needsNewSpec(reflection), true);
    });

    it('should detect English keywords', () => {
      assert.strictEqual(needsNewSpec({ lesson: 'need to standardize error handling' }), true);
      assert.strictEqual(needsNewSpec({ lesson: 'missing unified policy' }), true);
      assert.strictEqual(needsNewSpec({ lesson: 'establish new strategy' }), true);
    });

    it('should return false for simple lessons', () => {
      const reflection = { lesson: 'Fixed a bug in parser' };
      assert.strictEqual(needsNewSpec(reflection), false);
    });

    it('should handle empty/null reflection', () => {
      assert.strictEqual(needsNewSpec(null), false);
      assert.strictEqual(needsNewSpec({}), false);
      assert.strictEqual(needsNewSpec({ lesson: '' }), false);
    });

    it('should suggest new spec in suggestions', () => {
      const reflection = { lesson: '需要统一空值处理策略' };
      const observations = [];

      const suggestions = suggestSpecs(reflection, observations);

      const createSuggestion = suggestions.find(s => s.type === 'create');
      assert.ok(createSuggestion);
      assert.ok(createSuggestion.spec.endsWith('.fspec.md'));
      assert.strictEqual(createSuggestion.priority, 'high');
    });
  });

  describe('AC-012: 输出优先级排序的建议列表', () => {
    it('should sort by priority (high > medium > low)', () => {
      const suggestions = [
        { type: 'modify', spec: 'low.fspec.md', priority: 'low', reason: 'test' },
        { type: 'modify', spec: 'high.fspec.md', priority: 'high', reason: 'test' },
        { type: 'modify', spec: 'medium.fspec.md', priority: 'medium', reason: 'test' }
      ];

      const sorted = sortByPriority(suggestions);

      assert.strictEqual(sorted[0].priority, 'high');
      assert.strictEqual(sorted[1].priority, 'medium');
      assert.strictEqual(sorted[2].priority, 'low');
    });

    it('should prioritize create over modify at same priority', () => {
      const suggestions = [
        { type: 'modify', spec: 'a.fspec.md', priority: 'high', reason: 'test' },
        { type: 'create', spec: 'b.fspec.md', priority: 'high', reason: 'test' }
      ];

      const sorted = sortByPriority(suggestions);

      assert.strictEqual(sorted[0].type, 'create');
      assert.strictEqual(sorted[1].type, 'modify');
    });
  });

  describe('Topic extraction', () => {
    it('should extract Chinese keywords', () => {
      assert.strictEqual(extractTopic('空值处理问题'), 'null-handling');
      assert.strictEqual(extractTopic('错误处理机制'), 'error-handling');
      assert.strictEqual(extractTopic('验证逻辑'), 'validation');
      assert.strictEqual(extractTopic('缓存策略'), 'caching');
    });

    it('should extract English keywords', () => {
      assert.strictEqual(extractTopic('improve performance'), 'improve');
      assert.strictEqual(extractTopic('authentication flow'), 'authentication');
    });

    it('should handle empty/invalid input', () => {
      assert.strictEqual(extractTopic(''), 'untitled');
      assert.strictEqual(extractTopic(null), 'untitled');
      assert.strictEqual(extractTopic(undefined), 'untitled');
    });
  });

  describe('Suggestion formatting', () => {
    it('should format suggestions as Markdown', () => {
      const suggestions = [
        { type: 'modify', spec: 'parser.fspec.md', reason: '2 个相关观察', priority: 'high' },
        { type: 'create', spec: 'null-handling.fspec.md', reason: '需要新规格', priority: 'medium' }
      ];

      const md = formatSuggestionsAsMarkdown(suggestions);

      assert.ok(md.includes('🔴'));  // high priority
      assert.ok(md.includes('🟡'));  // medium priority
      assert.ok(md.includes('修改'));
      assert.ok(md.includes('新建'));
      assert.ok(md.includes('`parser.fspec.md`'));
    });

    it('should handle empty suggestions', () => {
      const md = formatSuggestionsAsMarkdown([]);
      assert.strictEqual(md, '无规格变更建议');
    });
  });
});

// ============================================================================
// REQ-001: 提案内容生成 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 提案内容生成', () => {
  let generator;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proposal-test-'));
    generator = new ProposalGenerator(tempDir);
  });

  describe('AC-001: 从反思生成完整提案草稿', () => {
    it('should generate draft from reflection', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: '统一空值处理策略',
        analysis: '多个模块使用不同的空值检查方式',
        suggested_actions: [
          'Phase 1: 规范制定',
          '创建空值处理规格',
          '添加 ESLint 规则',
          'Phase 2: 实施',
          '重构现有代码'
        ],
        pattern: 'null_handling',
        confidence: 0.8,
        created: '2024-01-01T00:00:00Z'
      };

      const observations = [
        { id: 'obs-1', type: 'test_failure', description: 'null reference error', related_spec: 'parser.fspec.md', created: '2024-01-01' },
        { id: 'obs-2', type: 'test_failure', description: 'undefined check missing', related_spec: 'parser.fspec.md', created: '2024-01-01' }
      ];

      const draft = await generator.generateDraft(reflection, observations);

      assert.ok(draft.name);
      assert.ok(draft.created);
      assert.ok(draft.source);
      assert.ok(draft.overview);
      assert.ok(draft.analysis);
      assert.ok(draft.solution);
      assert.ok(Array.isArray(draft.phases));
      assert.ok(Array.isArray(draft.specSuggestions));
      assert.ok(Array.isArray(draft.sources));
    });
  });

  describe('AC-002: 各章节内容合理映射', () => {
    it('should map lesson to overview', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: '统一空值处理策略'
      };

      const draft = await generator.generateDraft(reflection, []);

      assert.strictEqual(draft.overview, reflection.lesson);
    });

    it('should map suggested_actions to solution', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'Test',
        suggested_actions: ['Action 1', 'Action 2']
      };

      const draft = await generator.generateDraft(reflection, []);

      assert.ok(draft.solution.includes('Action 1'));
      assert.ok(draft.solution.includes('Action 2'));
    });

    it('should generate analysis from observations', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'Test',
        analysis: '问题分析内容'
      };

      const observations = [
        { id: 'obs-1', type: 'test_failure' },
        { id: 'obs-2', type: 'spec_drift' }
      ];

      const draft = await generator.generateDraft(reflection, observations);

      assert.ok(draft.analysis.includes('2 个相关观察'));
      assert.ok(draft.analysis.includes('test_failure'));
      assert.ok(draft.analysis.includes('spec_drift'));
    });
  });

  describe('AC-003: 保持 proposal.md 标准格式', () => {
    it('should render with standard format', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'Test lesson',
        suggested_actions: ['Task 1']
      };

      const draft = await generator.generateDraft(reflection, []);
      const rendered = generator.render(draft);

      assert.ok(rendered.includes('# '));  // Title
      assert.ok(rendered.includes('状态'));
      assert.ok(rendered.includes('draft'));
      assert.ok(rendered.includes('## 概述'));
      assert.ok(rendered.includes('## 问题分析'));
      assert.ok(rendered.includes('## 建议方案'));
    });
  });

  describe('AC-004: 支持空字段的默认处理', () => {
    it('should handle empty lesson', async () => {
      const reflection = { id: 'ref-001' };
      const draft = await generator.generateDraft(reflection, []);

      assert.strictEqual(draft.overview, '待填写');
    });

    it('should handle empty suggested_actions', async () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      const draft = await generator.generateDraft(reflection, []);

      assert.ok(draft.solution.includes('待补充'));
    });

    it('should handle missing pattern', async () => {
      const reflection = { id: 'ref-001', lesson: 'Test' };
      const draft = await generator.generateDraft(reflection, []);

      assert.ok(draft.name);  // Should still generate a name
    });
  });

  describe('Name generation', () => {
    it('should generate name from pattern', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'Test',
        pattern: 'null_handling'
      };

      const draft = await generator.generateDraft(reflection, []);

      assert.strictEqual(draft.name, 'fix-null-handling');
    });

    it('should generate name from lesson keywords', async () => {
      const reflection = {
        id: 'ref-001',
        lesson: 'improve error handling mechanism'
      };

      const draft = await generator.generateDraft(reflection, []);

      assert.ok(draft.name.startsWith('improve-'));
    });

    it('should generate timestamp-based name as fallback', async () => {
      const reflection = { id: 'ref-001' };
      const draft = await generator.generateDraft(reflection, []);

      assert.ok(draft.name.startsWith('proposal-'));
    });
  });
});

// ============================================================================
// REQ-004: 模板定制 (AC-013 ~ AC-016)
// ============================================================================

describe('REQ-004: 模板定制', () => {
  let engine;

  beforeEach(() => {
    engine = new SimpleTemplateEngine();
  });

  describe('AC-013: 支持 Handlebars 模板语法', () => {
    it('should support simple variables', () => {
      const template = 'Hello {{name}}!';
      const result = engine.render(template, { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    it('should support nested properties', () => {
      const template = '{{user.name}} - {{user.email}}';
      const result = engine.render(template, { user: { name: 'John', email: 'john@example.com' } });
      assert.strictEqual(result, 'John - john@example.com');
    });

    it('should support {{#each}} loops', () => {
      const template = '{{#each items}}{{this}},{{/each}}';
      const result = engine.render(template, { items: ['a', 'b', 'c'] });
      assert.strictEqual(result, 'a,b,c,');
    });

    it('should support {{#each}} with objects', () => {
      const template = '{{#each users}}{{name}};{{/each}}';
      const result = engine.render(template, { users: [{ name: 'Alice' }, { name: 'Bob' }] });
      assert.strictEqual(result, 'Alice;Bob;');
    });

    it('should support @index in loops', () => {
      const template = '{{#each items}}{{add @index 1}}.{{this}} {{/each}}';
      const result = engine.render(template, { items: ['a', 'b'] });
      assert.strictEqual(result, '1.a 2.b ');
    });

    it('should support {{#if}} conditionals', () => {
      const template = '{{#if show}}visible{{/if}}';
      assert.strictEqual(engine.render(template, { show: true }), 'visible');
      assert.strictEqual(engine.render(template, { show: false }), '');
    });

    it('should support {{#if}} with truthy values', () => {
      const template = '{{#if items}}has items{{/if}}';
      assert.strictEqual(engine.render(template, { items: [1, 2] }), 'has items');
      assert.strictEqual(engine.render(template, { items: [] }), '');
    });

    it('should support nested {{#each}} and {{#if}}', () => {
      const template = '{{#each phases}}{{#if tasks}}Phase: {{name}}{{/if}}{{/each}}';
      const result = engine.render(template, {
        phases: [
          { name: 'Setup', tasks: ['a'] },
          { name: 'Empty', tasks: [] }
        ]
      });
      assert.strictEqual(result, 'Phase: Setup');
    });
  });

  describe('AC-014: 提供默认模板', () => {
    it('should have default template path', () => {
      const generator = new ProposalGenerator('/tmp');
      assert.ok(generator.defaultTemplatePath);
      assert.ok(generator.defaultTemplatePath.includes('proposal.md.hbs'));
    });

    it('should provide minimal template when file not found', () => {
      const generator = new ProposalGenerator('/nonexistent');
      const template = generator.getMinimalTemplate();

      assert.ok(template.includes('{{name}}'));
      assert.ok(template.includes('{{overview}}'));
      assert.ok(template.includes('{{#each phases}}'));
    });
  });

  describe('AC-015: 支持自定义模板', () => {
    it('should load custom template from project', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
      const templateDir = path.join(tempDir, '.seed', 'templates');
      fs.mkdirSync(templateDir, { recursive: true });

      const customTemplate = '# Custom: {{name}}\n{{overview}}';
      fs.writeFileSync(path.join(templateDir, 'proposal.md.hbs'), customTemplate);

      const generator = new ProposalGenerator(tempDir);
      const template = generator.loadTemplate();

      assert.strictEqual(template, customTemplate);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fall back to default when custom not found', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
      const generator = new ProposalGenerator(tempDir);

      // Should not throw
      const template = generator.loadTemplate();
      assert.ok(template.includes('{{name}}'));

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('AC-016: 模板变量完整传递', () => {
    it('should pass all draft fields to template', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-test-'));
      const generator = new ProposalGenerator(tempDir);

      const reflection = {
        id: 'ref-001',
        lesson: 'Test lesson',
        suggested_actions: ['Phase 1: Setup', 'Task A', 'Task B'],
        pattern: 'test_pattern',
        confidence: 0.9,
        created: '2024-01-01'
      };

      const observations = [
        { id: 'obs-1', type: 'test_failure', description: 'Error', related_spec: 'test.fspec.md', created: '2024-01-01' }
      ];

      const draft = await generator.generateDraft(reflection, observations);
      const rendered = generator.render(draft);

      // Verify all sections are rendered
      assert.ok(rendered.includes(draft.name));
      assert.ok(rendered.includes(draft.overview));
      assert.ok(rendered.includes('Setup'));  // Phase name
      assert.ok(rendered.includes('Task A'));
      assert.ok(rendered.includes('Task B'));

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('Template edge cases', () => {
    it('should handle (eq) comparison in {{#if}}', () => {
      const template = '{{#if (eq type "modify")}}MODIFY{{/if}}{{#if (eq type "create")}}CREATE{{/if}}';
      assert.strictEqual(engine.render(template, { type: 'modify' }), 'MODIFY');
      assert.strictEqual(engine.render(template, { type: 'create' }), 'CREATE');
    });

    it('should handle undefined variables gracefully', () => {
      const template = '{{name}} - {{missing}}';
      const result = engine.render(template, { name: 'Test' });
      assert.strictEqual(result, 'Test - ');
    });

    it('should handle empty arrays in {{#each}}', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = engine.render(template, { items: [] });
      assert.strictEqual(result, '');
    });
  });
});

// ============================================================================
// REQ-005: 交互式编辑 (AC-017 ~ AC-020)
// ============================================================================

describe('REQ-005: 交互式编辑', () => {
  describe('AC-017: 分章节展示生成内容', () => {
    it('should format draft into sections', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'section-test-'));
      const generator = new ProposalGenerator(tempDir);

      const reflection = {
        id: 'ref-001',
        lesson: 'Test lesson',
        analysis: 'Test analysis',
        suggested_actions: ['Task 1', 'Task 2']
      };

      const draft = await generator.generateDraft(reflection, []);
      const sections = formatDraftSections(draft);

      assert.ok(Array.isArray(sections));
      assert.ok(sections.length >= 4);

      const overviewSection = sections.find(s => s.key === 'overview');
      assert.ok(overviewSection);
      assert.strictEqual(overviewSection.name, '概述');
      assert.strictEqual(overviewSection.editable, true);

      const analysisSection = sections.find(s => s.key === 'analysis');
      assert.ok(analysisSection);
      assert.strictEqual(analysisSection.name, '问题分析');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should mark spec suggestions as non-editable', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'section-test-'));
      const generator = new ProposalGenerator(tempDir);

      const draft = await generator.generateDraft({ id: 'ref-001', lesson: 'Test' }, []);
      const sections = formatDraftSections(draft);

      const specSection = sections.find(s => s.key === 'specSuggestions');
      assert.strictEqual(specSection.editable, false);

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('AC-018: 支持章节编辑', () => {
    it('should format section box for display', () => {
      const section = {
        name: '概述',
        key: 'overview',
        content: '这是概述内容\n第二行\n第三行',
        editable: true
      };

      const box = formatSectionBox(section);

      assert.ok(box.includes('概述'));
      assert.ok(box.includes('这是概述内容'));
      assert.ok(box.includes('[e] 编辑'));
      assert.ok(box.includes('┌'));
      assert.ok(box.includes('└'));
    });
  });

  describe('AC-019: 支持任务增删', () => {
    it('should show phase-specific actions for phase sections', () => {
      const section = {
        name: '实施阶段',
        key: 'phases',
        content: 'Phase 1: Setup\n- Task 1',
        editable: true,
        isPhases: true
      };

      const box = formatSectionBox(section);

      assert.ok(box.includes('[+] 添加任务'));
      assert.ok(box.includes('[-] 删除任务'));
    });
  });

  describe('AC-020: 确认后才创建文件', () => {
    it('should save to correct path', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-test-'));
      const generator = new ProposalGenerator(tempDir);

      const draft = await generator.generateDraft({
        id: 'ref-001',
        lesson: 'Test',
        pattern: 'test_pattern'
      }, []);

      const savedPath = generator.save(draft);

      assert.ok(fs.existsSync(savedPath));
      assert.ok(savedPath.includes('openspec/changes'));
      assert.ok(savedPath.includes('proposal.md'));

      const content = fs.readFileSync(savedPath, 'utf-8');
      assert.ok(content.includes('Test'));

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should allow custom output path', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-test-'));
      const generator = new ProposalGenerator(tempDir);
      const customPath = path.join(tempDir, 'custom-proposal.md');

      const draft = await generator.generateDraft({ id: 'ref-001', lesson: 'Test' }, []);
      const savedPath = generator.save(draft, customPath);

      assert.strictEqual(savedPath, customPath);
      assert.ok(fs.existsSync(customPath));

      fs.rmSync(tempDir, { recursive: true });
    });
  });
});

// ============================================================================
// REQ-006: LLM 增强建议 (AC-021 ~ AC-024)
// ============================================================================

describe('REQ-006: LLM 增强建议', () => {
  describe('AC-021 ~ AC-024: LLM 增强', () => {
    it('should enhance draft with LLM analysis', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-test-'));
      const generator = new ProposalGenerator(tempDir);

      // Mock LLM analyzer
      const mockLLMAnalyzer = {
        suggestProposal: async () => ({
          enhanced_analysis: '深度分析：问题根源在于...',
          alternative_solutions: ['替代方案 A', '替代方案 B'],
          risks: [
            { risk: '兼容性风险', mitigation: '渐进式迁移' }
          ],
          acceptance_criteria: ['AC-001: 功能完整', 'AC-002: 测试通过']
        })
      };

      const reflection = {
        id: 'ref-001',
        lesson: 'Test lesson',
        suggested_actions: ['Task 1']
      };

      const draft = await generator.generateDraft(reflection, [], {
        useLLM: true,
        llmAnalyzer: mockLLMAnalyzer
      });

      // AC-021: Enhanced analysis
      assert.ok(draft.analysis.includes('LLM 深化分析'));
      assert.ok(draft.analysis.includes('问题根源'));

      // AC-022: Alternative solutions
      assert.ok(draft.solution.includes('替代方案'));
      assert.ok(draft.solution.includes('替代方案 A'));
      assert.ok(draft.solution.includes('替代方案 B'));

      // AC-023: Risk assessment
      assert.ok(draft.risks);
      assert.ok(draft.risks.length > 0);
      assert.strictEqual(draft.risks[0].risk, '兼容性风险');

      // AC-024: Acceptance criteria
      assert.ok(draft.acceptanceCriteria);
      assert.ok(draft.acceptanceCriteria.includes('AC-001: 功能完整'));

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should handle LLM failure gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-fail-test-'));
      const generator = new ProposalGenerator(tempDir);

      // Mock failing LLM analyzer
      const mockLLMAnalyzer = {
        suggestProposal: async () => {
          throw new Error('LLM service unavailable');
        }
      };

      const reflection = {
        id: 'ref-001',
        lesson: 'Test lesson'
      };

      // Should not throw
      const draft = await generator.generateDraft(reflection, [], {
        useLLM: true,
        llmAnalyzer: mockLLMAnalyzer
      });

      // Should still have basic draft
      assert.ok(draft.name);
      assert.ok(draft.overview);
      assert.strictEqual(draft.risks, undefined);  // LLM-only field not added

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should skip LLM when not enabled', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-llm-test-'));
      const generator = new ProposalGenerator(tempDir);

      let llmCalled = false;
      const mockLLMAnalyzer = {
        suggestProposal: async () => {
          llmCalled = true;
          return {};
        }
      };

      const reflection = { id: 'ref-001', lesson: 'Test' };

      // useLLM: false (default)
      await generator.generateDraft(reflection, [], {
        llmAnalyzer: mockLLMAnalyzer
      });

      assert.strictEqual(llmCalled, false);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should handle partial LLM response', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-llm-test-'));
      const generator = new ProposalGenerator(tempDir);

      // Mock LLM analyzer with partial response
      const mockLLMAnalyzer = {
        suggestProposal: async () => ({
          enhanced_analysis: 'Only analysis provided'
          // No alternative_solutions, risks, or acceptance_criteria
        })
      };

      const reflection = { id: 'ref-001', lesson: 'Test' };

      const draft = await generator.generateDraft(reflection, [], {
        useLLM: true,
        llmAnalyzer: mockLLMAnalyzer
      });

      // Should have enhanced analysis
      assert.ok(draft.analysis.includes('Only analysis provided'));

      // Should not have other LLM fields
      assert.strictEqual(draft.risks, undefined);
      assert.strictEqual(draft.acceptanceCriteria, undefined);

      fs.rmSync(tempDir, { recursive: true });
    });
  });
});
