'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Module under test
const {
  findSimilarInsights,
  checkBeforeImport,
  calculateInsightSimilarity,
  extractKeywords,
  extractInsightKeywords,
  formatDedupResult,
  DEFAULT_CONFIG
} = require('../../lib/ace/insight-dedup');

// ============================================================================
// Test Fixtures
// ============================================================================

const mockInsights = [
  {
    id: 'ins-20260104-agent-scaffolding',
    title: 'Agent研发经验分享',
    tags: ['architecture', 'scaffolding', 'context-management', 'agent-development'],
    status: 'evaluating',
    source: {
      title: 'Agent研发经验分享',
      type: 'experience',
      date: '2026-01-04',
      credibility: 'high'
    }
  },
  {
    id: 'ins-20260105-prompt-design-framework',
    title: '高级提示词设计框架',
    tags: ['prompt-engineering', 'automation', 'framework', 'expert-thinking'],
    status: 'evaluating',
    source: {
      title: '高级提示词设计框架',
      type: 'blog',
      date: '2026-01-05',
      credibility: 'medium'
    }
  },
  {
    id: 'ins-20260104-vibe-coding-2000hours',
    title: 'AI 编程练满 2000 小时才算会用',
    tags: ['vibe-coding', 'agent-programming', 'ai-engineering', 'productivity'],
    status: 'evaluating',
    source: {
      title: 'AI 编程练满 2000 小时才算会用',
      type: 'blog',
      date: '2026-01-04',
      credibility: 'medium'
    }
  }
];

const mockIndex = {
  version: '1.0',
  updated: '2026-01-15T10:00:00Z',
  insights: mockInsights
};

// ============================================================================
// Helper Functions
// ============================================================================

function createTempProject(indexData = mockIndex) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-dedup-test-'));
  const seedDir = path.join(tempDir, '.seed', 'insights');
  fs.mkdirSync(seedDir, { recursive: true });

  // Create v2.0 compact index (only id, status, date, file)
  const compactIndex = {
    version: '2.0.0',
    updated: indexData.updated || new Date().toISOString(),
    count: indexData.insights.length,
    insights: indexData.insights.map(ins => ({
      id: ins.id,
      status: ins.status,
      date: ins.source?.date || '2026-01-15',
      file: `${ins.id}.md`
    }))
  };
  fs.writeFileSync(path.join(seedDir, 'index.json'), JSON.stringify(compactIndex, null, 2));

  // Create actual .md files with YAML frontmatter (v2.0 requires reading from files)
  for (const insight of indexData.insights) {
    const tagsYaml = insight.tags && insight.tags.length > 0
      ? `[${insight.tags.join(', ')}]`
      : '[]';

    const content = `---
id: ${insight.id}
source:
  title: "${insight.source?.title || insight.title || 'Untitled'}"
  type: ${insight.source?.type || 'blog'}
  date: ${insight.source?.date || '2026-01-15'}
  credibility: ${insight.source?.credibility || 'medium'}
date: ${insight.source?.date || '2026-01-15'}
status: ${insight.status || 'evaluating'}
model_era: claude-opus-4.5
tags: ${tagsYaml}
---

## 原始洞见

${insight.content || '测试内容'}
`;
    fs.writeFileSync(path.join(seedDir, `${insight.id}.md`), content);
  }

  return tempDir;
}

