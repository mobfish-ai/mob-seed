/**
 * 测试文件解析器 (Test Parser)
 *
 * 从测试文件提取测试用例信息：
 * - 测试描述
 * - 测试代码
 * - 断言语句
 *
 * @module skills/mob-seed/lib/parsers/test-parser
 */

const fs = require('fs');
const path = require('path');

/**
 * 测试用例类型
 */
const TestType = {
  TEST: 'test',
  IT: 'it',
  DESCRIBE: 'describe',
  SUITE: 'suite'
};

/**
 * 从测试文件提取测试用例
 * @param {string} filePath - 测试文件路径
 * @returns {Object} 提取结果
 */
function extractFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `文件不存在: ${filePath}`,
      tests: []
    };
  }

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const tests = extractTestCases(code);

    return {
      success: true,
      file: path.basename(filePath),
      path: filePath,
      tests,
      stats: {
        total: tests.length,
        suites: tests.filter(t => t.type === 'suite').length,
        tests: tests.filter(t => t.type === 'test').length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tests: []
    };
  }
}

/**
 * 从代码提取测试用例
 * @param {string} code - 测试代码
 * @returns {Array} 测试用例数组
 */
function extractTestCases(code) {
  const tests = [];
  const lines = code.split('\n');

  // 匹配 test/it/describe 调用
  const testPattern = /^\s*(test|it|describe)\s*\(\s*(['"`])(.+?)\2/;
  const asyncPattern = /async\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(testPattern);

    if (match) {
      const type = match[1] === 'describe' ? 'suite' : 'test';
      const description = match[3];
      const isAsync = asyncPattern.test(line);

      // 提取测试体
      const body = extractTestBody(lines, i);

      // 提取断言
      const assertions = extractAssertions(body.code);

      tests.push({
        type,
        description,
        line: i + 1,
        async: isAsync,
        body: body.code,
        bodyStart: i + 1,
        bodyEnd: body.endLine + 1,
        assertions
      });
    }
  }

  return tests;
}

/**
 * 提取测试体代码
 * @param {Array} lines - 代码行数组
 * @param {number} startLine - 起始行索引
 * @returns {Object} {code, endLine}
 */
function extractTestBody(lines, startLine) {
  let braceCount = 0;
  let started = false;
  let endLine = startLine;
  const bodyLines = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];

    // 计算括号数量
    for (const char of line) {
      if (char === '{' || char === '(') {
        braceCount++;
        started = true;
      } else if (char === '}' || char === ')') {
        braceCount--;
      }
    }

    bodyLines.push(line);
    endLine = i;

    // 当括号闭合时结束
    if (started && braceCount === 0) {
      break;
    }
  }

  return {
    code: bodyLines.join('\n'),
    endLine
  };
}

/**
 * 提取断言语句
 * @param {string} code - 测试代码
 * @returns {Array} 断言数组
 */
