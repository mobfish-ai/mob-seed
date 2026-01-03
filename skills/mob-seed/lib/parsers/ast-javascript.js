/**
 * JavaScript AST 解析器
 *
 * 使用 @babel/parser 解析 JavaScript/TypeScript 代码，
 * 提取函数签名、JSDoc、导入、测试用例等信息。
 *
 * 当 @babel 不可用时，降级到正则表达式解析。
 *
 * @module skills/mob-seed/lib/parsers/ast-javascript
 */

const fs = require('fs');
const path = require('path');

// 可选依赖：@babel/parser 和 @babel/traverse
let babelParser = null;
let babelTraverse = null;

try {
  babelParser = require('@babel/parser');
  babelTraverse = require('@babel/traverse').default || require('@babel/traverse');
} catch {
  // @babel 不可用时，使用正则降级
}

/**
 * 解析模式
 */
const ParseMode = {
  AST: 'ast',
  REGEX: 'regex'
};

/**
 * 获取当前解析模式
 * @returns {string} 'ast' 或 'regex'
 */
function getParseMode() {
  return babelParser ? ParseMode.AST : ParseMode.REGEX;
}

/**
 * 解析 JavaScript 文件为 AST
 * @param {string} code - 源代码
 * @param {Object} options - 解析选项
 * @returns {Object|null} AST 或 null（降级模式）
 */
function parseToAST(code, options = {}) {
  if (!babelParser) return null;

  const defaultOptions = {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'dynamicImport',
      'nullishCoalescingOperator',
      'optionalChaining',
      'objectRestSpread'
    ],
    ...options
  };

  try {
    return babelParser.parse(code, defaultOptions);
  } catch (error) {
    // 解析失败，返回 null 触发降级
    return null;
  }
}

/**
 * 使用 AST 提取方法信息
 * @param {string} code - 源代码
 * @returns {Array<Object>} 方法列表
 */
function extractMethodsAST(code) {
  const ast = parseToAST(code);
  if (!ast || !babelTraverse) {
    return extractMethodsRegex(code);
  }

  const methods = [];

  babelTraverse(ast, {
    // 函数声明
    FunctionDeclaration(nodePath) {
      const node = nodePath.node;
      if (node.id) {
        methods.push({
          name: node.id.name,
          type: 'function',
          async: node.async,
          generator: node.generator,
          params: extractParams(node.params),
          loc: node.loc,
          leadingComments: extractLeadingComments(node),
          exported: isExported(nodePath)
        });
      }
    },

    // 箭头函数（变量声明）
    VariableDeclarator(nodePath) {
      const node = nodePath.node;
      if (node.init &&
          (node.init.type === 'ArrowFunctionExpression' ||
           node.init.type === 'FunctionExpression')) {
        methods.push({
          name: node.id.name,
          type: node.init.type === 'ArrowFunctionExpression' ? 'arrow' : 'function',
          async: node.init.async,
          generator: node.init.generator || false,
          params: extractParams(node.init.params),
          loc: node.loc,
          leadingComments: extractLeadingComments(nodePath.parent),
          exported: isExported(nodePath.parentPath)
        });
      }
    },

    // 类方法
    ClassMethod(nodePath) {
      const node = nodePath.node;
      const className = nodePath.parentPath.parent.id?.name || 'Anonymous';
      methods.push({
        name: `${className}.${node.key.name || node.key.value}`,
        type: 'method',
        async: node.async,
        generator: node.generator,
        static: node.static,
        kind: node.kind, // 'constructor', 'method', 'get', 'set'
        params: extractParams(node.params),
        loc: node.loc,
        leadingComments: extractLeadingComments(node),
        exported: isExported(nodePath.parentPath.parentPath)
      });
    },

    // 对象方法（module.exports = { fn() {} }）
    ObjectMethod(nodePath) {
      const node = nodePath.node;
      methods.push({
        name: node.key.name || node.key.value,
        type: 'method',
        async: node.async,
        generator: node.generator,
        params: extractParams(node.params),
        loc: node.loc,
        leadingComments: extractLeadingComments(node),
        exported: true // 对象方法通常是导出的
      });
    }
  });

  return methods;
}

/**
 * 使用正则提取方法信息（降级模式）
 * @param {string} code - 源代码
 * @returns {Array<Object>} 方法列表
 */
