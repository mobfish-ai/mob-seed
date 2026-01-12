/**
 * verify-insights.js 的测试
 *
 * @module test/scripts/verify-insights.test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('verify-insights.js', () => {
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'verify-insights.js');

  it('应该存在脚本文件', () => {
    assert(fs.existsSync(scriptPath), '脚本文件应该存在');
  });

  it('脚本应该是可执行的', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('#!/usr/bin/env node'), '脚本应该有 shebang');
    assert(content.includes('verify-insights'), '脚本应该包含相关内容');
  });

  it('脚本应该导出必要的函数', () => {
    // 由于脚本是直接执行的，这里只检查文件内容
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('function getInsightsDir'), '应该定义 getInsightsDir 函数');
    assert(content.includes('function readIndex'), '应该定义 readIndex 函数');
    assert(content.includes('function scanInsightFiles'), '应该定义 scanInsightFiles 函数');
    assert(content.includes('function generateIndex'), '应该定义 generateIndex 函数');
  });
});
