/**
 * project-detector 单元测试
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const projectDetector = require('../../lib/brownfield/project-detector');

describe('project-detector', () => {
  const testDir = path.join(__dirname, '../fixtures/project-detector');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('ProjectType', () => {
    it('should define project types', () => {
      assert.strictEqual(projectDetector.ProjectType.NODEJS, 'Node.js');
      assert.strictEqual(projectDetector.ProjectType.PYTHON, 'Python');
      assert.strictEqual(projectDetector.ProjectType.GO, 'Go');
      assert.strictEqual(projectDetector.ProjectType.UNKNOWN, 'unknown');
    });
  });

  describe('detectProject', () => {
    it('should detect Node.js project', async () => {
      const projectPath = path.join(testDir, 'nodejs-project');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'test'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'test-project', version: '1.0.0' })
      );
      fs.writeFileSync(path.join(projectPath, 'src', 'index.js'), 'module.exports = {};');

      const result = await projectDetector.detectProject(projectPath);

      assert.strictEqual(result.type, 'Node.js');
      assert.strictEqual(result.name, 'test-project');
      assert.strictEqual(result.srcDir, 'src');
      assert.strictEqual(result.testDir, 'test');
      assert.ok(result.sourceFiles.length >= 1);
    });

    it('should detect Python project', async () => {
      const projectPath = path.join(testDir, 'python-project');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'requirements.txt'), 'flask>=2.0');
      fs.writeFileSync(path.join(projectPath, 'src', 'main.py'), 'print("hello")');

      const result = await projectDetector.detectProject(projectPath);

      assert.strictEqual(result.type, 'Python');
      assert.strictEqual(result.srcDir, 'src');
    });

    it('should detect Go project', async () => {
      const projectPath = path.join(testDir, 'go-project');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'go.mod'),
        'module github.com/test/project\n\ngo 1.21'
      );
      fs.writeFileSync(path.join(projectPath, 'main.go'), 'package main');

      const result = await projectDetector.detectProject(projectPath);

      assert.strictEqual(result.type, 'Go');
      assert.strictEqual(result.name, 'github.com/test/project');
    });

    it('should return unknown for unrecognized project', async () => {
      const projectPath = path.join(testDir, 'unknown-project');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'readme.txt'), 'Some text');

      const result = await projectDetector.detectProject(projectPath);

      assert.strictEqual(result.type, 'unknown');
    });
  });

  describe('detectNodeJS', () => {
    it('should return null if no package.json', async () => {
      const projectPath = path.join(testDir, 'no-package');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await projectDetector.detectNodeJS(projectPath);

      assert.strictEqual(result, null);
    });

    it('should return null if invalid package.json', async () => {
      const projectPath = path.join(testDir, 'invalid-package');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'package.json'), '{}');

      const result = await projectDetector.detectNodeJS(projectPath);

      assert.strictEqual(result, null);
    });

    it('should detect lib directory as srcDir', async () => {
      const projectPath = path.join(testDir, 'lib-project');
      fs.mkdirSync(path.join(projectPath, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'lib-project' })
      );
      fs.writeFileSync(path.join(projectPath, 'lib', 'index.js'), '');

      const result = await projectDetector.detectNodeJS(projectPath);

      assert.strictEqual(result.srcDir, 'lib');
    });
  });

  describe('detectSrcDir', () => {
    it('should find src directory', () => {
      const projectPath = path.join(testDir, 'src-test');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });

      const result = projectDetector.detectSrcDir(projectPath, ['src', 'lib']);

      assert.strictEqual(result, 'src');
    });

    it('should return . if no candidate matches', () => {
      const projectPath = path.join(testDir, 'no-src');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = projectDetector.detectSrcDir(projectPath, ['src', 'lib']);

      assert.strictEqual(result, '.');
    });
  });

  describe('detectTestDir', () => {
    it('should find test directory', () => {
      const projectPath = path.join(testDir, 'test-dir');
      fs.mkdirSync(path.join(projectPath, 'tests'), { recursive: true });

      const result = projectDetector.detectTestDir(projectPath, ['test', 'tests']);

      assert.strictEqual(result, 'tests');
    });

    it('should return default if no candidate matches', () => {
      const projectPath = path.join(testDir, 'no-test');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = projectDetector.detectTestDir(projectPath, ['test', 'tests']);

      assert.strictEqual(result, 'test');
    });
  });

  describe('findSourceFiles', () => {
    it('should find JS files', () => {
      const projectPath = path.join(testDir, 'source-files');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'src', 'a.js'), '');
      fs.writeFileSync(path.join(projectPath, 'src', 'b.ts'), '');
      fs.writeFileSync(path.join(projectPath, 'src', 'c.txt'), '');

      const files = projectDetector.findSourceFiles(
        projectPath,
        'src',
        ['.js', '.ts']
      );

      assert.strictEqual(files.length, 2);
      assert.ok(files.some(f => f.endsWith('a.js')));
      assert.ok(files.some(f => f.endsWith('b.ts')));
    });

    it('should exclude node_modules', () => {
      const projectPath = path.join(testDir, 'exclude-nm');
      fs.mkdirSync(path.join(projectPath, 'node_modules', 'pkg'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'node_modules', 'pkg', 'index.js'), '');
      fs.writeFileSync(path.join(projectPath, 'src', 'app.js'), '');

      const files = projectDetector.findSourceFiles(projectPath, '.', ['.js']);

      assert.ok(!files.some(f => f.includes('node_modules')));
      assert.ok(files.some(f => f.includes('app.js')));
    });

    it('should exclude test files', () => {
      const projectPath = path.join(testDir, 'exclude-tests');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'src', 'app.js'), '');
      fs.writeFileSync(path.join(projectPath, 'src', 'app.test.js'), '');
      fs.writeFileSync(path.join(projectPath, 'src', 'app.spec.js'), '');

      const files = projectDetector.findSourceFiles(projectPath, 'src', ['.js']);

      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('app.js'));
    });
  });

  describe('isTestFile', () => {
    it('should identify test files', () => {
      assert.strictEqual(projectDetector.isTestFile('app.test.js'), true);
      assert.strictEqual(projectDetector.isTestFile('app.spec.js'), true);
      assert.strictEqual(projectDetector.isTestFile('app_test.py'), true);
      assert.strictEqual(projectDetector.isTestFile('test_app.py'), true);
    });

    it('should not identify non-test files', () => {
      assert.strictEqual(projectDetector.isTestFile('app.js'), false);
      assert.strictEqual(projectDetector.isTestFile('testing.js'), false);
      assert.strictEqual(projectDetector.isTestFile('contest.js'), false);
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm', () => {
      const projectPath = path.join(testDir, 'pnpm-project');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'pnpm-lock.yaml'), '');

      const result = projectDetector.detectPackageManager(projectPath);

      assert.strictEqual(result, 'pnpm');
    });

    it('should detect yarn', () => {
      const projectPath = path.join(testDir, 'yarn-project');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(path.join(projectPath, 'yarn.lock'), '');

      const result = projectDetector.detectPackageManager(projectPath);

      assert.strictEqual(result, 'yarn');
    });

    it('should default to npm', () => {
      const projectPath = path.join(testDir, 'npm-project');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = projectDetector.detectPackageManager(projectPath);

      assert.strictEqual(result, 'npm');
    });
  });

  describe('detectModuleType', () => {
    it('should detect ESM', () => {
      const result = projectDetector.detectModuleType({ type: 'module' });
      assert.strictEqual(result, 'esm');
    });

    it('should default to CommonJS', () => {
      const result = projectDetector.detectModuleType({});
      assert.strictEqual(result, 'commonjs');
    });
  });

  describe('generateSuggestedConfig', () => {
    it('should generate config object', () => {
      const projectInfo = {
        type: 'Node.js',
        name: 'test-project',
        srcDir: 'src',
        testDir: 'test',
        sourceFiles: ['src/a.js', 'src/b.js'],
        moduleType: 'esm'
      };

      const config = projectDetector.generateSuggestedConfig(projectInfo);

      assert.strictEqual(config.version, '1.0');
      assert.strictEqual(config.project.name, 'test-project');
      assert.strictEqual(config.project.type, 'Node.js');
      assert.strictEqual(config.paths.src, 'src');
      assert.strictEqual(config.paths.test, 'test');
      assert.strictEqual(config.brownfield.sourceFiles, 2);
      assert.strictEqual(config.brownfield.moduleType, 'esm');
    });
  });
});
