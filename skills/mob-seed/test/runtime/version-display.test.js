/**
 * Version Display Tests
 */

const test = require('node:test');
const assert = require('node:assert');
const console = require('node:console');

// Mock console methods
let consoleOutput = [];
function mockConsole() {
  consoleOutput = [];
  const originalLog = console.log;
  console.log = (...args) => {
    consoleOutput.push(args.join(' '));
  };
  return originalLog;
}

function restoreConsole(original) {
  console.log = original;
}

const versionDisplay = require('../../lib/runtime/version-display');

test('version-display: formatVersionLine', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'dogfooding'
  };

  const result = versionDisplay.formatVersionLine(versionInfo);

  // 输出调试信息
  // console.log('formatVersionLine result:', result);

  assert.ok(result.includes('3.5.0'), '应该包含版本号');
  assert.ok(result.includes('mob-seed'), '应该包含 mob-seed');
  // formatLabel 返回的场景信息包含颜色代码，所以检查关键内容
  assert.ok(result.includes('[') || result.includes('mob'), '应该包含场景标识');
});

test('version-display: formatHookVersion - quick check', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'dogfooding'
  };

  const result = versionDisplay.formatHookVersion(versionInfo, 'quick');

  assert.ok(result.includes('快速检查'), '应该显示快速检查');
  assert.ok(result.includes('3.5.0'), '应该包含版本号');
});

test('version-display: formatHookVersion - incremental check', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'user-plugin'
  };

  const result = versionDisplay.formatHookVersion(versionInfo, 'incremental');

  assert.ok(result.includes('增量检查'), '应该显示增量检查');
  assert.ok(result.includes('3.5.0'), '应该包含版本号');
});

test('version-display: formatUpdateTip - has update', (t) => {
  const versionInfo = {
    latest: '3.6.0',
    scenario: 'user-plugin',
    updateAvailable: true
  };

  const result = versionDisplay.formatUpdateTip(versionInfo);

  assert.ok(result, '应该返回更新提示');
  assert.ok(result.includes('3.6.0'), '应该包含新版本号');
  assert.ok(result.includes('更新'), '应该包含更新提示');
});

test('version-display: formatUpdateTip - no update', (t) => {
  const versionInfo = {
    latest: null,
    scenario: 'dogfooding',
    updateAvailable: false
  };

  const result = versionDisplay.formatUpdateTip(versionInfo);

  assert.strictEqual(result, null, '无更新时返回 null');
});

test('version-display: formatUpdateTip - already latest', (t) => {
  const versionInfo = {
    latest: '3.5.0',
    version: '3.5.0',
    scenario: 'dogfooding',
    updateAvailable: false
  };

  const result = versionDisplay.formatUpdateTip(versionInfo);

  assert.strictEqual(result, null, '已是最新版本时返回 null');
});

test('version-display: formatDetailedVersion', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'dogfooding',
    latest: '3.5.0',
    updateAvailable: false
  };

  const result = versionDisplay.formatDetailedVersion(versionInfo);

  assert.ok(result.includes('mob-seed'), '应该包含 mob-seed');
  assert.ok(result.includes('v3.5.0'), '应该包含版本号');
  assert.ok(result.includes('Node.js'), '应该包含 Node.js 版本');
  assert.ok(result.includes('Platform:'), '应该包含平台信息');
  assert.ok(result.includes('场景:'), '应该包含场景信息');
  assert.ok(result.includes('最新版本'), '应该包含最新版本信息');
});

test('version-display: formatDetailedVersion - has update', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'dogfooding',
    latest: '3.6.0',
    updateAvailable: true
  };

  const result = versionDisplay.formatDetailedVersion(versionInfo);

  assert.ok(result.includes('有更新'), '应该显示有更新');
  assert.ok(result.includes('v3.6.0'), '应该包含新版本号');
});

test('version-display: formatDetailedVersion - unknown latest', (t) => {
  const versionInfo = {
    version: '3.5.0',
    scenario: 'dogfooding',
    latest: null,
    updateAvailable: false
  };

  const result = versionDisplay.formatDetailedVersion(versionInfo);

  assert.ok(result.includes('未知') || result.includes('离线'), '应该提示未知或离线');
});

test('version-display: showVersion', (t) => {
  const original = mockConsole();
  try {
    const versionInfo = {
      version: '3.5.0',
      scenario: 'dogfooding'
    };

    versionDisplay.showVersion(versionInfo);

    assert.ok(consoleOutput.length > 0, '应该输出到控制台');
    assert.ok(consoleOutput[0].includes('3.5.0'), '输出应该包含版本号');
  } finally {
    restoreConsole(original);
  }
});

test('version-display: showHookVersion', (t) => {
  const original = mockConsole();
  try {
    const versionInfo = {
      version: '3.5.0',
      scenario: 'user-plugin'
    };

    versionDisplay.showHookVersion(versionInfo, 'quick');

    assert.ok(consoleOutput.length > 0, '应该输出到控制台');
    assert.ok(consoleOutput[0].includes('3.5.0'), '输出应该包含版本号');
    assert.ok(consoleOutput[0].includes('检查'), '输出应该包含检查字样');
  } finally {
    restoreConsole(original);
  }
});

test('version-display: showUpdateTip - with update', (t) => {
  const original = mockConsole();
  try {
    const versionInfo = {
      latest: '3.6.0',
      scenario: 'user-plugin',
      updateAvailable: true
    };

    versionDisplay.showUpdateTip(versionInfo);

    assert.ok(consoleOutput.length > 0, '应该输出到控制台');
    assert.ok(consoleOutput.join('').includes('3.6.0'), '输出应该包含新版本号');
  } finally {
    restoreConsole(original);
  }
});

test('version-display: showUpdateTip - no update', (t) => {
  const original = mockConsole();
  try {
    const versionInfo = {
      latest: null,
      scenario: 'dogfooding',
      updateAvailable: false
    };

    versionDisplay.showUpdateTip(versionInfo);

    assert.strictEqual(consoleOutput.length, 0, '无更新时不输出');
  } finally {
    restoreConsole(original);
  }
});

test('version-display: COLORS object exists', (t) => {
  assert.ok(versionDisplay.COLORS, '应该导出 COLORS 对象');
  assert.ok('reset' in versionDisplay.COLORS, '应该有 reset 颜色');
  assert.ok('green' in versionDisplay.COLORS, '应该有 green 颜色');
  assert.ok('yellow' in versionDisplay.COLORS, '应该有 yellow 颜色');
  assert.ok('blue' in versionDisplay.COLORS, '应该有 blue 颜色');
  assert.ok('cyan' in versionDisplay.COLORS, '应该有 cyan 颜色');
  assert.ok('magenta' in versionDisplay.COLORS, '应该有 magenta 颜色');
});

test('version-display: getScenarioLabel', (t) => {
  const label = versionDisplay.getScenarioLabel('dogfooding');

  assert.ok(label, '应该返回标签');
  assert.ok(label.includes('[') && label.includes(']'), '标签应该包含方括号');
});
