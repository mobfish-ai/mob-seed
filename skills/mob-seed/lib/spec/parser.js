/**
 * 规格文件解析器 (Spec Parser)
 *
 * 解析和操作 .fspec.md 规格文件：
 * - 读取/写入规格文件
 * - 解析 frontmatter 元数据
 * - 提取 Requirements 和 AC
 * - 更新规格状态
 *
 * @module skills/mob-seed/lib/spec/parser
 */

const fs = require('fs');
const path = require('path');

// 可选依赖：js-yaml
let yaml = null;
try {
  yaml = require('js-yaml');
} catch {
  // js-yaml 不可用时使用简单解析
}

/**
 * 规格状态
 */
const SpecStatus = {
  DRAFT: 'draft',
  REVIEW: 'review',
  IMPLEMENTING: 'implementing',
  ARCHIVED: 'archived'
};

/**
 * 解析规格文件
 * @param {string} filePath - 规格文件路径
 * @returns {Object} 解析结果
 */
function parseSpecFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `文件不存在: ${filePath}`
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return parseSpecContent(content, filePath);
}

/**
 * 解析规格内容
 * @param {string} content - 规格文件内容
 * @param {string} [filePath] - 文件路径（用于错误报告）
 * @returns {Object} 解析结果
 */
function parseSpecContent(content, filePath = 'unknown') {
  try {
    const metadata = extractMetadata(content);
    const title = extractTitle(content);
    const requirements = extractRequirements(content);
    const acceptanceCriteria = extractAcceptanceCriteria(content);
    const derivedOutputs = extractDerivedOutputs(content);
    const sections = extractSections(content);

    return {
      success: true,
      file: path.basename(filePath),
      path: filePath,
      metadata,
      title,
      requirements,
      acceptanceCriteria,
      derivedOutputs,
      sections,
      raw: content
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      file: filePath
    };
  }
}

/**
 * 提取元数据（> 开头的行）
 * @param {string} content - 规格内容
 * @returns {Object} 元数据对象
 */
function extractMetadata(content) {
  const metadata = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // 匹配 > key: value 格式（支持中文键名）
    const match = line.match(/^>\s*([^:]+):\s*(.+)/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      metadata[key] = parseMetadataValue(key, value);
    }
    // 遇到非元数据行时停止（除了空行）
    if (line.trim() && !line.startsWith('>') && !line.startsWith('#')) {
      break;
    }
  }

  return metadata;
}

/**
 * 解析元数据值
 * @param {string} key - 元数据键
 * @param {string} value - 元数据值
 * @returns {*} 解析后的值
 */
function parseMetadataValue(key, value) {
  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;

  // 数组（逗号分隔）
  if (value.includes(',')) {
    return value.split(',').map(v => v.trim());
  }

  // 版本号保持字符串
  if (key === '版本' || key === 'version') {
    return value;
  }

  return value;
}

/**
 * 提取标题
 * @param {string} content - 规格内容
 * @returns {string|null} 标题
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(?:Feature:\s*)?(.+)/m);
  return match ? match[1].trim() : null;
}

/**
 * 提取需求
 * @param {string} content - 规格内容
 * @returns {Array<Object>} 需求列表
 */
