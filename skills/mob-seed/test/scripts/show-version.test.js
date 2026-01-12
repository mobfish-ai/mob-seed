/**
 * show-version.js 测试
 *
 * @module test/scripts/show-version.test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// 导入被测模块
const { getSkillDir, showVersion } = require('../../scripts/show-version');

describe('show-version.js', () => {
  describe('getSkillDir', () => {
    it('should return the skill directory path', () => {
      const skillDir = getSkillDir();

      // 应该返回 skills/mob-seed 目录
      assert.ok(typeof skillDir === 'string', 'Should return a string');
      assert.ok(skillDir.endsWith('mob-seed'), 'Should end with mob-seed');
    });

    it('should point to a directory that exists', () => {
      const skillDir = getSkillDir();

      assert.ok(fs.existsSync(skillDir), 'Skill directory should exist');
    });

    it('should contain package.json', () => {
      const skillDir = getSkillDir();
      const pkgPath = path.join(skillDir, 'package.json');

      assert.ok(fs.existsSync(pkgPath), 'package.json should exist in skill dir');
    });

    it('should contain lib/runtime directory', () => {
      const skillDir = getSkillDir();
      const runtimePath = path.join(skillDir, 'lib/runtime');

      assert.ok(fs.existsSync(runtimePath), 'lib/runtime should exist in skill dir');
    });
  });

  describe('showVersion', () => {
    it('should not throw when called', () => {
      // 捕获 console.log 输出
      const originalLog = console.log;
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      try {
        showVersion();

        // 应该有输出
        assert.ok(logs.length > 0, 'Should produce output');

        // 输出应该包含 mob-seed
        const output = logs.join(' ');
        assert.ok(output.includes('mob-seed'), 'Output should contain mob-seed');
      } finally {
        console.log = originalLog;
      }
    });
  });
});