function extractMethodsRegex(code) {
  const methods = [];
  const lines = code.split('\n');

  // 函数声明: function name(...)
  const funcDeclRegex = /^(async\s+)?function\s*(\*?)\s*(\w+)\s*\(([^)]*)\)/;

  // 箭头函数: const name = (...) =>
  const arrowRegex = /^(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(?([^)=]*)\)?\s*=>/;

  // 类方法: methodName(...) { 或 async methodName(...)
  const methodRegex = /^\s*(static\s+)?(async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/;

  // module.exports 函数
  const exportsRegex = /^module\.exports\s*=\s*\{/;

  let inExports = false;
  let currentJSDoc = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 收集 JSDoc
    if (trimmed.startsWith('/**')) {
      currentJSDoc = collectJSDocBlock(lines, i);
    }

    // 检测 module.exports
    if (exportsRegex.test(trimmed)) {
      inExports = true;
    }
    if (inExports && trimmed === '};') {
      inExports = false;
    }

    // 函数声明
    const funcMatch = trimmed.match(funcDeclRegex);
    if (funcMatch) {
      methods.push({
        name: funcMatch[3],
        type: 'function',
        async: !!funcMatch[1],
        generator: funcMatch[2] === '*',
        params: parseParamsString(funcMatch[4]),
        loc: { start: { line: i + 1 } },
        leadingComments: currentJSDoc ? [{ value: currentJSDoc }] : [],
        exported: checkExported(lines, i, funcMatch[3])
      });
      currentJSDoc = null;
    }

    // 箭头函数
    const arrowMatch = trimmed.match(arrowRegex);
    if (arrowMatch) {
      methods.push({
        name: arrowMatch[1],
        type: 'arrow',
        async: !!arrowMatch[2],
        generator: false,
        params: parseParamsString(arrowMatch[3]),
        loc: { start: { line: i + 1 } },
        leadingComments: currentJSDoc ? [{ value: currentJSDoc }] : [],
        exported: checkExported(lines, i, arrowMatch[1])
      });
      currentJSDoc = null;
    }

    // 类方法（简化检测）
    if (!funcMatch && !arrowMatch && methodRegex.test(trimmed)) {
      const methodMatch = trimmed.match(methodRegex);
      if (methodMatch && methodMatch[3] !== 'if' && methodMatch[3] !== 'for' &&
          methodMatch[3] !== 'while' && methodMatch[3] !== 'switch') {
        methods.push({
          name: methodMatch[3],
          type: 'method',
          async: !!methodMatch[2],
          static: !!methodMatch[1],
          params: parseParamsString(methodMatch[4]),
          loc: { start: { line: i + 1 } },
          leadingComments: currentJSDoc ? [{ value: currentJSDoc }] : [],
          exported: inExports
        });
        currentJSDoc = null;
      }
    }
  }

  return methods;
}

/**
 * 使用 AST 提取 JSDoc 注释
 * @param {string} code - 源代码
 * @returns {Array<Object>} JSDoc 列表
 */
function extractJSDoc(code) {
  const ast = parseToAST(code);
  if (!ast) {
    return extractJSDocRegex(code);
  }

  const jsdocs = [];

  // 从 AST 注释中提取
  if (ast.comments) {
    for (const comment of ast.comments) {
      if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
        const parsed = parseJSDocComment(comment.value);
        if (parsed) {
          jsdocs.push({
            ...parsed,
            loc: comment.loc
          });
        }
      }
    }
  }

  return jsdocs;
}

/**
 * 使用正则提取 JSDoc（降级模式）
 * @param {string} code - 源代码
 * @returns {Array<Object>} JSDoc 列表
 */
function extractJSDocRegex(code) {
  const jsdocs = [];
  const jsdocRegex = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
  let match;

  while ((match = jsdocRegex.exec(code)) !== null) {
    const parsed = parseJSDocComment(match[1]);
    if (parsed) {
      // 计算行号
      const beforeMatch = code.substring(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
      jsdocs.push({
        ...parsed,
        loc: { start: { line: lineNumber } }
      });
    }
  }

  return jsdocs;
}

/**
 * 解析 JSDoc 注释内容
 * @param {string} content - JSDoc 内容（不含开闭标记）
 * @returns {Object|null} 解析结果
 */
function parseJSDocComment(content) {
  const lines = content.split('\n').map(line =>
    line.replace(/^\s*\*\s?/, '').trim()
  );

  const result = {
    description: '',
    params: [],
    returns: null,
    throws: [],
    examples: [],
    tags: {}
  };

  let currentTag = null;
  let descriptionLines = [];

  for (const line of lines) {
    if (line.startsWith('@')) {
      // 新标签
      const tagMatch = line.match(/^@(\w+)\s*(.*)/);
      if (tagMatch) {
        const [, tagName, tagContent] = tagMatch;

        switch (tagName) {
          case 'param':
            const paramMatch = tagContent.match(/^\{([^}]+)\}\s*(\[)?(\w+)\]?\s*-?\s*(.*)/);
            if (paramMatch) {
              result.params.push({
                type: paramMatch[1],
                optional: !!paramMatch[2],
                name: paramMatch[3],
                description: paramMatch[4]
              });
            }
            break;
          case 'returns':
          case 'return':
            const returnMatch = tagContent.match(/^\{([^}]+)\}\s*(.*)/);
            if (returnMatch) {
              result.returns = {
                type: returnMatch[1],
                description: returnMatch[2]
              };
            }
            break;
          case 'throws':
          case 'throw':
            result.throws.push(tagContent);
            break;
          case 'example':
            currentTag = 'example';
            result.examples.push('');
            break;
          default:
            result.tags[tagName] = tagContent;
        }
      }
    } else if (currentTag === 'example') {
      result.examples[result.examples.length - 1] += line + '\n';
    } else if (!currentTag) {
      descriptionLines.push(line);
    }
  }

  result.description = descriptionLines.join(' ').trim();
  result.examples = result.examples.map(e => e.trim());

  return result.description || result.params.length > 0 ? result : null;
}

