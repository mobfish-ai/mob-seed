/**
 * test-parser 单元测试
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const testParser = require('../../lib/parsers/test-parser');

describe('test-parser', () => {
  const testDir = path.join(__dirname, '../fixtures/test-parser');

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('extractTestCases', () => {
    it('should extract test() calls', () => {
      const code = `
test('should do something', () => {
  const result = doSomething();
  assert.strictEqual(result, 42);
});
`;
      const tests = testParser.extractTestCases(code);

      assert.strictEqual(tests.length, 1);
      assert.strictEqual(tests[0].type, 'test');
      assert.strictEqual(tests[0].description, 'should do something');
    });

    it('should extract it() calls', () => {
      const code = `
it('should work correctly', () => {
  expect(value).toBe(true);
});
`;
      const tests = testParser.extractTestCases(code);

      assert.strictEqual(tests.length, 1);
      assert.strictEqual(tests[0].type, 'test');
      assert.strictEqual(tests[0].description, 'should work correctly');
    });

    it('should extract describe() as suite', () => {
      const code = `
describe('MyModule', () => {
  test('test 1', () => {});
});
`;
      const tests = testParser.extractTestCases(code);

      assert.strictEqual(tests.length, 2);
      assert.strictEqual(tests[0].type, 'suite');
      assert.strictEqual(tests[0].description, 'MyModule');
      assert.strictEqual(tests[1].type, 'test');
    });

    it('should detect async tests', () => {
      const code = `
test('async test', async () => {
  const result = await fetchData();
  assert.ok(result);
});
`;
      const tests = testParser.extractTestCases(code);

      assert.strictEqual(tests.length, 1);
      assert.strictEqual(tests[0].async, true);
    });

    it('should capture line numbers', () => {
      const code = `// line 1
// line 2
test('on line 3', () => {
  assert.ok(true);
});
`;
      const tests = testParser.extractTestCases(code);

      assert.strictEqual(tests[0].line, 3);
    });
  });

  describe('extractAssertions', () => {
    it('should extract assert.strictEqual', () => {
      const code = `
const result = calculate();
assert.strictEqual(result, 42);
`;
      const assertions = testParser.extractAssertions(code);

      assert.strictEqual(assertions.length, 1);
      assert.strictEqual(assertions[0].type, 'strictEqual');
    });

    it('should extract assert.ok', () => {
      const code = `assert.ok(result);`;
      const assertions = testParser.extractAssertions(code);

      assert.strictEqual(assertions.length, 1);
    });

    it('should extract assert.rejects', () => {
      const code = `await assert.rejects(async () => { throw new Error(); });`;
      const assertions = testParser.extractAssertions(code);

      assert.strictEqual(assertions.length, 1);
      assert.strictEqual(assertions[0].type, 'rejects');
    });

    it('should extract expect style assertions', () => {
      const code = `expect(value).toBe(true);`;
      const assertions = testParser.extractAssertions(code);

      assert.strictEqual(assertions.length, 1);
    });

    it('should extract multiple assertions', () => {
      const code = `
assert.ok(result);
assert.strictEqual(result.count, 5);
assert.deepStrictEqual(result.data, expected);
`;
      const assertions = testParser.extractAssertions(code);

      assert.strictEqual(assertions.length, 3);
    });
  });

  describe('extractTestBody', () => {
    it('should extract simple test body', () => {
      const lines = [
        "test('simple', () => {",
        "  const x = 1;",
        "  assert.ok(x);",
        "});"
      ];

      const { code, endLine } = testParser.extractTestBody(lines, 0);

      assert.ok(code.includes('const x = 1'));
      assert.ok(code.includes('assert.ok(x)'));
      assert.strictEqual(endLine, 3);
    });

    it('should handle nested braces', () => {
      const lines = [
        "test('nested', () => {",
        "  if (true) {",
        "    doSomething();",
        "  }",
        "  assert.ok(true);",
        "});"
      ];

      const { code, endLine } = testParser.extractTestBody(lines, 0);

      assert.strictEqual(endLine, 5);
    });
  });

  describe('extractFromFile', () => {
    it('should return error for non-existent file', () => {
      const result = testParser.extractFromFile('/non/existent/file.test.js');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('不存在'));
    });

    it('should extract tests from file', () => {
      const testFile = path.join(testDir, 'sample.test.js');
      const content = `
const { test, describe } = require('node:test');

describe('Sample', () => {
  test('test one', () => {
    assert.ok(true);
  });

  test('test two', () => {
    assert.strictEqual(1, 1);
  });
});
`;
      fs.writeFileSync(testFile, content);

      const result = testParser.extractFromFile(testFile);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.stats.total, 3); // 1 suite + 2 tests
      assert.strictEqual(result.stats.suites, 1);
      assert.strictEqual(result.stats.tests, 2);
    });
  });

  describe('inferTestPath', () => {
    it('should infer test path from lib', () => {
      // 创建模拟的测试文件
      const srcFile = path.join(testDir, 'lib', 'foo.js');
      const expectedTestFile = path.join(testDir, 'test', 'foo.test.js');

      fs.mkdirSync(path.join(testDir, 'lib'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'test'), { recursive: true });
      fs.writeFileSync(srcFile, 'module.exports = {}');
      fs.writeFileSync(expectedTestFile, 'test()');

      const result = testParser.inferTestPath(srcFile);

      assert.strictEqual(result, expectedTestFile);
    });

    it('should return null if no test file found', () => {
      const result = testParser.inferTestPath('/fake/path/to/module.js');

      assert.strictEqual(result, null);
    });
  });

  describe('generateScenario', () => {
    it('should generate Given-When-Then from test', () => {
      const test = {
        description: 'should calculate sum correctly',
        assertions: [
          { code: 'assert.strictEqual(result, 42)', type: 'strictEqual' }
        ]
      };

      const scenario = testParser.generateScenario(test);

      assert.ok(scenario.given);
      assert.strictEqual(scenario.when, 'should calculate sum correctly');
      assert.ok(Array.isArray(scenario.then));
      assert.ok(scenario.then.length > 0);
    });

    it('should infer Then from strictEqual assertion', () => {
      const test = {
        description: 'test',
        assertions: [{ code: 'assert.strictEqual(x, y)', type: 'strictEqual' }]
      };

      const scenario = testParser.generateScenario(test);

      assert.ok(scenario.then.includes('返回值符合预期'));
    });

    it('should infer Then from rejects assertion', () => {
      const test = {
        description: 'test',
        assertions: [{ code: 'assert.rejects(fn)', type: 'rejects' }]
      };

      const scenario = testParser.generateScenario(test);

      assert.ok(scenario.then.includes('抛出预期错误'));
    });
  });

  describe('testToAC', () => {
    it('should convert test to AC format', () => {
      const test = {
        description: 'should validate input',
        line: 10,
        assertions: [{ code: 'assert.ok(result)', type: 'ok' }],
        body: 'const result = validate();\nassert.ok(result);'
      };

      const ac = testParser.testToAC(test, '/path/to/test.js', 0);

      assert.strictEqual(ac.id, 'AC-001');
      assert.strictEqual(ac.title, 'should validate input');
      assert.strictEqual(ac.source.type, 'test');
      assert.strictEqual(ac.source.line, 10);
      assert.ok(ac.scenario.given);
      assert.ok(ac.scenario.when);
      assert.ok(Array.isArray(ac.scenario.then));
      assert.strictEqual(ac.quality, 'high');
    });

    it('should generate sequential AC IDs', () => {
      const test = { description: 'test', line: 1, assertions: [], body: '' };

      const ac0 = testParser.testToAC(test, '/test.js', 0);
      const ac1 = testParser.testToAC(test, '/test.js', 1);
      const ac2 = testParser.testToAC(test, '/test.js', 2);

      assert.strictEqual(ac0.id, 'AC-001');
      assert.strictEqual(ac1.id, 'AC-002');
      assert.strictEqual(ac2.id, 'AC-003');
    });
  });

  describe('extractACsFromTestFile', () => {
    it('should extract ACs from test file', () => {
      const testFile = path.join(testDir, 'ac-extract.test.js');
      const content = `
test('should parse input', () => {
  const result = parse('input');
  assert.ok(result);
});

test('should handle errors', () => {
  assert.rejects(async () => parse(null));
});
`;
      fs.writeFileSync(testFile, content);

      const result = testParser.extractACsFromTestFile(testFile);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.acs.length, 2);
      assert.strictEqual(result.acs[0].id, 'AC-001');
      assert.strictEqual(result.acs[1].id, 'AC-002');
    });

    it('should skip describe blocks (only extract tests)', () => {
      const testFile = path.join(testDir, 'skip-describe.test.js');
      const content = `
describe('Module', () => {
  test('test 1', () => {});
  test('test 2', () => {});
});
`;
      fs.writeFileSync(testFile, content);

      const result = testParser.extractACsFromTestFile(testFile);

      // Should only have 2 ACs (not 3, since describe is skipped)
      assert.strictEqual(result.acs.length, 2);
    });
  });

  describe('extractVerificationCode', () => {
    it('should extract relevant code from test body', () => {
      const test = {
        body: `test('example', () => {
  const input = 'test';
  const result = process(input);
  assert.strictEqual(result, 'expected');
});`
      };

      const code = testParser.extractVerificationCode(test);

      // Should include setup and assertions
      assert.ok(code.includes("const input = 'test'"));
      assert.ok(code.includes('process(input)'));
      assert.ok(code.includes('assert.strictEqual'));
      // Should not include test() wrapper
      assert.ok(!code.includes("test('example'"));
    });
  });
});
