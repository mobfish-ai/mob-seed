#!/usr/bin/env node

/**
 * 验证 insights/index.json 是否与实际文件同步
 *
 * 用法:
 *   node skills/mob-seed/scripts/verify-insights.js [--fix] [--verbose]
 *
 * 选项:
 *   --fix     自动修复索引（重新扫描所有文件）
 *   --verbose 显示详细输出
 *
 * 退出码:
 *   0 - 索引正常
 *   1 - 索引有问题
 *   2 - 需要修复（但未指定 --fix）
 */

const fs = require('fs');
const path = require('path');

// 脚本在 skills/mob-seed/scripts/，需要向上三级到项目根目录
const PROJECT_DIR = path.resolve(__dirname, '../../..');
const SEED_DIR = path.join(PROJECT_DIR, '.seed');

// 获取 insights 目录（处理软链接）
function getInsightsDir() {
  const localPath = path.join(SEED_DIR, 'insights');

  // 检查是否是软链接
  try {
    const stats = fs.lstatSync(localPath);
    if (stats.isSymbolicLink()) {
      const target = fs.readlinkSync(localPath);
      const resolved = path.resolve(path.dirname(localPath), target);
      if (process.argv.includes('--verbose')) {
        console.log(`🔗 检测到软链接: ${localPath} -> ${resolved}`);
      }
      return resolved;
    }
  } catch (err) {
    // 目录不存在或其他错误
  }

  return localPath;
}

// 读取索引文件
function readIndex(indexPath) {
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null; // 索引文件不存在
    }
    throw err;
  }
}

// 扫描所有洞见文件
function scanInsightFiles(insightsDir) {
  const files = fs.readdirSync(insightsDir)
    .filter(f => f.startsWith('ins-') && f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse(); // 最新的在前

  return files.map(filename => {
    const filepath = path.join(insightsDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');

    // 提取 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return { id: filename.slice(0, -3), error: 'No frontmatter' };
    }

    const frontmatter = {};
    frontmatterMatch[1].split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        let value = match[2].trim();
        // 处理数组
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
        }
        // 处理字符串
        else {
          value = value.replace(/^['"]|['"]$/g, '');
        }
        frontmatter[match[1]] = value;
      }
    });

    // 从 source 块提取信息（如果有）
    if (frontmatter.source && typeof frontmatter.source === 'object') {
      // source 已经是解析后的对象
    } else if (frontmatter.source) {
      // source 是字符串（YAML 格式），需要解析
      // 这里简化处理，假设使用标准的 YAML 格式
    }

    return {
      id: filename.slice(0, -3),
      filename,
      source: {
        title: frontmatter.source_title || frontmatter.title || '(无标题)',
        type: frontmatter.source_type || frontmatter.type || 'unknown',
        author: frontmatter.source_author || frontmatter.author || '(未知)',
        credibility: frontmatter.source_credibility || frontmatter.credibility || 'medium'
      },
      status: frontmatter.status || 'evaluating',
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      tags: frontmatter.tags || [],
      model_era: frontmatter.model_era || 'unknown'
    };
  });
}

// 生成新的索引
function generateIndex(insights) {
  const stats = {
    total: insights.length,
    by_status: {},
    by_type: {},
    by_credibility: {}
  };

  insights.forEach(insight => {
    // 按状态统计
    stats.by_status[insight.status] = (stats.by_status[insight.status] || 0) + 1;

    // 按类型统计
    stats.by_type[insight.source.type] = (stats.by_type[insight.source.type] || 0) + 1;

    // 按可信度统计
    stats.by_credibility[insight.source.credibility] = (stats.by_credibility[insight.source.credibility] || 0) + 1;
  });

  return {
    version: '1.0',
    updated: new Date().toISOString(),
    insights,
    stats
  };
}

// 主函数
function main() {
  const insightsDir = getInsightsDir();
  const indexPath = path.join(insightsDir, 'index.json');
  const shouldFix = process.argv.includes('--fix');
  const verbose = process.argv.includes('--verbose');

  if (verbose) {
    console.log(`📁 Insights 目录: ${insightsDir}`);
    console.log(`📄 索引文件: ${indexPath}`);
    console.log();
  }

  // 扫描实际文件
  const scannedInsights = scanInsightFiles(insightsDir);

  // 读取现有索引
  const existingIndex = readIndex(indexPath);

  // 比较差异
  const scannedIds = new Set(scannedInsights.map(i => i.id));
  const indexedIds = existingIndex ? new Set(existingIndex.insights.map(i => i.id)) : new Set();

  const missingInIndex = [...scannedIds].filter(id => !indexedIds.has(id));
  const extraInIndex = existingIndex ? [...indexedIds].filter(id => !scannedIds.has(id)) : [];

  // 检查数量
  if (missingInIndex.length === 0 && extraInIndex.length === 0) {
    console.log('✅ 索引与实际文件同步');
    console.log(`   总计: ${scannedInsights.length} 条洞见`);
    return 0;
  }

  // 有问题
  console.log('❌ 索引与实际文件不同步');

  if (missingInIndex.length > 0) {
    console.log(`   缺少 ${missingInIndex.length} 个洞见的索引:`);
    missingInIndex.forEach(id => console.log(`     - ${id}`));
  }

  if (extraInIndex.length > 0) {
    console.log(`   索引中多了 ${extraInIndex.length} 个不存在的洞见:`);
    extraInIndex.forEach(id => console.log(`     - ${id}`));
  }

  // 修复
  if (shouldFix) {
    console.log();
    console.log('🔧 正在修复索引...');

    const newIndex = generateIndex(scannedInsights);
    fs.writeFileSync(indexPath, JSON.stringify(newIndex, null, 2));

    console.log(`✅ 索引已更新`);
    console.log(`   总计: ${newIndex.stats.total} 条洞见`);
    console.log(`   按状态: ${JSON.stringify(newIndex.stats.by_status)}`);
    console.log(`   按类型: ${JSON.stringify(newIndex.stats.by_type)}`);

    return 0;
  } else {
    console.log();
    console.log('💡 运行以下命令修复:');
    console.log(`   node skills/mob-seed/scripts/verify-insights.js --fix`);
    return 2;
  }
}

// 运行
try {
  process.exit(main());
} catch (err) {
  console.error('❌ 错误:', err.message);
  if (process.argv.includes('--verbose')) {
    console.error(err.stack);
  }
  process.exit(1);
}