/**
 * 提取导入语句
 * @param {string} code - 源代码
 * @returns {Array<Object>} 导入列表
 */
function extractImports(code) {
  const ast = parseToAST(code);
  if (!ast || !babelTraverse) {
    return extractImportsRegex(code);
  }

  const imports = [];

  babelTraverse(ast, {
    // ES6 import
    ImportDeclaration(nodePath) {
      const node = nodePath.node;
      const specifiers = node.specifiers.map(spec => ({
        type: spec.type,
        imported: spec.imported?.name || spec.local.name,
        local: spec.local.name
      }));
      imports.push({
        type: 'import',
        source: node.source.value,
        specifiers
      });
    },

    // CommonJS require
    CallExpression(nodePath) {
      const node = nodePath.node;
      if (node.callee.name === 'require' && node.arguments[0]?.type === 'StringLiteral') {
        const parent = nodePath.parent;
        let name = null;

        if (parent.type === 'VariableDeclarator') {
          name = parent.id.name || (parent.id.type === 'ObjectPattern' ?
            parent.id.properties.map(p => p.key.name).join(', ') : null);
        }

        imports.push({
          type: 'require',
          source: node.arguments[0].value,
          name
        });
      }
    }
  });

  return imports;
}

/**
 * 使用正则提取导入（降级模式）
 * @param {string} code - 源代码
 * @returns {Array<Object>} 导入列表
 */
function extractImportsRegex(code) {
  const imports = [];

  // ES6 import
  const importRegex = /import\s+(?:(\w+)|(?:\{([^}]+)\})|(\*\s+as\s+\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push({
      type: 'import',
      source: match[4],
      specifiers: match[1] ? [{ type: 'default', local: match[1] }] :
        match[2] ? match[2].split(',').map(s => ({ type: 'named', local: s.trim() })) : []
    });
  }

  // CommonJS require
  const requireRegex = /(?:const|let|var)\s+(?:(\w+)|\{([^}]+)\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    imports.push({
      type: 'require',
      source: match[3],
      name: match[1] || match[2]
    });
  }

  return imports;
}

/**
 * 提取测试用例
 * @param {string} code - 测试文件代码
 * @returns {Array<Object>} 测试用例列表
 */
function extractTestCases(code) {
  const tests = [];

  // node:test 风格: test('name', ...)
  const nodeTestRegex = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = nodeTestRegex.exec(code)) !== null) {
    tests.push({
      framework: 'node:test',
      name: match[1],
      index: match.index
    });
  }

  // describe 块
  const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = describeRegex.exec(code)) !== null) {
    tests.push({
      framework: 'node:test',
      type: 'suite',
      name: match[1],
      index: match.index
    });
  }

  return tests;
}

/**
 * 提取导出
 * @param {string} code - 源代码
 * @returns {Object} 导出信息
 */
function extractExports(code) {
  const ast = parseToAST(code);
  if (!ast || !babelTraverse) {
    return extractExportsRegex(code);
  }

  const exports = {
    named: [],
    default: null,
    commonjs: null
  };

  babelTraverse(ast, {
    // ES6 named export
    ExportNamedDeclaration(nodePath) {
      const node = nodePath.node;
      if (node.declaration) {
        if (node.declaration.declarations) {
          for (const decl of node.declaration.declarations) {
            exports.named.push(decl.id.name);
          }
        } else if (node.declaration.id) {
          exports.named.push(node.declaration.id.name);
        }
      }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          exports.named.push(spec.exported.name);
        }
      }
    },

    // ES6 default export
    ExportDefaultDeclaration(nodePath) {
      const node = nodePath.node;
      exports.default = node.declaration.name ||
        (node.declaration.id?.name) || 'default';
    },

    // CommonJS module.exports
    AssignmentExpression(nodePath) {
      const node = nodePath.node;
      if (node.left.type === 'MemberExpression' &&
          node.left.object.name === 'module' &&
          node.left.property.name === 'exports') {
        if (node.right.type === 'ObjectExpression') {
          exports.commonjs = node.right.properties.map(p =>
            p.key.name || p.key.value
          );
        } else if (node.right.type === 'Identifier') {
          exports.commonjs = [node.right.name];
        }
      }
    }
  });

  return exports;
}

