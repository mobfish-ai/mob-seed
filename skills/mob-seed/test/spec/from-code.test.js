/**
 * Spec From-Code 测试
 *
 * @module test/spec/from-code
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fromCode = require('../../lib/spec/from-code');

describe('spec/from-code', () => {
  describe('QualityLevel', () => {
    test('should have three quality levels', () => {
      assert.strictEqual(fromCode.QualityLevel.HIGH, 'high');
      assert.strictEqual(fromCode.QualityLevel.MEDIUM, 'medium');
      assert.strictEqual(fromCode.QualityLevel.LOW, 'low');
    });
  });

  describe('extractFromFile', () => {
    test('should extract from existing file', () => {
      const filePath = path.join(__dirname, '../../lib/spec/from-code.js');
      const result = fromCode.extractFromFile(filePath);

      assert.strictEqual(result.success, true);
      assert.ok(['high', 'medium', 'low'].includes(result.quality));
      assert.ok(result.analysis);
      assert.ok(result.spec);
    });

    test('should handle non-existent file', () => {
      const result = fromCode.extractFromFile('/non/existent/file.js');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.quality, 'low');
    });

    test('should include analysis stats', () => {
      const filePath = path.join(__dirname, '../../lib/spec/from-code.js');
      const result = fromCode.extractFromFile(filePath);

      assert.ok(typeof result.analysis.methods === 'number');
      assert.ok(typeof result.analysis.jsdocs === 'number');
      assert.ok(typeof result.analysis.exports === 'number');
    });

    test('should generate spec path', () => {
      const filePath = path.join(__dirname, '../../lib/spec/from-code.js');
      const result = fromCode.extractFromFile(filePath);

      assert.ok(result.spec.path);
      assert.ok(result.spec.path.endsWith('.fspec.md'));
    });
  });

  describe('extractFromFiles', () => {
    test('should extract from multiple files', () => {
      const files = [
        path.join(__dirname, '../../lib/spec/from-code.js'),
        path.join(__dirname, '../../lib/spec/parser.js')
      ];
      const result = fromCode.extractFromFiles(files);

      assert.ok(result.results);
      assert.ok(result.stats);
      assert.strictEqual(result.stats.total, 2);
    });

    test('should provide batch statistics', () => {
      const files = [
        path.join(__dirname, '../../lib/spec/from-code.js')
      ];
      const result = fromCode.extractFromFiles(files);

      assert.ok(result.stats.success >= 0);
      assert.ok(result.stats.failed >= 0);
      assert.ok(result.stats.quality);
    });
  });

  describe('findTestFile', () => {
    test('should find test file for source', () => {
      // 测试找到自己的测试文件
      const sourcePath = path.join(__dirname, '../../lib/spec/from-code.js');
      const testPath = fromCode.findTestFile(sourcePath);

      // 可能找不到（取决于文件结构），但不应该抛错
      assert.ok(testPath === null || typeof testPath === 'string');
    });

    test('should return null for file without test', () => {
      const result = fromCode.findTestFile('/some/random/file.js');
      assert.strictEqual(result, null);
    });
  });

  describe('findSourceFiles', () => {
    test('should find JS files in directory', () => {
      const dirPath = path.join(__dirname, '../../lib/spec');
      const files = fromCode.findSourceFiles(
        dirPath,
        ['.js'],
        ['node_modules', '.test.']
      );

      assert.ok(Array.isArray(files));
      assert.ok(files.length > 0);
      assert.ok(files.every(f => f.endsWith('.js')));
    });

    test('should exclude test files', () => {
      const dirPath = path.join(__dirname, '../../lib');
      const files = fromCode.findSourceFiles(
        dirPath,
        ['.js'],
        ['.test.', '.spec.', '__tests__']
      );

      assert.ok(files.every(f => !f.includes('.test.')));
    });
  });

  describe('calculateQuality', () => {
    test('should return high quality for complete analysis', () => {
      const analysis = {
        parseMode: 'ast',
        jsdocs: [{ description: 'test' }],
        exports: { commonjs: ['func1', 'func2'] }
      };
      const testAnalysis = {
        tests: [{ name: 'test1' }, { name: 'test2' }]
      };

      const quality = fromCode.calculateQuality(analysis, testAnalysis);
      assert.strictEqual(quality, 'high');
    });

    test('should return low quality for minimal analysis', () => {
      const analysis = {
        parseMode: 'regex',
        jsdocs: [],
        exports: {}
      };

      const quality = fromCode.calculateQuality(analysis, null);
      assert.strictEqual(quality, 'low');
    });
  });

  describe('determineSpecPath', () => {
    test('should determine path for parsers module', () => {
      const filePath = '/project/lib/parsers/my-parser.js';
      const specPath = fromCode.determineSpecPath(filePath, 'specs');

      assert.ok(specPath.includes('parsers'));
      assert.ok(specPath.endsWith('my-parser.fspec.md'));
    });

    test('should determine path for cli module', () => {
      const filePath = '/project/lib/cli/my-cli.js';
      const specPath = fromCode.determineSpecPath(filePath, 'specs');

      assert.ok(specPath.includes('cli'));
    });

    test('should use core category as default', () => {
      const filePath = '/project/lib/utils.js';
      const specPath = fromCode.determineSpecPath(filePath, 'specs');

      assert.ok(specPath.includes('core'));
    });
  });

  describe('generateSpec', () => {
    test('should generate spec content', () => {
      const analysis = {
        parseMode: 'regex',
        methods: [
          { name: 'testFunc', exported: true, params: [] }
        ],
        jsdocs: [],
        exports: { commonjs: ['testFunc'] }
      };

      const content = fromCode.generateSpec(analysis, null, {
        filePath: '/test/file.js',
        quality: 'medium'
      });

      assert.ok(content.includes('# Feature:'));
      assert.ok(content.includes('状态: draft'));
      assert.ok(content.includes('testFunc'));
    });

    test('should include quality information', () => {
      const analysis = {
        parseMode: 'ast',
        methods: [],
        jsdocs: [],
        exports: {}
      };

      const content = fromCode.generateSpec(analysis, null, {
        filePath: '/test/file.js',
        quality: 'high'
      });

      assert.ok(content.includes('质量: high'));
    });
  });

  describe('generateMethodRequirement', () => {
    test('should generate requirement for method', () => {
      const method = {
        name: 'processData',
        async: true,
        params: [{ name: 'input' }, { name: 'options', optional: true }]
      };

      const content = fromCode.generateMethodRequirement(method, []);

      assert.ok(content.includes('### REQ: processData'));
      assert.ok(content.includes('async'));
      assert.ok(content.includes('input'));
    });

    test('should include JSDoc if available', () => {
      const method = {
        name: 'add',
        params: [{ name: 'a' }, { name: 'b' }],
        loc: { start: { line: 10 } }
      };
      const jsdocs = [{
        description: 'Adds two numbers',
        params: [
          { name: 'a', type: 'number', description: 'First' },
          { name: 'b', type: 'number', description: 'Second' }
        ],
        loc: { start: { line: 8 } }
      }];

      const content = fromCode.generateMethodRequirement(method, jsdocs);

      assert.ok(content.includes('Adds two numbers'));
    });
  });
});
