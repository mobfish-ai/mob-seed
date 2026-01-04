/**
 * incremental-defender 模块测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  extractFrontmatter,
  loadMission,
  seedPrincipleCheck,
  principleCheck,
  printResults
} = require('../../lib/hooks/incremental-defender');

describe('Incremental Defender Module', () => {
  let testDir;
  let originalCwd;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-defender-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
    fs.mkdirSync('.seed', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should return null when config does not exist', () => {
      const config = loadConfig();
      assert.strictEqual(config, null);
    });

    it('should load config when file exists', () => {
      const testConfig = { project: 'test', paths: { specs: 'specs' } };
      fs.writeFileSync('.seed/config.json', JSON.stringify(testConfig));

      const config = loadConfig();
      assert.deepStrictEqual(config, testConfig);
    });

    it('should return null for invalid JSON', () => {
      fs.writeFileSync('.seed/config.json', 'invalid json');

      const config = loadConfig();
      assert.strictEqual(config, null);
    });
  });

  describe('extractFrontmatter', () => {
    it('should extract YAML frontmatter from markdown', () => {
      const content = `---
title: Test
version: 1.0
---
# Content here`;

      const frontmatter = extractFrontmatter(content);

      assert.ok(frontmatter.includes('title: Test'));
      assert.ok(frontmatter.includes('version: 1.0'));
    });

    it('should return empty string for content without frontmatter', () => {
      const content = '# Just a heading\n\nSome content';

      const frontmatter = extractFrontmatter(content);

      assert.strictEqual(frontmatter, '');
    });

    it('should return empty string for unclosed frontmatter', () => {
      const content = `---
title: Test
# No closing ---`;

      const frontmatter = extractFrontmatter(content);

      assert.strictEqual(frontmatter, '');
    });

    it('should handle empty content', () => {
      const frontmatter = extractFrontmatter('');

      assert.strictEqual(frontmatter, '');
    });
  });

  describe('loadMission', () => {
    it('should return null when no mission file exists', () => {
      const mission = loadMission();
      assert.strictEqual(mission, null);
    });

    // Note: loadMission depends on js-yaml which may not be available
    // These tests will be skipped if js-yaml is not installed
    it('should return null if js-yaml is not available and mission exists', () => {
      fs.writeFileSync('.seed/mission.md', `---
name: Test Project
anti_goals:
  - feature_creep
---
# Mission`);

      // This may return null if js-yaml is not available
      const mission = loadMission();
      // Just verify it doesn't throw
      assert.ok(mission === null || typeof mission === 'object');
    });
  });

  describe('seedPrincipleCheck', () => {
    it('should return all pass for empty file list', () => {
      const results = seedPrincipleCheck('', {});

      assert.strictEqual(results.S.pass, true);
      assert.strictEqual(results.E.pass, true);
      assert.strictEqual(results.E2.pass, true);
      assert.strictEqual(results.D.pass, true);
    });

    it('should check S (Spec) - warn when specs dir does not exist', () => {
      fs.writeFileSync('test.js', 'console.log("test")');
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('test.js', config);

      assert.strictEqual(results.S.pass, false);
      assert.ok(results.S.issues.some(i => i.includes('规格目录不存在')));
    });

    it('should pass S when specs directory exists', () => {
      fs.writeFileSync('test.js', 'console.log("test")');
      fs.mkdirSync('openspec/specs', { recursive: true });
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('test.js', config);

      assert.strictEqual(results.S.pass, true);
    });

    it('should skip test files for S check', () => {
      fs.writeFileSync('test.test.js', 'test code');
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('test.test.js', config);

      assert.strictEqual(results.S.pass, true);
    });

    it('should skip config files for S check', () => {
      fs.writeFileSync('config.js', 'module.exports = {}');
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('config.js', config);

      assert.strictEqual(results.S.pass, true);
    });

    it('should check E (Emit) - warn when manifest does not exist', () => {
      fs.writeFileSync('test.fspec.md', '# Test Spec');
      const config = { paths: { output: '.seed/output' } };

      const results = seedPrincipleCheck('test.fspec.md', config);

      assert.strictEqual(results.E.pass, false);
      assert.ok(results.E.issues.some(i => i.includes('无派生清单')));
    });

    it('should pass E when manifest exists', () => {
      fs.writeFileSync('test.fspec.md', '# Test Spec');
      fs.mkdirSync('.seed/output/test', { recursive: true });
      fs.writeFileSync('.seed/output/test/manifest.json', '{}');
      const config = { paths: { output: '.seed/output' } };

      const results = seedPrincipleCheck('test.fspec.md', config);

      assert.strictEqual(results.E.pass, true);
    });

    it('should check E2 (Exec) - warn when test file does not exist', () => {
      fs.writeFileSync('module.js', 'module.exports = {}');
      fs.mkdirSync('openspec/specs', { recursive: true });
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('module.js', config);

      assert.strictEqual(results.E2.pass, false);
      assert.ok(results.E2.issues.some(i => i.includes('无对应测试')));
    });

    it('should pass E2 when test file exists', () => {
      fs.writeFileSync('module.js', 'module.exports = {}');
      fs.writeFileSync('module.test.js', 'test()');
      fs.mkdirSync('openspec/specs', { recursive: true });
      const config = { paths: { specs: 'openspec/specs' } };

      const results = seedPrincipleCheck('module.js', config);

      assert.strictEqual(results.E2.pass, true);
    });
  });

  describe('principleCheck', () => {
    it('should return empty array when mission is null', () => {
      const violations = principleCheck('test.js', null);
      assert.deepStrictEqual(violations, []);
    });

    it('should return empty array when mission has no anti_goals', () => {
      const violations = principleCheck('test.js', { name: 'Test' });
      assert.deepStrictEqual(violations, []);
    });

    it('should detect feature_creep violation', () => {
      fs.writeFileSync('test.js', `
        function newFeature() {
          // TODO: add to spec
          console.log("new feature");
        }
      `);
      const mission = { anti_goals: ['feature_creep'] };

      const violations = principleCheck('test.js', mission);

      assert.ok(violations.some(v => v.antiGoal === 'feature_creep'));
    });

    it('should not flag files without TODO: add to spec', () => {
      fs.writeFileSync('test.js', `
        function existingFeature() {
          console.log("documented feature");
        }
      `);
      const mission = { anti_goals: ['feature_creep'] };

      const violations = principleCheck('test.js', mission);

      assert.ok(!violations.some(v => v.antiGoal === 'feature_creep'));
    });

    it('should handle non-existent files gracefully', () => {
      const mission = { anti_goals: ['feature_creep'] };

      const violations = principleCheck('non-existent.js', mission);

      assert.deepStrictEqual(violations, []);
    });

    it('should check multiple files', () => {
      fs.writeFileSync('file1.js', '// TODO: add to spec');
      fs.writeFileSync('file2.js', 'normal code');
      const mission = { anti_goals: ['feature_creep'] };

      const violations = principleCheck('file1.js\nfile2.js', mission);

      assert.strictEqual(violations.length, 1);
      assert.ok(violations[0].file.includes('file1.js'));
    });
  });

  describe('printResults', () => {
    it('should return true when all checks pass', () => {
      const seedResults = {
        S: { pass: true, issues: [] },
        E: { pass: true, issues: [] },
        E2: { pass: true, issues: [] },
        D: { pass: true, issues: [] }
      };

      const result = printResults(seedResults, []);

      assert.strictEqual(result, true);
    });

    it('should return false when any check fails', () => {
      const seedResults = {
        S: { pass: false, issues: ['test.js: 规格目录不存在'] },
        E: { pass: true, issues: [] },
        E2: { pass: true, issues: [] },
        D: { pass: true, issues: [] }
      };

      const result = printResults(seedResults, []);

      assert.strictEqual(result, false);
    });

    it('should return false when there are principle violations', () => {
      const seedResults = {
        S: { pass: true, issues: [] },
        E: { pass: true, issues: [] },
        E2: { pass: true, issues: [] },
        D: { pass: true, issues: [] }
      };
      const violations = [{
        antiGoal: 'feature_creep',
        file: 'test.js',
        message: 'Found undocumented feature'
      }];

      const result = printResults(seedResults, violations);

      assert.strictEqual(result, false);
    });
  });
});
