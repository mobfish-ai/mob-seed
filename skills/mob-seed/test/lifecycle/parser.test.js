/**
 * 生命周期解析器测试
 * @module test/lifecycle/parser
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseMetadata, parseTitle, parseDeltaRequirements, parseSpecFile, getStatusOverview } = require('../../lib/lifecycle/parser');
const { canTransition, getStateDisplay } = require('../../lib/lifecycle/types');

describe('Lifecycle Parser', () => {
  describe('parseMetadata', () => {
    it('should parse Chinese format metadata', () => {
      const content = `# Feature: 用户认证

> 状态: review
> 版本: 1.2.0
> 技术栈: TypeScript
> 派生路径: src/auth/
`;
      const meta = parseMetadata(content);

      assert.strictEqual(meta.state, 'review');
      assert.strictEqual(meta.version, '1.2.0');
      assert.strictEqual(meta.stack, 'TypeScript');
      assert.strictEqual(meta.emitPath, 'src/auth/');
    });

    it('should parse English format metadata', () => {
      const content = `# Feature: Authentication

> state: implementing
> version: 2.0.0
> stack: Vue
> emitPath: src/views/
`;
      const meta = parseMetadata(content);

      assert.strictEqual(meta.state, 'implementing');
      assert.strictEqual(meta.version, '2.0.0');
      assert.strictEqual(meta.stack, 'Vue');
      assert.strictEqual(meta.emitPath, 'src/views/');
    });

    it('should use defaults for missing fields', () => {
      const content = `# Feature: Simple`;
      const meta = parseMetadata(content);

      assert.strictEqual(meta.state, 'draft');
      assert.strictEqual(meta.version, '1.0.0');
      assert.strictEqual(meta.stack, undefined);
      assert.strictEqual(meta.emitPath, undefined);
    });
  });

  describe('parseTitle', () => {
    it('should parse Feature: prefix', () => {
      const content = `# Feature: 用户登录\n\nSome content`;
      assert.strictEqual(parseTitle(content), '用户登录');
    });

    it('should parse plain title', () => {
      const content = `# Authentication Module\n\nSome content`;
      assert.strictEqual(parseTitle(content), 'Authentication Module');
    });

    it('should return Untitled for missing title', () => {
      const content = `Some content without title`;
      assert.strictEqual(parseTitle(content), 'Untitled');
    });
  });

  describe('parseDeltaRequirements', () => {
    it('should parse ADDED requirements', () => {
      const content = `
## ADDED Requirements

### REQ-001: OAuth 登录支持
The system SHALL support OAuth2 authentication.

**Scenario: Google OAuth 登录**
- WHEN 用户点击"使用 Google 登录"
- THEN 系统重定向到 Google OAuth 页面

**Acceptance Criteria:**
- [ ] AC-001: 支持 Google OAuth
- [ ] AC-002: 支持 token 刷新
`;
      const reqs = parseDeltaRequirements(content, 'ADDED');

      assert.strictEqual(reqs.length, 1);
      assert.strictEqual(reqs[0].type, 'ADDED');
      assert.strictEqual(reqs[0].id, 'REQ-001');
      assert.strictEqual(reqs[0].title, 'OAuth 登录支持');
      assert.ok(reqs[0].description.includes('OAuth2'));
      assert.strictEqual(reqs[0].scenarios.length, 1);
      assert.strictEqual(reqs[0].acceptance.length, 2);
    });

    it('should parse MODIFIED requirements', () => {
      const content = `
## MODIFIED Requirements

### REQ-002: 密码策略更新
The system SHALL enforce 12-character minimum password.
`;
      const reqs = parseDeltaRequirements(content, 'MODIFIED');

      assert.strictEqual(reqs.length, 1);
      assert.strictEqual(reqs[0].type, 'MODIFIED');
      assert.strictEqual(reqs[0].id, 'REQ-002');
    });

    it('should parse REMOVED requirements', () => {
      const content = `
## REMOVED Requirements

### REQ-003: 旧版 Session 认证
Deprecated in favor of JWT tokens.
`;
      const reqs = parseDeltaRequirements(content, 'REMOVED');

      assert.strictEqual(reqs.length, 1);
      assert.strictEqual(reqs[0].type, 'REMOVED');
      assert.strictEqual(reqs[0].id, 'REQ-003');
    });

    it('should return empty array for missing section', () => {
      const content = `# Feature: Test`;
      const reqs = parseDeltaRequirements(content, 'ADDED');

      assert.strictEqual(reqs.length, 0);
    });
  });
});

describe('Lifecycle Types', () => {
  describe('canTransition', () => {
    it('should allow draft → review', () => {
      assert.strictEqual(canTransition('draft', 'review'), true);
    });

    it('should allow review → implementing', () => {
      assert.strictEqual(canTransition('review', 'implementing'), true);
    });

    it('should allow implementing → archived', () => {
      assert.strictEqual(canTransition('implementing', 'archived'), true);
    });

    it('should allow archived → draft (reopen)', () => {
      assert.strictEqual(canTransition('archived', 'draft'), true);
    });

    it('should disallow draft → archived (skip)', () => {
      assert.strictEqual(canTransition('draft', 'archived'), false);
    });

    it('should disallow review → archived (skip)', () => {
      assert.strictEqual(canTransition('review', 'archived'), false);
    });
  });

  describe('getStateDisplay', () => {
    it('should return correct display for draft', () => {
      const display = getStateDisplay('draft');
      assert.strictEqual(display.icon, '📝');
      assert.strictEqual(display.label, '草稿');
    });

    it('should return correct display for archived', () => {
      const display = getStateDisplay('archived');
      assert.strictEqual(display.icon, '✅');
      assert.strictEqual(display.label, '已归档');
    });

    it('should handle unknown state', () => {
      const display = getStateDisplay('unknown');
      assert.strictEqual(display.icon, '❓');
    });
  });
});

describe('getStatusOverview', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));

    // 创建 openspec 结构
    fs.mkdirSync(path.join(tempDir, 'specs', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'changes', 'add-oauth', 'specs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'changes', 'add-2fa', 'specs'), { recursive: true });

    // 创建已归档规格
    fs.writeFileSync(path.join(tempDir, 'specs', 'auth', 'login.fspec.md'), `
# Feature: 用户登录

> 状态: archived
> 版本: 1.0.0
`);

    // 创建变更提案
    fs.writeFileSync(path.join(tempDir, 'changes', 'add-oauth', 'proposal.md'), `
# 提案: OAuth 支持

> 状态: review
> 版本: 1.0.0
`);

    fs.writeFileSync(path.join(tempDir, 'changes', 'add-2fa', 'proposal.md'), `
# 提案: 双因素认证

> 状态: draft
> 版本: 1.0.0
`);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should scan archived specs', () => {
    const overview = getStatusOverview(tempDir);

    assert.strictEqual(overview.archived.length, 1);
    assert.strictEqual(overview.archived[0].title, '用户登录');
    assert.strictEqual(overview.archived[0].metadata.state, 'archived');
  });

  it('should scan change proposals by state', () => {
    const overview = getStatusOverview(tempDir);

    assert.strictEqual(overview.draft.length, 1);
    assert.strictEqual(overview.review.length, 1);
    assert.strictEqual(overview.implementing.length, 0);

    assert.strictEqual(overview.draft[0].name, 'add-2fa');
    assert.strictEqual(overview.review[0].name, 'add-oauth');
  });

  it('should count totals correctly', () => {
    const overview = getStatusOverview(tempDir);

    assert.strictEqual(overview.totalSpecs, 1);
    assert.strictEqual(overview.totalChanges, 2);
  });
});
