/**
 * AST JavaScript Parser 测试
 *
 * @module test/parsers/ast-javascript
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const astParser = require('../../lib/parsers/ast-javascript');

describe('ast-javascript parser', () => {
  describe('getParseMode', () => {
    test('should return parse mode', () => {
      const mode = astParser.getParseMode();
      assert.ok(['ast', 'regex'].includes(mode));
    });
  });

  describe('extractMethodsRegex', () => {
    test('should extract function declarations', () => {
      const code = `
        function hello(name) {
          return 'Hello ' + name;
        }

        async function fetchData(url) {
          return fetch(url);
        }
      `;
      const methods = astParser.extractMethodsRegex(code);

      assert.ok(methods.length >= 2);
      assert.ok(methods.some(m => m.name === 'hello'));
      assert.ok(methods.some(m => m.name === 'fetchData' && m.async));
    });

    test('should extract arrow functions', () => {
      const code = `
        const add = (a, b) => a + b;
        const greet = async (name) => {
          return 'Hello ' + name;
        };
      `;
      const methods = astParser.extractMethodsRegex(code);

      assert.ok(methods.length >= 2);
      assert.ok(methods.some(m => m.name === 'add' && m.type === 'arrow'));
      assert.ok(methods.some(m => m.name === 'greet' && m.async));
    });

    test('should handle empty code', () => {
      const methods = astParser.extractMethodsRegex('');
      assert.deepStrictEqual(methods, []);
    });
  });

  describe('extractJSDocRegex', () => {
    test('should extract JSDoc comments', () => {
      const code = `
        /**
         * Adds two numbers
         * @param {number} a - First number
         * @param {number} b - Second number
         * @returns {number} Sum
         */
        function add(a, b) {
          return a + b;
        }
      `;
      const jsdocs = astParser.extractJSDocRegex(code);

      assert.strictEqual(jsdocs.length, 1);
      assert.ok(jsdocs[0].description.includes('Adds two numbers'));
      assert.strictEqual(jsdocs[0].params.length, 2);
      assert.ok(jsdocs[0].returns);
    });

    test('should parse param types', () => {
      const code = `
        /**
         * Test function
         * @param {string} name - User name
         * @param {Object} [options] - Optional config
         */
        function test(name, options) {}
      `;
      const jsdocs = astParser.extractJSDocRegex(code);

      assert.strictEqual(jsdocs.length, 1);
      assert.strictEqual(jsdocs[0].params[0].type, 'string');
      assert.strictEqual(jsdocs[0].params[0].name, 'name');
    });

    test('should handle code without JSDoc', () => {
      const code = `
        function noDoc() {}
      `;
      const jsdocs = astParser.extractJSDocRegex(code);
      assert.strictEqual(jsdocs.length, 0);
    });
  });

  describe('extractImportsRegex', () => {
    test('should extract CommonJS requires', () => {
      const code = `
        const fs = require('fs');
        const { join } = require('path');
      `;
      const imports = astParser.extractImportsRegex(code);

      assert.ok(imports.length >= 2);
      assert.ok(imports.some(i => i.source === 'fs'));
      assert.ok(imports.some(i => i.source === 'path'));
    });

    test('should extract ES6 imports', () => {
      const code = `
        import fs from 'fs';
        import { join, resolve } from 'path';
      `;
      const imports = astParser.extractImportsRegex(code);

      assert.ok(imports.length >= 2);
      assert.ok(imports.some(i => i.source === 'fs'));
      assert.ok(imports.some(i => i.source === 'path'));
    });
  });

  describe('extractTestCases', () => {
    test('should extract test cases', () => {
      const code = `
        describe('my module', () => {
          test('should do something', () => {
            expect(true).toBe(true);
          });

          it('should handle errors', () => {
            expect(() => {}).not.toThrow();
          });
        });
      `;
      const tests = astParser.extractTestCases(code);

      assert.ok(tests.length >= 3);
      assert.ok(tests.some(t => t.name === 'my module' && t.type === 'suite'));
      assert.ok(tests.some(t => t.name === 'should do something'));
      assert.ok(tests.some(t => t.name === 'should handle errors'));
    });

    test('should handle code without tests', () => {
      const code = 'function hello() {}';
      const tests = astParser.extractTestCases(code);
      assert.strictEqual(tests.length, 0);
    });
  });

  describe('extractExportsRegex', () => {
    test('should extract CommonJS exports', () => {
      const code = `
        function hello() {}
        function world() {}

        module.exports = {
          hello,
          world
        };
      `;
      const exports = astParser.extractExportsRegex(code);

      assert.ok(exports.commonjs);
      assert.ok(exports.commonjs.includes('hello'));
      assert.ok(exports.commonjs.includes('world'));
    });

    test('should extract ES6 named exports', () => {
      const code = `
        export function hello() {}
        export const world = 'world';
      `;
      const exports = astParser.extractExportsRegex(code);

      assert.ok(exports.named.includes('hello'));
      assert.ok(exports.named.includes('world'));
    });
  });

  describe('parseJSDocComment', () => {
    test('should parse complete JSDoc', () => {
      const content = `
       * A test function
       * @param {string} name - The name
       * @returns {boolean} True if valid
       * @throws Error on invalid input
       * @example
       * test('hello');
      `;
      const parsed = astParser.parseJSDocComment(content);

      assert.ok(parsed.description.includes('test function'));
      assert.strictEqual(parsed.params.length, 1);
      assert.strictEqual(parsed.params[0].type, 'string');
      assert.ok(parsed.returns);
      assert.strictEqual(parsed.throws.length, 1);
      assert.strictEqual(parsed.examples.length, 1);
    });

    test('should handle empty content', () => {
      const parsed = astParser.parseJSDocComment('');
      assert.strictEqual(parsed, null);
    });
  });

  describe('analyzeFile', () => {
    test('should analyze existing file', () => {
      // 分析自身作为测试
      const selfPath = path.join(__dirname, '../../lib/parsers/ast-javascript.js');
      const result = astParser.analyzeFile(selfPath);

      assert.ok(result.file);
      assert.ok(result.path);
      assert.ok(result.parseMode);
      assert.ok(Array.isArray(result.methods));
      assert.ok(Array.isArray(result.jsdocs));
      assert.ok(Array.isArray(result.imports));
      assert.ok(result.exports);
    });
  });

  describe('analyzeFiles', () => {
    test('should analyze multiple files', () => {
      const files = [
        path.join(__dirname, '../../lib/parsers/ast-javascript.js')
      ];
      const results = astParser.analyzeFiles(files);

      assert.strictEqual(results.length, 1);
      assert.ok(results[0].file);
    });

    test('should handle non-existent files gracefully', () => {
      const files = ['/non/existent/file.js'];
      const results = astParser.analyzeFiles(files);

      assert.strictEqual(results.length, 1);
      assert.ok(results[0].error);
    });
  });
});
