/**
 * detect-project.js 测试
 *
 * @module test/scripts/detect-project.test
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 导入被测模块
const {
  detectProjectStructure,
  detectTechStack,
  generateConfig,
  generateProjectMd
} = require('../../scripts/detect-project');

// 测试辅助函数
let testDir;

function createTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-project-test-'));
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

describe('detect-project.js', () => {
  beforeEach(() => {
    createTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('detectProjectStructure', () => {
    it('should return detected paths structure', () => {
      const result = detectProjectStructure(testDir);

      assert.ok(result.paths);
      assert.ok(result.projectInfo);
      assert.ok(result.warnings);
    });

    it('should detect src directory when exists', () => {
      fs.mkdirSync(path.join(testDir, 'src'));

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.paths.src, 'src');
    });

    it('should detect lib directory as src alternative', () => {
      fs.mkdirSync(path.join(testDir, 'lib'));

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.paths.src, 'lib');
    });

    it('should detect test directory when exists', () => {
      fs.mkdirSync(path.join(testDir, 'test'));

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.paths.test, 'test');
    });

    it('should detect __tests__ directory', () => {
      fs.mkdirSync(path.join(testDir, '__tests__'));

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.paths.test, '__tests__');
    });

    it('should detect docs directory when exists', () => {
      fs.mkdirSync(path.join(testDir, 'docs'));

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.paths.docs, 'docs');
    });

    it('should use default values when directories not found', () => {
      const result = detectProjectStructure(testDir);

      // 使用默认值 src, test, docs
      assert.strictEqual(result.paths.src, 'src');
      assert.strictEqual(result.paths.test, 'test');
      assert.strictEqual(result.paths.docs, 'docs');
      // 应该有警告
      assert.ok(result.warnings.length > 0);
    });

    it('should extract project info from package.json', () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'my-test-project',
          description: 'Test description',
          version: '2.0.0'
        }),
        'utf8'
      );

      const result = detectProjectStructure(testDir);

      assert.strictEqual(result.projectInfo.name, 'my-test-project');
      assert.strictEqual(result.projectInfo.description, 'Test description');
      assert.strictEqual(result.projectInfo.version, '2.0.0');
    });
  });

  describe('detectTechStack', () => {
    it('should detect JavaScript as default language', () => {
      const pkg = { name: 'test' };

      const result = detectTechStack(pkg);

      assert.strictEqual(result.language, 'JavaScript');
    });

    it('should detect TypeScript when present', () => {
      const pkg = {
        name: 'test',
        devDependencies: { typescript: '^5.0.0' }
      };

      const result = detectTechStack(pkg);

      assert.strictEqual(result.language, 'TypeScript');
    });

    it('should detect jest as test framework', () => {
      const pkg = {
        name: 'test',
        devDependencies: { jest: '^29.0.0' }
      };

      const result = detectTechStack(pkg);

      assert.ok(result.testing.toLowerCase().includes('jest'));
    });

    it('should detect mocha as test framework', () => {
      const pkg = {
        name: 'test',
        devDependencies: { mocha: '^10.0.0' }
      };

      const result = detectTechStack(pkg);

      assert.ok(result.testing.toLowerCase().includes('mocha'));
    });

    it('should detect React framework', () => {
      const pkg = {
        name: 'test',
        dependencies: { react: '^18.0.0' }
      };

      const result = detectTechStack(pkg);

      assert.ok(result.framework.includes('React'));
    });

    it('should detect Vue framework', () => {
      const pkg = {
        name: 'test',
        dependencies: { vue: '^3.0.0' }
      };

      const result = detectTechStack(pkg);

      assert.ok(result.framework.includes('Vue'));
    });
  });

  describe('generateConfig', () => {
    it('should generate config without version field', () => {
      const detected = {
        paths: { src: 'src', test: 'test', docs: 'docs', specs: 'openspec/specs' },
        projectInfo: { name: 'test-project', version: '1.0.0' },
        techStack: { language: 'JavaScript' }
      };

      const config = generateConfig(detected);

      // 验证不包含 version 字段（已移除硬编码）
      assert.strictEqual(config.version, undefined);
      assert.ok(config.paths);
      assert.ok(config.openspec);
      assert.ok(config.mission);
    });

    it('should include correct paths from detection', () => {
      const detected = {
        paths: { src: 'lib', test: 'tests', docs: 'documentation', specs: 'openspec/specs' },
        projectInfo: { name: 'test' },
        techStack: {}
      };

      const config = generateConfig(detected);

      assert.strictEqual(config.paths.src, 'lib');
      assert.strictEqual(config.paths.test, 'tests');
      assert.strictEqual(config.paths.docs, 'documentation');
    });

    it('should have openspec configuration', () => {
      const detected = {
        paths: { src: 'src', test: 'test', docs: 'docs', specs: 'openspec/specs' },
        projectInfo: {},
        techStack: {}
      };

      const config = generateConfig(detected);

      assert.strictEqual(config.openspec.enabled, true);
      assert.strictEqual(config.openspec.root, 'openspec');
    });
  });

  describe('generateProjectMd', () => {
    it('should generate project.md content', () => {
      const detected = {
        paths: { src: 'src', test: 'test', docs: 'docs' },
        projectInfo: { name: 'my-project', description: 'A test project', version: '1.0.0' },
        techStack: { language: 'JavaScript', testing: 'jest' }
      };

      const markdown = generateProjectMd(detected);

      assert.ok(markdown.includes('my-project'));
      assert.ok(markdown.includes('A test project'));
      assert.ok(markdown.includes('JavaScript'));
    });

    it('should handle missing project info gracefully', () => {
      const detected = {
        paths: {},
        projectInfo: {},
        techStack: {}
      };

      const markdown = generateProjectMd(detected);

      assert.ok(typeof markdown === 'string');
      assert.ok(markdown.length > 0);
    });
  });
});