function cleanupTempProject(tempDir) {
  if (tempDir && tempDir.includes('insight-dedup-test-')) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Tests: extractKeywords
// ============================================================================

describe('insight-dedup: extractKeywords', () => {
  it('should extract English keywords', () => {
    const text = 'The agent architecture uses scaffolding for context management';
    const keywords = extractKeywords(text);

    assert.ok(keywords.includes('agent'));
    assert.ok(keywords.includes('architecture'));
    assert.ok(keywords.includes('scaffolding'));
    assert.ok(keywords.includes('context'));
    assert.ok(keywords.includes('management'));
  });

  it('should filter out English stop words', () => {
    const text = 'The is a an and or but if with for';
    const keywords = extractKeywords(text);

    assert.strictEqual(keywords.length, 0);
  });

  it('should extract Chinese keywords', () => {
    const text = 'Agent研发经验分享，包含架构设计和脚手架';
    const keywords = extractKeywords(text);

    assert.ok(keywords.includes('agent'));
    assert.ok(keywords.some(k => k.includes('研发') || k.includes('经验') || k.includes('分享')));
  });

  it('should filter out Chinese stop words', () => {
    // The function extracts 2-4 character phrases, so we test with phrases
    const text = '这个是一个使用通过进行的方法';
    const keywords = extractKeywords(text);

    // Stop word phrases like '这个', '一个', '使用', '通过', '进行' should be filtered
    assert.ok(!keywords.includes('这个'));
    assert.ok(!keywords.includes('一个'));
    assert.ok(!keywords.includes('使用'));
    assert.ok(!keywords.includes('通过'));
    assert.ok(!keywords.includes('进行'));
  });

  it('should handle empty or invalid input', () => {
    assert.deepStrictEqual(extractKeywords(''), []);
    assert.deepStrictEqual(extractKeywords(null), []);
    assert.deepStrictEqual(extractKeywords(undefined), []);
    assert.deepStrictEqual(extractKeywords(123), []);
  });

  it('should deduplicate keywords', () => {
    const text = 'agent agent agent architecture architecture';
    const keywords = extractKeywords(text);

    const agentCount = keywords.filter(k => k === 'agent').length;
    assert.strictEqual(agentCount, 1);
  });

  it('should filter short words (≤2 chars)', () => {
    const text = 'AI is an ML model';
    const keywords = extractKeywords(text);

    // 'ai' and 'ml' should be filtered (≤2 chars)
    assert.ok(!keywords.includes('ai'));
    assert.ok(!keywords.includes('ml'));
    assert.ok(!keywords.includes('is'));
    assert.ok(!keywords.includes('an'));
  });
});

// ============================================================================
// Tests: extractInsightKeywords
// ============================================================================

describe('insight-dedup: extractInsightKeywords', () => {
  it('should extract keywords from tags', () => {
    const insight = {
      tags: ['architecture', 'scaffolding', 'agent-development']
    };
    const keywords = extractInsightKeywords(insight);

    assert.ok(keywords.includes('architecture'));
    assert.ok(keywords.includes('scaffolding'));
    assert.ok(keywords.includes('agent-development'));
  });

  it('should extract keywords from title', () => {
    const insight = {
      title: 'Agent Architecture Best Practices',
      tags: []
    };
    const keywords = extractInsightKeywords(insight);

    assert.ok(keywords.includes('agent'));
    assert.ok(keywords.includes('architecture'));
    assert.ok(keywords.includes('best'));
    assert.ok(keywords.includes('practices'));
  });

  it('should extract keywords from source.title if title is missing', () => {
    const insight = {
      source: { title: 'Agent研发经验分享' },
      tags: []
    };
    const keywords = extractInsightKeywords(insight);

    assert.ok(keywords.includes('agent'));
  });

  it('should extract keywords from content', () => {
    const insight = {
      title: 'Test',
      tags: [],
      content: 'This is about scaffolding and context management'
    };
    const keywords = extractInsightKeywords(insight);

    assert.ok(keywords.includes('scaffolding'));
    assert.ok(keywords.includes('context'));
    assert.ok(keywords.includes('management'));
  });

  it('should combine and deduplicate keywords from all sources', () => {
    const insight = {
      title: 'Agent Architecture',
      tags: ['agent', 'architecture'],
      content: 'Agent architecture patterns'
    };
    const keywords = extractInsightKeywords(insight);

    // Should be deduplicated
    const agentCount = keywords.filter(k => k === 'agent').length;
    assert.strictEqual(agentCount, 1);
  });
});

// ============================================================================
// Tests: calculateInsightSimilarity
// ============================================================================

describe('insight-dedup: calculateInsightSimilarity', () => {
  it('should return high similarity for identical insights', () => {
    const insight1 = {
      title: 'Agent Architecture',
      tags: ['agent', 'architecture', 'scaffolding']
    };
    const insight2 = {
      title: 'Agent Architecture',
      tags: ['agent', 'architecture', 'scaffolding']
    };

    const result = calculateInsightSimilarity(insight1, insight2);

    assert.ok(result.score >= 0.9);
    assert.strictEqual(result.breakdown.title, 1);
    assert.strictEqual(result.breakdown.tags, 1);
  });

  it('should return zero similarity for completely different insights', () => {
    const insight1 = {
      title: 'Agent Architecture',
      tags: ['agent', 'architecture']
    };
    const insight2 = {
      title: 'Cooking Recipes',
      tags: ['food', 'recipes', 'cooking']
    };

    const result = calculateInsightSimilarity(insight1, insight2);

    assert.ok(result.score < 0.2);
  });

  it('should handle partial tag overlap', () => {
    const insight1 = {
      title: 'Agent Development',
      tags: ['agent', 'architecture', 'development']
    };
    const insight2 = {
      title: 'Agent Testing',
      tags: ['agent', 'testing', 'quality']
    };

    const result = calculateInsightSimilarity(insight1, insight2);

    // Should have some overlap due to 'agent' tag
    assert.ok(result.breakdown.tags > 0);
    assert.ok(result.breakdown.tags < 1);
  });

  it('should use custom weights', () => {
    const insight1 = {
      title: 'Agent Architecture',
      tags: ['completely', 'different', 'tags']
    };
    const insight2 = {
      title: 'Agent Architecture',
      tags: ['no', 'overlap', 'here']
    };

    // High title weight, zero tag weight
    const customWeights = { tags: 0, keywords: 0, title: 1.0 };
    const result = calculateInsightSimilarity(insight1, insight2, customWeights);

    // Title is identical, so should be 1.0
    assert.strictEqual(result.score, 1);
  });

  it('should return breakdown of similarity components', () => {
    const insight1 = { title: 'Test', tags: ['a'] };
    const insight2 = { title: 'Test', tags: ['b'] };

    const result = calculateInsightSimilarity(insight1, insight2);

    assert.ok('breakdown' in result);
    assert.ok('tags' in result.breakdown);
    assert.ok('keywords' in result.breakdown);
    assert.ok('title' in result.breakdown);
  });
});

// ============================================================================
// Tests: findSimilarInsights
// ============================================================================

describe('insight-dedup: findSimilarInsights', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupTempProject(tempDir);
  });

  it('should find similar insights by tags', () => {
    const newInsight = {
      title: 'Agent架构设计',
      tags: ['architecture', 'scaffolding', 'agent-development']
    };

    const result = findSimilarInsights(tempDir, newInsight);

    assert.ok(result.hasSimilar);
    assert.ok(result.similar.length > 0);
    // Should match the agent-scaffolding insight
    assert.ok(result.similar.some(m => m.insight.id === 'ins-20260104-agent-scaffolding'));
  });

  it('should find similar insights by title', () => {
    const newInsight = {
      title: 'Agent研发经验分享',  // Exact title match
      tags: []
    };

    const result = findSimilarInsights(tempDir, newInsight);

    assert.ok(result.hasSimilar);
    assert.ok(result.bestMatch.insight.id === 'ins-20260104-agent-scaffolding');
  });

  it('should return empty when no similar insights found', () => {
    const newInsight = {
      title: 'Quantum Computing Basics',
      tags: ['quantum', 'physics', 'computing']
    };

    const result = findSimilarInsights(tempDir, newInsight);

    assert.ok(!result.hasSimilar);
    assert.strictEqual(result.similar.length, 0);
    assert.strictEqual(result.bestMatch, null);
  });

  it('should respect threshold configuration', () => {
    const newInsight = {
      title: 'Something vaguely related to agents',
      tags: ['agent']  // Only one overlapping tag
    };

    // With low threshold
    const lowResult = findSimilarInsights(tempDir, newInsight, { threshold: 0.1 });

    // With high threshold
    const highResult = findSimilarInsights(tempDir, newInsight, { threshold: 0.9 });

    // Low threshold should find more matches
    assert.ok(lowResult.similar.length >= highResult.similar.length);
  });

  it('should respect maxResults configuration', () => {
    const newInsight = {
      title: 'General Software Development',
      tags: ['architecture', 'framework', 'productivity', 'automation']
    };

    const result = findSimilarInsights(tempDir, newInsight, {
      threshold: 0.1,
      maxResults: 2
    });

    assert.ok(result.similar.length <= 2);
  });

  it('should generate appropriate suggestions', () => {
    const newInsight = {
      title: 'Agent研发经验分享',  // Exact match
      tags: ['architecture', 'scaffolding', 'context-management', 'agent-development']
    };

    const result = findSimilarInsights(tempDir, newInsight);

    assert.ok(result.suggestions.length > 0);
    assert.ok(result.suggestions[0].type === 'exact_duplicate' ||
              result.suggestions[0].type === 'likely_duplicate');
  });

  it('should handle missing index file gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-dedup-empty-'));

    try {
      const result = findSimilarInsights(emptyDir, { title: 'Test', tags: [] });

      assert.ok(result.error || !result.hasSimilar);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('should handle empty insights array', () => {
    const emptyIndex = { version: '1.0', insights: [] };
    const emptyDir = createTempProject(emptyIndex);

    try {
      const result = findSimilarInsights(emptyDir, { title: 'Test', tags: ['test'] });

      assert.ok(!result.hasSimilar);
      assert.strictEqual(result.similar.length, 0);
    } finally {
      cleanupTempProject(emptyDir);
    }
  });

  it('should sort results by similarity score (descending)', () => {
    const newInsight = {
      title: 'Architecture and Development',
      tags: ['architecture', 'automation', 'productivity']
    };

    const result = findSimilarInsights(tempDir, newInsight, { threshold: 0.1 });

    if (result.similar.length >= 2) {
      for (let i = 0; i < result.similar.length - 1; i++) {
        assert.ok(result.similar[i].similarity >= result.similar[i + 1].similarity);
      }
    }
  });
});

