import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * verify-insights.js 的测试
 *
 * 由于此脚本主要涉及文件系统和软链接操作，
 * 这里只测试基本的导出和功能是否存在。
 */

// 脚本使用 CommonJS，这里只做基本验证
describe('verify-insights.js', () => {
  it('应该存在脚本文件', () => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'verify-insights.js');
    assert(fs.existsSync(scriptPath), '脚本文件应该存在');
  });

  it('脚本应该是可执行的', () => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'verify-insights.js');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('#!/usr/bin/env node'), '脚本应该有 shebang');
    assert(content.includes('verify-insights'), '脚本应该包含相关内容');
  });
});