function extractAssertions(code) {
  const assertions = [];
  const lines = code.split('\n');

  // 断言模式
  const patterns = [
    // assert 模块
    /assert\s*\.\s*(\w+)\s*\(/,
    /assert\s*\(/,
    // expect 风格
    /expect\s*\(.+?\)\s*\.\s*(\w+)/,
    // assert.rejects / assert.throws
    /assert\s*\.\s*(rejects|throws)\s*\(/
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        assertions.push({
          line: i + 1,
          code: line,
          type: match[1] || 'assert',
          fullLine: line
        });
        break;
      }
    }
  }

  return assertions;
}

/**
 * 推断测试文件路径
 * @param {string} sourcePath - 源文件路径
 * @returns {string|null} 测试文件路径或 null
 */
function inferTestPath(sourcePath) {
  // 尝试多种测试文件命名约定
  const patterns = [
    // lib/foo.js → test/foo.test.js
    (p) => p.replace(/\/lib\//, '/test/').replace(/\.js$/, '.test.js'),
    // lib/foo/bar.js → test/foo/bar.test.js
    (p) => p.replace(/\/lib\//, '/test/').replace(/\.js$/, '.test.js'),
    // src/foo.js → test/foo.test.js
    (p) => p.replace(/\/src\//, '/test/').replace(/\.js$/, '.test.js'),
    // foo.js → foo.test.js (同目录)
    (p) => p.replace(/\.js$/, '.test.js'),
    // foo.js → __tests__/foo.test.js
    (p) => {
      const dir = path.dirname(p);
      const base = path.basename(p, '.js');
      return path.join(dir, '__tests__', `${base}.test.js`);
    }
  ];

  for (const pattern of patterns) {
    const testPath = pattern(sourcePath);
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  return null;
}

/**
 * 生成 Given-When-Then 格式的场景描述
 * @param {Object} test - 测试用例对象
 * @returns {string} 场景描述
 */
function generateScenario(test) {
  const description = test.description;
  const assertions = test.assertions;

  // 分析描述生成 Given-When-Then
  let given = '系统正常运行';
  let when = description;
  let then = [];

  // 从断言推断 Then
  for (const assertion of assertions) {
    const assertCode = assertion.code;

    // 提取断言条件
    if (assertCode.includes('strictEqual')) {
      then.push(`返回值符合预期`);
    } else if (assertCode.includes('ok') || assertCode.includes('(result)')) {
      then.push(`返回结果存在`);
    } else if (assertCode.includes('rejects') || assertCode.includes('throws')) {
      then.push(`抛出预期错误`);
    } else if (assertCode.includes('deepStrictEqual')) {
      then.push(`对象深度相等`);
    } else {
      then.push(`断言通过`);
    }
  }

  // 去重
  then = [...new Set(then)];

  return {
    given,
    when,
    then: then.length > 0 ? then : ['执行成功']
  };
}

/**
 * 将测试用例转换为 AC 格式
 * @param {Object} test - 测试用例对象
 * @param {string} testFilePath - 测试文件路径
 * @param {number} index - AC 索引
 * @returns {Object} AC 对象
 */
function testToAC(test, testFilePath, index) {
  const scenario = generateScenario(test);

  return {
    id: `AC-${String(index + 1).padStart(3, '0')}`,
    title: test.description,
    source: {
      type: 'test',
      file: testFilePath,
      line: test.line,
      description: test.description
    },
    scenario: {
      given: scenario.given,
      when: scenario.when,
      then: scenario.then
    },
    verification: {
      code: extractVerificationCode(test)
    },
    quality: 'high'
  };
}

/**
 * 提取验证代码
 * @param {Object} test - 测试用例
 * @returns {string} 验证代码
 */
function extractVerificationCode(test) {
  // 移除 describe/test 包装，只保留断言相关代码
  const lines = test.body.split('\n');
  const relevantLines = [];
  let inAssertion = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过 test/it/describe 声明行
    if (/^(test|it|describe)\s*\(/.test(trimmed)) {
      continue;
    }

    // 跳过纯括号行
    if (/^[\s{}\(\);]*$/.test(trimmed)) {
      continue;
    }

    // 保留设置和断言代码
    if (trimmed) {
      relevantLines.push(line);
    }
  }

  return relevantLines.join('\n').trim();
}

/**
 * 批量从测试文件提取 AC
 * @param {string} testFilePath - 测试文件路径
 * @returns {Object} 提取结果
 */
function extractACsFromTestFile(testFilePath) {
  const result = extractFromFile(testFilePath);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      acs: []
    };
  }

  // 只处理 test 类型（跳过 describe）
  const testCases = result.tests.filter(t => t.type === 'test');
  const acs = testCases.map((test, index) =>
    testToAC(test, testFilePath, index)
  );

  return {
    success: true,
    file: result.file,
    path: testFilePath,
    acs,
    stats: {
      total: acs.length,
      highQuality: acs.filter(ac => ac.quality === 'high').length
    }
  };
}

// 导出
module.exports = {
  // 类型
  TestType,

  // 核心函数
  extractFromFile,
  extractTestCases,
  extractAssertions,
  extractTestBody,

  // AC 生成
  extractACsFromTestFile,
  testToAC,
  generateScenario,

  // 辅助函数
  inferTestPath,
  extractVerificationCode
};