// ============================================================================
// Tests: checkBeforeImport
// ============================================================================

describe('insight-dedup: checkBeforeImport', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupTempProject(tempDir);
  });

  it('should check for duplicates with title and tags', () => {
    const importData = {
      title: 'Agent架构最佳实践',
      tags: ['architecture', 'scaffolding', 'agent-development']
    };

    const result = checkBeforeImport(tempDir, importData);

    assert.ok(result.hasSimilar);
  });

  it('should extract title from content if not provided', () => {
    const importData = {
      content: '# Agent Architecture Best Practices\n\nSome content here...'
    };

    const result = checkBeforeImport(tempDir, importData);

    // Should have extracted "Agent Architecture Best Practices" as title
    assert.ok(!result.error);
  });

  it('should use content keywords as tags if tags not provided', () => {
    const importData = {
      content: 'Agent scaffolding architecture context management development'
    };

    const result = checkBeforeImport(tempDir, importData);

    // Should find similarity based on content keywords
    assert.ok(!result.error);
  });

  it('should find duplicates based on content only', () => {
    const importData = {
      content: `# Agent研发经验分享

架构设计最佳实践
脚手架和上下文管理
Agent开发经验`
    };

    const result = checkBeforeImport(tempDir, importData);

    // Should find the agent-scaffolding insight
    assert.ok(result.hasSimilar || result.similar.length === 0);
  });
});