function extractRequirements(content) {
  const requirements = [];
  const lines = content.split('\n');

  let currentReq = null;
  let inRequirement = false;
  let reqContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测需求标题 (### REQ-xxx: 或 ### REQ: name)
    const reqMatch = line.match(/^###\s+(REQ[-_]?\d*:?\s*)?(.+)/);
    if (reqMatch && !line.includes('Acceptance Criteria')) {
      // 保存之前的需求
      if (currentReq) {
        currentReq.content = reqContent.join('\n').trim();
        requirements.push(currentReq);
      }

      // 开始新需求
      const fullTitle = reqMatch[0].replace(/^###\s+/, '');
      const idMatch = fullTitle.match(/^(REQ[-_]?\d+)/);
      currentReq = {
        id: idMatch ? idMatch[1] : `REQ-${requirements.length + 1}`,
        title: reqMatch[2].trim(),
        line: i + 1,
        acceptanceCriteria: []
      };
      inRequirement = true;
      reqContent = [];
      continue;
    }

    // 检测下一个二级或三级标题（结束当前需求）
    if (inRequirement && line.match(/^##[^#]/)) {
      currentReq.content = reqContent.join('\n').trim();
      requirements.push(currentReq);
      currentReq = null;
      inRequirement = false;
      continue;
    }

    // 收集需求内容
    if (inRequirement) {
      reqContent.push(line);

      // 检测 AC
      const acMatch = line.match(/^-\s*\[([ x])\]\s*(AC[-_]?\d*:?\s*)?(.+)/i);
      if (acMatch) {
        currentReq.acceptanceCriteria.push({
          completed: acMatch[1] === 'x',
          id: acMatch[2] ? acMatch[2].replace(/:\s*$/, '') : null,
          description: acMatch[3].trim()
        });
      }
    }
  }

  // 保存最后一个需求
  if (currentReq) {
    currentReq.content = reqContent.join('\n').trim();
    requirements.push(currentReq);
  }

  return requirements;
}

/**
 * 提取所有 Acceptance Criteria
 * @param {string} content - 规格内容
 * @returns {Array<Object>} AC 列表
 */
function extractAcceptanceCriteria(content) {
  const criteria = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 匹配 - [ ] AC-xxx: description 或 - [x] AC: description
    const match = line.match(/^-\s*\[([ x])\]\s*(AC[-_]?\d*:?\s*)?(.+)/i);
    if (match) {
      criteria.push({
        completed: match[1] === 'x',
        id: match[2] ? match[2].replace(/:\s*$/, '').trim() : null,
        description: match[3].trim(),
        line: i + 1
      });
    }
  }

  return criteria;
}

/**
 * 提取派生产物
 * @param {string} content - 规格内容
 * @returns {Array<Object>} 派生产物列表
 */
function extractDerivedOutputs(content) {
  const outputs = [];

  // 查找派生产物表格
  const tableMatch = content.match(/\|\s*类型\s*\|\s*路径\s*\|\s*说明\s*\|[\s\S]*?(?=\n\n|\n##|$)/);
  if (!tableMatch) return outputs;

  const tableLines = tableMatch[0].split('\n').filter(line =>
    line.includes('|') && !line.includes('---') && !line.includes('类型')
  );

  for (const line of tableLines) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 2) {
      outputs.push({
        type: cells[0],
        path: cells[1],
        description: cells[2] || ''
      });
    }
  }

  return outputs;
}

/**
 * 提取所有章节
 * @param {string} content - 规格内容
 * @returns {Object} 章节映射
 */
function extractSections(content) {
  const sections = {};
  const lines = content.split('\n');

  let currentSection = null;
  let sectionContent = [];

  for (const line of lines) {
    // 二级标题
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      if (currentSection) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = h2Match[1].trim();
      sectionContent = [];
      continue;
    }

    if (currentSection) {
      sectionContent.push(line);
    }
  }

  // 保存最后一个章节
  if (currentSection) {
    sections[currentSection] = sectionContent.join('\n').trim();
  }

  return sections;
}

/**
 * 更新规格元数据
 * @param {string} content - 规格内容
 * @param {Object} updates - 要更新的元数据
 * @returns {string} 更新后的内容
 */
function updateMetadata(content, updates) {
  let updatedContent = content;

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^>\\s*${key}:\\s*.+$`, 'm');
    const newLine = `> ${key}: ${value}`;

    if (regex.test(updatedContent)) {
      // 替换现有行
      updatedContent = updatedContent.replace(regex, newLine);
    } else {
      // 在其他元数据后添加
      const insertPoint = updatedContent.search(/^>\s*\w+:/m);
      if (insertPoint !== -1) {
        const nextLineEnd = updatedContent.indexOf('\n', insertPoint);
        updatedContent = updatedContent.slice(0, nextLineEnd + 1) +
                        newLine + '\n' +
                        updatedContent.slice(nextLineEnd + 1);
      }
    }
  }

  return updatedContent;
}

/**
 * 更新 AC 状态
 * @param {string} content - 规格内容
 * @param {string} acId - AC ID 或描述
 * @param {boolean} completed - 完成状态
 * @returns {string} 更新后的内容
 */
function updateACStatus(content, acId, completed) {
  const checkMark = completed ? 'x' : ' ';
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 精确匹配 AC ID
    if (acId.startsWith('AC')) {
      const regex = new RegExp(`^(-\\s*\\[)[ x](\\]\\s*${acId})`);
      if (regex.test(line)) {
        lines[i] = line.replace(regex, `$1${checkMark}$2`);
        break;
      }
    } else {
      // 按描述匹配
      if (line.includes(acId) && line.match(/^-\s*\[[ x]\]/)) {
        lines[i] = line.replace(/^(-\s*\[)[ x](\])/, `$1${checkMark}$2`);
        break;
      }
    }
  }

  return lines.join('\n');
}

/**
 * 批量更新 AC 状态
 * @param {string} content - 规格内容
 * @param {Array<Object>} updates - 更新列表 [{id, completed}]
 * @returns {string} 更新后的内容
 */
function updateACStatuses(content, updates) {
  let result = content;
  for (const update of updates) {
    result = updateACStatus(result, update.id || update.description, update.completed);
  }
  return result;
}

/**
 * 添加需求
 * @param {string} content - 规格内容
 * @param {Object} requirement - 需求对象
 * @returns {string} 更新后的内容
 */
function addRequirement(content, requirement) {
  const { id, title, description, acceptanceCriteria = [] } = requirement;

  let reqContent = `\n### ${id}: ${title}\n\n`;
  reqContent += `${description}\n\n`;

  if (acceptanceCriteria.length > 0) {
    reqContent += `**Acceptance Criteria**:\n`;
    for (const ac of acceptanceCriteria) {
      const check = ac.completed ? 'x' : ' ';
      const acId = ac.id ? `${ac.id}: ` : '';
      reqContent += `- [${check}] ${acId}${ac.description}\n`;
    }
    reqContent += '\n';
  }

  // 查找 Requirements 章节并添加
  const reqSectionMatch = content.match(/(##\s+.*Requirements[\s\S]*?)(?=\n##[^#]|$)/);
  if (reqSectionMatch) {
    const insertIndex = reqSectionMatch.index + reqSectionMatch[0].length;
    return content.slice(0, insertIndex) + reqContent + content.slice(insertIndex);
  }

  // 没有 Requirements 章节，在概述后添加
  const overviewMatch = content.match(/(##\s+概述[\s\S]*?\n\n)/);
  if (overviewMatch) {
    const insertIndex = overviewMatch.index + overviewMatch[0].length;
    return content.slice(0, insertIndex) +
           `## Requirements\n${reqContent}` +
           content.slice(insertIndex);
  }

  // 添加到末尾
  return content + `\n## Requirements\n${reqContent}`;
}

/**
 * 写入规格文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 规格内容
 * @param {Object} options - 写入选项
 * @returns {Object} 写入结果
 */
function writeSpecFile(filePath, content, options = {}) {
  const { backup = true, createDir = true } = options;

  try {
    // 创建目录
    if (createDir) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // 备份现有文件
    if (backup && fs.existsSync(filePath)) {
      const backupPath = `${filePath}.bak`;
      fs.copyFileSync(filePath, backupPath);
    }

    // 写入文件
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      success: true,
      path: filePath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 验证规格文件结构
 * @param {Object} parsed - 解析后的规格对象
 * @returns {Object} 验证结果
 */
function validateSpec(parsed) {
  const issues = [];
  const warnings = [];

  // 必需字段
  if (!parsed.title) {
    issues.push('缺少标题 (# Feature: xxx)');
  }

  if (!parsed.metadata.状态 && !parsed.metadata.status) {
    issues.push('缺少状态元数据');
  }

  // 建议字段
  if (!parsed.metadata.版本 && !parsed.metadata.version) {
    warnings.push('建议添加版本号');
  }

  if (parsed.requirements.length === 0) {
    warnings.push('没有检测到需求定义');
  }

  if (parsed.acceptanceCriteria.length === 0) {
    warnings.push('没有检测到 Acceptance Criteria');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    stats: {
      requirements: parsed.requirements.length,
      acceptanceCriteria: parsed.acceptanceCriteria.length,
      completedAC: parsed.acceptanceCriteria.filter(ac => ac.completed).length,
      derivedOutputs: parsed.derivedOutputs.length
    }
  };
}

/**
 * 获取规格完成度
 * @param {Object} parsed - 解析后的规格对象
 * @returns {Object} 完成度信息
 */
function getCompletionRate(parsed) {
  const total = parsed.acceptanceCriteria.length;
  const completed = parsed.acceptanceCriteria.filter(ac => ac.completed).length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

module.exports = {
  // 状态常量
  SpecStatus,

  // 解析函数
  parseSpecFile,
  parseSpecContent,
  extractMetadata,
  extractTitle,
  extractRequirements,
  extractAcceptanceCriteria,
  extractDerivedOutputs,
  extractSections,

  // 更新函数
  updateMetadata,
  updateACStatus,
  updateACStatuses,
  addRequirement,

  // 文件操作
  writeSpecFile,

  // 验证函数
  validateSpec,
  getCompletionRate
};
