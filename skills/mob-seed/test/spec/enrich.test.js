/**
 * spec/enrich 单元测试
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const enrich = require('../../lib/spec/enrich');

describe('spec/enrich', () => {
  const testDir = path.join(__dirname, '../fixtures/enrich');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('ExitCode', () => {
    it('should have correct exit codes', () => {
      assert.strictEqual(enrich.ExitCode.SUCCESS, 0);
      assert.strictEqual(enrich.ExitCode.PARTIAL_SUCCESS, 1);
      assert.strictEqual(enrich.ExitCode.SYSTEM_ERROR, 2);
      assert.strictEqual(enrich.ExitCode.CONFIG_ERROR, 3);
      assert.strictEqual(enrich.ExitCode.SPEC_NOT_FOUND, 4);
    });
  });

  describe('SourceType', () => {
    it('should define quality sources', () => {
      assert.strictEqual(enrich.SourceType.TEST, 'test');
      assert.strictEqual(enrich.SourceType.JSDOC, 'jsdoc');
      assert.strictEqual(enrich.SourceType.AI, 'ai');
      assert.strictEqual(enrich.SourceType.TEMPLATE, 'template');
    });
  });

  describe('enrichSpec', () => {
    it('should return error if specPath not provided', async () => {
      const result = await enrich.enrichSpec({});

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, enrich.ExitCode.CONFIG_ERROR);
    });

    it('should return error if spec file not found', async () => {
      const result = await enrich.enrichSpec({
        specPath: '/non/existent/spec.fspec.md'
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, enrich.ExitCode.SPEC_NOT_FOUND);
    });

    it('should enrich valid spec file', async () => {
      // 创建测试规格文件
      const specDir = path.join(testDir, 'specs');
      fs.mkdirSync(specDir, { recursive: true });
      const specPath = path.join(specDir, 'test.fspec.md');

      const specContent = `---
title: Test Feature
---

# Feature: Test

> 状态: draft
> 版本: 1.0.0

## 概述

Test feature description.

## 功能需求 (Functional Requirements)

### FR-001: Test Function

Test function description.

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | lib/test.js | 实现 |
`;

      fs.writeFileSync(specPath, specContent);

      const result = await enrich.enrichSpec({
        specPath,
        extractTests: false,
        extractJSDoc: false,
        useAI: false
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats);
      assert.strictEqual(result.exitCode, enrich.ExitCode.SUCCESS);
    });

    it('should use AI when enabled (returns partial success if AI fails)', async () => {
      const specDir = path.join(testDir, 'specs');
      fs.mkdirSync(specDir, { recursive: true });
      const specPath = path.join(specDir, 'ai-test.fspec.md');

      const specContent = `---
title: AI Test
---

# Feature: AI Test

> 状态: draft
`;
      fs.writeFileSync(specPath, specContent);

      const result = await enrich.enrichSpec({
        specPath,
        useAI: true,
        aiProvider: 'gemini'
      });

      assert.strictEqual(result.success, true);
      // AI is placeholder, so should be partial success
      assert.strictEqual(result.exitCode, enrich.ExitCode.PARTIAL_SUCCESS);
    });
  });

  describe('inferCodePath', () => {
    it('should infer from derivedOutputs', () => {
      const spec = {
        derivedOutputs: [
          { type: '代码', path: 'lib/router.js' }
        ]
      };

      const result = enrich.inferCodePath(spec);

      assert.strictEqual(result, 'lib/router.js');
    });

    it('should infer from code type', () => {
      const spec = {
        derivedOutputs: [
          { type: 'code', path: 'src/module.js' }
        ]
      };

      const result = enrich.inferCodePath(spec);

      assert.strictEqual(result, 'src/module.js');
    });

    it('should infer from .js extension', () => {
      const spec = {
        derivedOutputs: [
          { type: '实现', path: 'lib/impl.js' }
        ]
      };

      const result = enrich.inferCodePath(spec);

      assert.strictEqual(result, 'lib/impl.js');
    });

    it('should use metadata codePath', () => {
      const spec = {
        metadata: { codePath: 'custom/path/module.js' }
      };

      const result = enrich.inferCodePath(spec);

      assert.strictEqual(result, 'custom/path/module.js');
    });

    it('should return null if cannot infer', () => {
      const spec = {};

      const result = enrich.inferCodePath(spec);

      assert.strictEqual(result, null);
    });
  });

  describe('insertACs', () => {
    it('should insert ACs into spec content', () => {
      const content = `# Feature: Test

## 功能需求 (Functional Requirements)

### FR-001: Test

## 其他章节
`;
      const acs = [
        {
          id: 'AC-001',
          title: 'Test AC',
          source: { line: 10, description: 'test description' },
          scenario: {
            given: '系统正常',
            when: '执行操作',
            then: ['返回成功']
          }
        }
      ];

      const result = enrich.insertACs(content, acs, '/test/file.test.js');

      assert.ok(result.includes('AC-001'));
      assert.ok(result.includes('Test AC'));
      assert.ok(result.includes('验收标准'));
    });

    it('should append to existing AC section', () => {
      const content = `# Feature: Test

## 验收标准 (Acceptance Criteria)

### AC-000: Existing

## 其他
`;
      const acs = [
        {
          id: 'AC-001',
          title: 'New AC',
          source: { line: 5, description: 'new test' },
          scenario: { given: 'G', when: 'W', then: ['T'] }
        }
      ];

      const result = enrich.insertACs(content, acs, '/test.js');

      assert.ok(result.includes('AC-000')); // original
      assert.ok(result.includes('AC-001')); // new
    });
  });

  describe('formatAC', () => {
    it('should format AC with Given-When-Then', () => {
      const ac = {
        id: 'AC-001',
        title: 'Test Scenario',
        source: { line: 15, description: 'should work' },
        scenario: {
          given: '前置条件',
          when: '执行操作',
          then: ['结果1', '结果2']
        },
        verification: {
          code: 'assert.ok(result);'
        }
      };

      const result = enrich.formatAC(ac, '/test/sample.test.js');

      assert.ok(result.includes('### AC-001: Test Scenario'));
      assert.ok(result.includes('Given: 前置条件'));
      assert.ok(result.includes('When: 执行操作'));
      assert.ok(result.includes('Then: 结果1'));
      assert.ok(result.includes('AND 结果2'));
      assert.ok(result.includes('提取自测试'));
      assert.ok(result.includes('assert.ok(result)'));
    });

    it('should handle AC without verification code', () => {
      const ac = {
        id: 'AC-002',
        title: 'Simple AC',
        source: { line: 1, description: 'test' },
        scenario: { given: 'G', when: 'W', then: ['T'] }
      };

      const result = enrich.formatAC(ac, '/test.js');

      assert.ok(result.includes('AC-002'));
      assert.ok(!result.includes('验证'));
    });
  });

  describe('enrichParamsFromJSDoc', () => {
    it('should enrich parameters from JSDoc', () => {
      const content = `## 参数

- \`name\` (string)
- \`options\` (object)
`;
      const docs = [
        {
          params: [
            { name: 'name', type: 'string', description: '用户名称' },
            { name: 'options', type: 'object', description: '配置选项' }
          ]
        }
      ];

      const result = enrich.enrichParamsFromJSDoc(content, docs);

      assert.ok(result.includes('用户名称'));
      assert.ok(result.includes('配置选项'));
      assert.ok(result.includes('提取自 JSDoc'));
    });
  });

  describe('findSpecFiles', () => {
    it('should find .fspec.md files recursively', () => {
      const specsDir = path.join(testDir, 'find-specs');
      fs.mkdirSync(path.join(specsDir, 'core'), { recursive: true });
      fs.mkdirSync(path.join(specsDir, 'features'), { recursive: true });

      fs.writeFileSync(path.join(specsDir, 'core', 'a.fspec.md'), '');
      fs.writeFileSync(path.join(specsDir, 'core', 'b.fspec.md'), '');
      fs.writeFileSync(path.join(specsDir, 'features', 'c.fspec.md'), '');
      fs.writeFileSync(path.join(specsDir, 'readme.md'), ''); // not a spec

      const specs = enrich.findSpecFiles(specsDir);

      assert.strictEqual(specs.length, 3);
      assert.ok(specs.every(s => s.endsWith('.fspec.md')));
    });

    it('should return empty array for non-existent directory', () => {
      const specs = enrich.findSpecFiles('/non/existent/dir');

      assert.deepStrictEqual(specs, []);
    });
  });

  describe('enrichSpecs', () => {
    it('should batch enrich multiple specs', async () => {
      const specsDir = path.join(testDir, 'batch-specs');
      fs.mkdirSync(specsDir, { recursive: true });

      // Create two spec files
      for (const name of ['a', 'b']) {
        fs.writeFileSync(
          path.join(specsDir, `${name}.fspec.md`),
          `# Feature: ${name}\n\n> 状态: draft\n`
        );
      }

      const specPaths = [
        path.join(specsDir, 'a.fspec.md'),
        path.join(specsDir, 'b.fspec.md')
      ];

      const result = await enrich.enrichSpecs(specPaths, {
        extractTests: false,
        extractJSDoc: false,
        useAI: false
      });

      assert.strictEqual(result.results.length, 2);
      assert.strictEqual(result.stats.total, 2);
      assert.strictEqual(result.stats.success, 2);
      assert.strictEqual(result.stats.failed, 0);
    });

    it('should count failures correctly', async () => {
      const result = await enrich.enrichSpecs([
        '/non/existent/a.fspec.md',
        '/non/existent/b.fspec.md'
      ], {});

      assert.strictEqual(result.stats.total, 2);
      assert.strictEqual(result.stats.failed, 2);
      assert.strictEqual(result.stats.success, 0);
    });
  });

  describe('generateFRWithAI', () => {
    it('should return placeholder result', async () => {
      const result = await enrich.generateFRWithAI({}, null, 'gemini');

      assert.strictEqual(result.success, false);
      assert.deepStrictEqual(result.frs, []);
      assert.ok(result.message.includes('尚未实现'));
    });
  });

  describe('generateEnrichedSpec', () => {
    it('should return original content if no enrichment', () => {
      const spec = { raw: '# Original Content\n' };
      const enrichment = { tests: null, jsdoc: null, ai: null };

      const result = enrich.generateEnrichedSpec(spec, enrichment);

      assert.strictEqual(result, '# Original Content\n');
    });

    it('should add ACs from tests', () => {
      const spec = {
        raw: `# Feature: Test

## 功能需求

### FR-001: Test
`
      };
      const enrichment = {
        tests: {
          path: '/test.js',
          acs: [{
            id: 'AC-001',
            title: 'Test AC',
            source: { line: 1, description: 'test' },
            scenario: { given: 'G', when: 'W', then: ['T'] }
          }]
        },
        jsdoc: null,
        ai: null
      };

      const result = enrich.generateEnrichedSpec(spec, enrichment);

      assert.ok(result.includes('AC-001'));
    });
  });
});