/**
 * 使用正则提取导出（降级模式）
 * @param {string} code - 源代码
 * @returns {Object} 导出信息
 */
function extractExportsRegex(code) {
  const exports = {
    named: [],
    default: null,
    commonjs: null
  };

  // ES6 exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(code)) !== null) {
    exports.named.push(match[1]);
  }

  // Default export
  const defaultMatch = code.match(/export\s+default\s+(?:function\s+)?(\w+)?/);
  if (defaultMatch) {
    exports.default = defaultMatch[1] || 'default';
  }

  // CommonJS
  const cjsMatch = code.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (cjsMatch) {
    exports.commonjs = cjsMatch[1].split(',').map(s => {
      const name = s.trim().split(':')[0].trim();
      return name;
    }).filter(Boolean);
  }

  return exports;
}

// ============ 辅助函数 ============

/**
 * 提取参数列表
 */
function extractParams(params) {
  return params.map(param => {
    if (param.type === 'Identifier') {
      return { name: param.name, optional: false };
    }
    if (param.type === 'AssignmentPattern') {
      return { name: param.left.name, optional: true, default: true };
    }
    if (param.type === 'RestElement') {
      return { name: `...${param.argument.name}`, rest: true };
    }
    if (param.type === 'ObjectPattern') {
      return { name: '{...}', destructured: true };
    }
    if (param.type === 'ArrayPattern') {
      return { name: '[...]', destructured: true };
    }
    return { name: 'unknown' };
  });
}

/**
 * 提取前置注释
 */
function extractLeadingComments(node) {
  if (!node.leadingComments) return [];
  return node.leadingComments.filter(c =>
    c.type === 'CommentBlock' && c.value.startsWith('*')
  );
}

/**
 * 检查是否导出
 */
function isExported(nodePath) {
  if (!nodePath || !nodePath.parent) return false;
  const parentType = nodePath.parent.type;
  return parentType === 'ExportNamedDeclaration' ||
         parentType === 'ExportDefaultDeclaration';
}

/**
 * 解析参数字符串
 */
function parseParamsString(paramsStr) {
  if (!paramsStr || !paramsStr.trim()) return [];
  return paramsStr.split(',').map(p => {
    const trimmed = p.trim();
    const hasDefault = trimmed.includes('=');
    const isRest = trimmed.startsWith('...');
    const name = trimmed.split('=')[0].replace('...', '').trim();
    return { name, optional: hasDefault, rest: isRest };
  });
}

/**
 * 收集 JSDoc 块
 */
function collectJSDocBlock(lines, startLine) {
  let content = '';
  for (let i = startLine; i < lines.length; i++) {
    content += lines[i] + '\n';
    if (lines[i].includes('*/')) break;
  }
  return content;
}

/**
 * 检查函数是否被导出（正则模式）
 */
function checkExported(lines, lineIndex, funcName) {
  // 检查 module.exports
  const code = lines.join('\n');
  if (code.includes(`module.exports`) && code.includes(funcName)) {
    return true;
  }
  // 检查 export
  const line = lines[lineIndex];
  if (line.includes('export ')) return true;

  return false;
}

// ============ 高级 API ============

/**
 * 分析 JavaScript 文件
 * @param {string} filePath - 文件路径
 * @returns {Object} 完整分析结果
 */
function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.');

  const result = {
    file: path.basename(filePath),
    path: filePath,
    parseMode: getParseMode(),
    methods: extractMethodsAST(code),
    jsdocs: extractJSDoc(code),
    imports: extractImports(code),
    exports: extractExports(code)
  };

  if (isTestFile) {
    result.tests = extractTestCases(code);
  }

  return result;
}

/**
 * 批量分析文件
 * @param {Array<string>} filePaths - 文件路径列表
 * @returns {Array<Object>} 分析结果列表
 */
function analyzeFiles(filePaths) {
  return filePaths.map(filePath => {
    try {
      return analyzeFile(filePath);
    } catch (error) {
      return {
        file: path.basename(filePath),
        path: filePath,
        error: error.message
      };
    }
  });
}

module.exports = {
  // 解析模式
  ParseMode,
  getParseMode,
  parseToAST,

  // 核心提取
  extractMethodsAST,
  extractMethodsRegex,
  extractJSDoc,
  extractJSDocRegex,
  extractImports,
  extractImportsRegex,
  extractTestCases,
  extractExports,
  extractExportsRegex,

  // 高级 API
  analyzeFile,
  analyzeFiles,

  // 辅助函数
  parseJSDocComment
};