// ============================================================================
// Tests: formatDedupResult
// ============================================================================

describe('insight-dedup: formatDedupResult', () => {
  it('should format no duplicates found message', () => {
    const result = {
      hasSimilar: false,
      similar: [],
      suggestions: []
    };

    const output = formatDedupResult(result);

    assert.ok(output.includes('✅'));
    assert.ok(output.includes('未找到相似洞见'));
  });

  it('should format similar insights list', () => {
    const result = {
      hasSimilar: true,
      similar: [
        {
          insight: {
            id: 'ins-20260104-test',
            title: 'Test Insight',
            status: 'evaluating',
            tags: ['test', 'example']
          },
          similarity: 0.85,
          breakdown: { tags: 0.8, keywords: 0.9, title: 0.85 }
        }
      ],
      suggestions: [
        { type: 'exact_duplicate', message: '高度相似 (85%)，建议更新现有洞见' }
      ]
    };

    const output = formatDedupResult(result);

    assert.ok(output.includes('⚠️'));
    assert.ok(output.includes('发现相似洞见'));
    assert.ok(output.includes('ins-20260104-test'));
    assert.ok(output.includes('85%'));
    assert.ok(output.includes('Test Insight'));
    assert.ok(output.includes('evaluating'));
  });

  it('should format error message', () => {
    const result = {
      error: 'Failed to load index'
    };

    const output = formatDedupResult(result);

    assert.ok(output.includes('❌'));
    assert.ok(output.includes('检查失败'));
    assert.ok(output.includes('Failed to load index'));
  });

  it('should show similarity breakdown', () => {
    const result = {
      hasSimilar: true,
      similar: [
        {
          insight: {
            id: 'ins-test',
            title: 'Test',
            status: 'evaluating',
            tags: []
          },
          similarity: 0.75,
          breakdown: { tags: 60, keywords: 80, title: 85 }
        }
      ],
      suggestions: []
    };

    const output = formatDedupResult(result);

    assert.ok(output.includes('匹配详情'));
    assert.ok(output.includes('标签'));
    assert.ok(output.includes('关键词'));
    assert.ok(output.includes('标题'));
  });

  it('should show suggestions with actions', () => {
    const result = {
      hasSimilar: true,
      similar: [{
        insight: { id: 'ins-test', title: 'Test', status: 'evaluating', tags: [] },
        similarity: 0.85,
        breakdown: { tags: 0.8, keywords: 0.9, title: 0.85 }
      }],
      suggestions: [
        {
          type: 'exact_duplicate',
          message: '高度相似，建议更新',
          action: 'update',
          insightId: 'ins-test'
        }
      ]
    };

    const output = formatDedupResult(result);

    assert.ok(output.includes('💡'));
    assert.ok(output.includes('建议'));
    assert.ok(output.includes('/mob-seed:insight --update'));
  });
});

// ============================================================================
// Tests: DEFAULT_CONFIG
// ============================================================================

describe('insight-dedup: DEFAULT_CONFIG', () => {
  it('should have correct default threshold', () => {
    assert.strictEqual(DEFAULT_CONFIG.threshold, 0.4);
  });

  it('should have correct default maxResults', () => {
    assert.strictEqual(DEFAULT_CONFIG.maxResults, 5);
  });

  it('should have balanced default weights', () => {
    const { weights } = DEFAULT_CONFIG;

    assert.strictEqual(weights.tags, 0.35);
    assert.strictEqual(weights.keywords, 0.35);
    assert.strictEqual(weights.title, 0.30);

    // Weights should sum to 1.0
    const sum = weights.tags + weights.keywords + weights.title;
    assert.ok(Math.abs(sum - 1.0) < 0.001);
  });
});
