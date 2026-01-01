/**
 * 归档逻辑测试
 * @module test/lifecycle/archiver
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  checkArchivePreConditions,
  extractDomain,
  mergeDeltaToSpec,
  formatRequirement,
  archiveProposal,
  getArchivableProposals,
  archiveAll
} = require('../../lib/lifecycle/archiver');

describe('Archiver', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archiver-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('extractDomain', () => {
    it('should extract domain from nested path', () => {
      const filePath = 'openspec/changes/add-oauth/specs/auth/oauth.fspec.md';
      assert.strictEqual(extractDomain(filePath), 'auth');
    });

    it('should use filename as domain for flat path', () => {
      const filePath = 'openspec/changes/add-oauth/specs/oauth.fspec.md';
      assert.strictEqual(extractDomain(filePath), 'oauth');
    });
  });

  describe('formatRequirement', () => {
    it('should format requirement with all fields', () => {
      const req = {
        id: 'REQ-001',
        title: 'OAuth 登录支持',
        description: 'The system SHALL support OAuth2 authentication.',
        scenarios: [
          { name: 'Google OAuth', when: '用户点击登录', then: '重定向到 Google' }
        ],
        acceptance: ['AC-001: 支持 Google', 'AC-002: 支持 token 刷新']
      };

      const md = formatRequirement(req);

      assert.ok(md.includes('### REQ-001: OAuth 登录支持'));
      assert.ok(md.includes('OAuth2 authentication'));
      assert.ok(md.includes('**Scenario: Google OAuth**'));
      assert.ok(md.includes('WHEN 用户点击登录'));
      assert.ok(md.includes('THEN 重定向到 Google'));
      assert.ok(md.includes('AC-001'));
      assert.ok(md.includes('AC-002'));
    });

    it('should handle minimal requirement', () => {
      const req = {
        id: 'REQ-002',
        title: '简单需求'
      };

      const md = formatRequirement(req);

      assert.ok(md.includes('### REQ-002: 简单需求'));
    });
  });

  describe('checkArchivePreConditions', () => {
    it('should fail if proposal directory does not exist', () => {
      const result = checkArchivePreConditions(
        path.join(tempDir, 'non-existent')
      );

      assert.strictEqual(result.canArchive, false);
      assert.ok(result.issues.some(i => i.includes('不存在')));
    });

    it('should fail if proposal.md is missing', () => {
      const proposalPath = path.join(tempDir, 'test-proposal');
      fs.mkdirSync(proposalPath, { recursive: true });

      const result = checkArchivePreConditions(proposalPath);

      assert.strictEqual(result.canArchive, false);
      assert.strictEqual(result.filesComplete, false);
    });

    it('should fail if state is not implementing', () => {
      const proposalPath = path.join(tempDir, 'test-proposal');
      fs.mkdirSync(path.join(proposalPath, 'specs'), { recursive: true });

      fs.writeFileSync(
        path.join(proposalPath, 'proposal.md'),
        '# 提案\n\n> 状态: draft\n'
      );

      const result = checkArchivePreConditions(proposalPath);

      assert.strictEqual(result.canArchive, false);
      assert.strictEqual(result.currentState, 'draft');
    });

    it('should pass for valid implementing proposal', () => {
      const proposalPath = path.join(tempDir, 'test-proposal');
      fs.mkdirSync(path.join(proposalPath, 'specs'), { recursive: true });

      fs.writeFileSync(
        path.join(proposalPath, 'proposal.md'),
        '# 提案\n\n> 状态: implementing\n'
      );

      fs.writeFileSync(
        path.join(proposalPath, 'specs', 'test.fspec.md'),
        '# Feature: Test\n'
      );

      const result = checkArchivePreConditions(proposalPath);

      assert.strictEqual(result.canArchive, true);
      assert.strictEqual(result.currentState, 'implementing');
      assert.strictEqual(result.filesComplete, true);
    });
  });

  describe('mergeDeltaToSpec', () => {
    it('should create new spec file if not exists', () => {
      const targetPath = path.join(tempDir, 'specs', 'auth', 'spec.fspec.md');
      const delta = {
        added: [{
          id: 'REQ-001',
          title: 'OAuth 支持',
          description: 'The system SHALL support OAuth.'
        }],
        modified: [],
        removed: []
      };

      const result = mergeDeltaToSpec(targetPath, delta);

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.added, ['REQ-001']);

      const content = fs.readFileSync(targetPath, 'utf-8');
      assert.ok(content.includes('REQ-001'));
      assert.ok(content.includes('OAuth 支持'));
    });

    it('should add requirements to existing spec', () => {
      const targetPath = path.join(tempDir, 'existing.fspec.md');

      // 创建已有规格
      fs.writeFileSync(targetPath, `# 规格

> 状态: archived
> 版本: 1.0.0
> 最后更新: 2026-01-01

## Requirements

### REQ-001: 现有需求
现有描述。

`);

      const delta = {
        added: [{
          id: 'REQ-002',
          title: '新需求',
          description: 'The system SHALL do new thing.'
        }],
        modified: [],
        removed: []
      };

      const result = mergeDeltaToSpec(targetPath, delta);

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.added, ['REQ-002']);

      const content = fs.readFileSync(targetPath, 'utf-8');
      assert.ok(content.includes('REQ-001'));
      assert.ok(content.includes('REQ-002'));
    });

    it('should handle dry-run mode', () => {
      const targetPath = path.join(tempDir, 'dryrun.fspec.md');
      const delta = {
        added: [{
          id: 'REQ-001',
          title: '测试',
          description: 'Test'
        }],
        modified: [],
        removed: []
      };

      const result = mergeDeltaToSpec(targetPath, delta, { dryRun: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(targetPath), false);
    });
  });

  describe('archiveProposal', () => {
    it('should fail for non-existent proposal', () => {
      const result = archiveProposal('non-existent', tempDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
    });

    it('should archive valid implementing proposal', () => {
      // 创建完整的提案结构
      const changesDir = path.join(tempDir, 'changes', 'add-oauth');
      fs.mkdirSync(path.join(changesDir, 'specs', 'auth'), { recursive: true });

      fs.writeFileSync(
        path.join(changesDir, 'proposal.md'),
        '# OAuth 支持\n\n> 状态: implementing\n> 版本: 1.0.0\n'
      );

      fs.writeFileSync(
        path.join(changesDir, 'specs', 'auth', 'oauth.fspec.md'),
        `# Feature: OAuth

> 状态: implementing

## ADDED Requirements

### REQ-001: OAuth 登录
The system SHALL support OAuth login.

**Acceptance Criteria:**
- [ ] AC-001: 支持 Google OAuth
`
      );

      // 创建 specs 目录
      fs.mkdirSync(path.join(tempDir, 'specs'), { recursive: true });

      const result = archiveProposal('add-oauth', tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.proposalName, 'add-oauth');
      assert.ok(result.deltaSummary.added.includes('REQ-001'));

      // 验证归档目录
      assert.ok(result.archivePath.includes('archive'));
      assert.ok(fs.existsSync(result.archivePath));

      // 验证真相源已更新
      const specsAuthDir = path.join(tempDir, 'specs', 'auth');
      assert.ok(fs.existsSync(specsAuthDir));
    });
  });

  describe('getArchivableProposals', () => {
    it('should return empty for non-existent changes dir', () => {
      const result = getArchivableProposals(tempDir);
      assert.deepStrictEqual(result, []);
    });

    it('should return only implementing proposals', () => {
      const changesDir = path.join(tempDir, 'changes');

      // 创建 draft 提案
      fs.mkdirSync(path.join(changesDir, 'draft-proposal', 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(changesDir, 'draft-proposal', 'proposal.md'),
        '# Draft\n\n> 状态: draft\n'
      );

      // 创建 implementing 提案
      fs.mkdirSync(path.join(changesDir, 'ready-proposal', 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(changesDir, 'ready-proposal', 'proposal.md'),
        '# Ready\n\n> 状态: implementing\n'
      );

      const result = getArchivableProposals(tempDir);

      assert.strictEqual(result.length, 1);
      assert.ok(result.includes('ready-proposal'));
      assert.ok(!result.includes('draft-proposal'));
    });
  });
});
