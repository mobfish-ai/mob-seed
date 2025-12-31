/**
 * 迁移工具测试
 * @module test/lifecycle/migrator
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  checkMigrationPreConditions,
  findSpecFiles,
  extractDomainFromFileName,
  computeTargetPath,
  backupSpecsDir,
  createOpenSpecStructure,
  updateToArchivedState,
  migrateToOpenSpec,
  generateMigrationReport
} = require('../../lib/lifecycle/migrator');

describe('Migrator', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('extractDomainFromFileName', () => {
    it('should extract domain from hyphenated filename', () => {
      const result = extractDomainFromFileName('user-auth.fspec.md');
      assert.strictEqual(result.domain, 'user');
      assert.strictEqual(result.name, 'auth');
    });

    it('should handle single-word filename', () => {
      const result = extractDomainFromFileName('auth.fspec.md');
      assert.strictEqual(result.domain, 'auth');
      assert.strictEqual(result.name, 'spec');
    });

    it('should handle multi-part filename', () => {
      const result = extractDomainFromFileName('api-v1-users.fspec.md');
      assert.strictEqual(result.domain, 'api');
      assert.strictEqual(result.name, 'v1-users');
    });

    it('should handle .spec.md extension', () => {
      const result = extractDomainFromFileName('user-login.spec.md');
      assert.strictEqual(result.domain, 'user');
      assert.strictEqual(result.name, 'login');
    });
  });

  describe('findSpecFiles', () => {
    it('should find spec files in flat directory', () => {
      const specsDir = path.join(tempDir, 'specs');
      fs.mkdirSync(specsDir);
      fs.writeFileSync(path.join(specsDir, 'auth.fspec.md'), '# Auth');
      fs.writeFileSync(path.join(specsDir, 'user.fspec.md'), '# User');

      const files = findSpecFiles(specsDir);

      assert.strictEqual(files.length, 2);
    });

    it('should find spec files in nested directories', () => {
      const specsDir = path.join(tempDir, 'specs');
      fs.mkdirSync(path.join(specsDir, 'auth'), { recursive: true });
      fs.mkdirSync(path.join(specsDir, 'user'), { recursive: true });
      fs.writeFileSync(path.join(specsDir, 'auth', 'oauth.fspec.md'), '# OAuth');
      fs.writeFileSync(path.join(specsDir, 'user', 'profile.fspec.md'), '# Profile');

      const files = findSpecFiles(specsDir);

      assert.strictEqual(files.length, 2);
    });

    it('should return empty array for non-existent directory', () => {
      const files = findSpecFiles(path.join(tempDir, 'non-existent'));
      assert.deepStrictEqual(files, []);
    });

    it('should ignore non-spec files', () => {
      const specsDir = path.join(tempDir, 'specs');
      fs.mkdirSync(specsDir);
      fs.writeFileSync(path.join(specsDir, 'auth.fspec.md'), '# Auth');
      fs.writeFileSync(path.join(specsDir, 'readme.md'), '# Readme');
      fs.writeFileSync(path.join(specsDir, 'config.json'), '{}');

      const files = findSpecFiles(specsDir);

      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('auth.fspec.md'));
    });
  });

  describe('checkMigrationPreConditions', () => {
    it('should fail if specs/ does not exist', () => {
      const result = checkMigrationPreConditions(tempDir);

      assert.strictEqual(result.canMigrate, false);
      assert.ok(result.issues.some(i => i.includes('不存在')));
    });

    it('should fail if specs/ is empty', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));

      const result = checkMigrationPreConditions(tempDir);

      assert.strictEqual(result.canMigrate, false);
      assert.ok(result.issues.some(i => i.includes('没有规格文件')));
    });

    it('should pass for valid specs/ directory', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));
      fs.writeFileSync(path.join(tempDir, 'specs', 'auth.fspec.md'), '# Auth');

      const result = checkMigrationPreConditions(tempDir);

      assert.strictEqual(result.canMigrate, true);
      assert.strictEqual(result.specsExists, true);
      assert.strictEqual(result.specCount, 1);
    });

    it('should warn if openspec/ already exists', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));
      fs.mkdirSync(path.join(tempDir, 'openspec'));
      fs.writeFileSync(path.join(tempDir, 'specs', 'auth.fspec.md'), '# Auth');

      const result = checkMigrationPreConditions(tempDir);

      assert.strictEqual(result.canMigrate, true);
      assert.strictEqual(result.openspecExists, true);
      assert.ok(result.issues.some(i => i.includes('合并迁移')));
    });
  });

  describe('computeTargetPath', () => {
    it('should compute path for flat spec file', () => {
      const specsDir = path.join(tempDir, 'specs');
      const targetDir = path.join(tempDir, 'openspec', 'specs');
      const sourceFile = path.join(specsDir, 'user-auth.fspec.md');

      const result = computeTargetPath(sourceFile, specsDir, targetDir);

      assert.ok(result.includes('user'));
      assert.ok(result.endsWith('auth.fspec.md'));
    });

    it('should preserve structure for nested spec file', () => {
      const specsDir = path.join(tempDir, 'specs');
      const targetDir = path.join(tempDir, 'openspec', 'specs');
      const sourceFile = path.join(specsDir, 'auth', 'oauth.fspec.md');

      const result = computeTargetPath(sourceFile, specsDir, targetDir);

      assert.ok(result.includes('auth'));
      assert.ok(result.endsWith('oauth.fspec.md'));
    });
  });

  describe('backupSpecsDir', () => {
    it('should create backup with .bak suffix', () => {
      const specsDir = path.join(tempDir, 'specs');
      fs.mkdirSync(specsDir);
      fs.writeFileSync(path.join(specsDir, 'test.fspec.md'), '# Test');

      const backupPath = backupSpecsDir(specsDir);

      assert.ok(fs.existsSync(backupPath));
      assert.ok(backupPath.includes('.bak'));
      assert.ok(fs.existsSync(path.join(backupPath, 'test.fspec.md')));
    });

    it('should add timestamp if .bak already exists', () => {
      const specsDir = path.join(tempDir, 'specs');
      fs.mkdirSync(specsDir);
      fs.mkdirSync(`${specsDir}.bak`);
      fs.writeFileSync(path.join(specsDir, 'test.fspec.md'), '# Test');

      const backupPath = backupSpecsDir(specsDir);

      assert.ok(fs.existsSync(backupPath));
      assert.ok(backupPath.length > `${specsDir}.bak`.length);
    });
  });

  describe('createOpenSpecStructure', () => {
    it('should create all required directories', () => {
      const openspecDir = path.join(tempDir, 'openspec');

      createOpenSpecStructure(openspecDir);

      assert.ok(fs.existsSync(path.join(openspecDir, 'specs')));
      assert.ok(fs.existsSync(path.join(openspecDir, 'changes')));
      assert.ok(fs.existsSync(path.join(openspecDir, 'archive')));
    });

    it('should create project.md template', () => {
      const openspecDir = path.join(tempDir, 'openspec');

      createOpenSpecStructure(openspecDir);

      const projectMdPath = path.join(openspecDir, 'project.md');
      assert.ok(fs.existsSync(projectMdPath));

      const content = fs.readFileSync(projectMdPath, 'utf-8');
      assert.ok(content.includes('Project Conventions'));
    });

    it('should create AGENTS.md template', () => {
      const openspecDir = path.join(tempDir, 'openspec');

      createOpenSpecStructure(openspecDir);

      const agentsMdPath = path.join(openspecDir, 'AGENTS.md');
      assert.ok(fs.existsSync(agentsMdPath));

      const content = fs.readFileSync(agentsMdPath, 'utf-8');
      assert.ok(content.includes('AI Agent'));
    });
  });

  describe('updateToArchivedState', () => {
    it('should add state field if not present', () => {
      const filePath = path.join(tempDir, 'spec.fspec.md');
      fs.writeFileSync(filePath, '# Feature\n\nDescription here.');

      updateToArchivedState(filePath);

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('状态: archived'));
    });

    it('should update existing state field', () => {
      const filePath = path.join(tempDir, 'spec.fspec.md');
      fs.writeFileSync(filePath, '# Feature\n\n> 状态: draft\n\nDescription.');

      updateToArchivedState(filePath);

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('archived'));
      assert.ok(!content.includes('draft'));
    });
  });

  describe('migrateToOpenSpec', () => {
    it('should fail if specs/ does not exist', () => {
      const result = migrateToOpenSpec(tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
    });

    it('should perform dry-run without changes', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));
      fs.writeFileSync(path.join(tempDir, 'specs', 'auth.fspec.md'), '# Auth');

      const result = migrateToOpenSpec(tempDir, { dryRun: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.migrations.length, 1);
      assert.ok(!fs.existsSync(path.join(tempDir, 'openspec')));
    });

    it('should migrate specs to openspec structure', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));
      fs.writeFileSync(
        path.join(tempDir, 'specs', 'user-auth.fspec.md'),
        '# User Auth\n\nDescription.'
      );

      const result = migrateToOpenSpec(tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.migrations.length, 1);
      assert.ok(fs.existsSync(path.join(tempDir, 'openspec', 'specs')));
      assert.ok(result.backupPath.includes('.bak'));
    });

    it('should update state to archived', () => {
      fs.mkdirSync(path.join(tempDir, 'specs'));
      fs.writeFileSync(
        path.join(tempDir, 'specs', 'auth.fspec.md'),
        '# Auth\n\n> 状态: draft\n'
      );

      const result = migrateToOpenSpec(tempDir, { updateState: true });

      assert.strictEqual(result.success, true);

      // 找到迁移后的文件
      const migration = result.migrations[0];
      const targetPath = path.join(tempDir, migration.to);
      const content = fs.readFileSync(targetPath, 'utf-8');

      assert.ok(content.includes('archived'));
    });
  });

  describe('generateMigrationReport', () => {
    it('should generate success report', () => {
      const result = {
        success: true,
        migrations: [
          { from: 'specs/auth.fspec.md', to: 'openspec/specs/auth/spec.fspec.md' }
        ],
        backupPath: '/tmp/specs.bak',
        warnings: [],
        errors: []
      };

      const report = generateMigrationReport(result);

      assert.ok(report.includes('✅'));
      assert.ok(report.includes('迁移完成'));
      assert.ok(report.includes('specs.bak'));
    });

    it('should generate failure report', () => {
      const result = {
        success: false,
        migrations: [],
        backupPath: '',
        warnings: [],
        errors: ['specs/ 目录不存在']
      };

      const report = generateMigrationReport(result);

      assert.ok(report.includes('❌'));
      assert.ok(report.includes('迁移失败'));
      assert.ok(report.includes('不存在'));
    });

    it('should include warnings', () => {
      const result = {
        success: true,
        migrations: [],
        backupPath: '',
        warnings: ['openspec/ 目录已存在'],
        errors: []
      };

      const report = generateMigrationReport(result);

      assert.ok(report.includes('⚠️'));
      assert.ok(report.includes('已存在'));
    });
  });
});
