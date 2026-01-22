'use strict';

/**
 * Insight Extractor - Content extraction from URLs and text
 *
 * Extracts structured metadata from web content or raw text
 * for creating insight records.
 *
 * @module ace/insight-extractor
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Domain to source type mapping
 */
const DomainSourceTypeMap = {
  // Academic / Research
  'arxiv.org': 'paper',
  'scholar.google.com': 'paper',
  'pubmed.ncbi.nlm.nih.gov': 'paper',
  'researchgate.net': 'paper',
  'ieee.org': 'paper',
  'acm.org': 'paper',
  'nature.com': 'paper',
  'science.org': 'paper',

  // Documentation
  'docs.github.com': 'documentation',
  'developer.mozilla.org': 'documentation',
  'nodejs.org': 'documentation',
  'react.dev': 'documentation',
  'vuejs.org': 'documentation',
  'angular.io': 'documentation',

  // Blogs / Technical
  'medium.com': 'blog',
  'dev.to': 'blog',
  'hashnode.dev': 'blog',
  'substack.com': 'blog',
  'blog.': 'blog',

  // Social / Discussion
  'twitter.com': 'discussion',
  'x.com': 'discussion',
  'reddit.com': 'discussion',
  'news.ycombinator.com': 'discussion',
  'stackoverflow.com': 'discussion',
  'github.com/issues': 'discussion',
  'github.com/discussions': 'discussion',

  // Expert opinions (personal sites, talks)
  'speakerdeck.com': 'expert_opinion',
  'slideshare.net': 'expert_opinion',
  'youtube.com': 'expert_opinion'
};

/**
 * Domain to credibility mapping
 */
const DomainCredibilityMap = {
  // High credibility
  'arxiv.org': 'high',
  'nature.com': 'high',
  'science.org': 'high',
  'ieee.org': 'high',
  'acm.org': 'high',
  'docs.github.com': 'high',
  'developer.mozilla.org': 'high',
  'nodejs.org': 'high',
  'react.dev': 'high',

  // Medium credibility
  'medium.com': 'medium',
  'dev.to': 'medium',
  'stackoverflow.com': 'medium',
  'github.com': 'medium',

  // Low credibility (needs verification)
  'twitter.com': 'low',
  'x.com': 'low',
  'reddit.com': 'low'
};

/**
 * Fetch content from URL
 * @param {string} url - URL to fetch
 * @param {Object} [options] - Fetch options
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @param {number} [options.maxRedirects] - Max redirects to follow
 * @returns {Promise<{content: string, contentType: string, finalUrl: string}>}
 */
function fetchUrl(url, options = {}) {
  const { timeout = 30000, maxRedirects = 5 } = options;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InsightExtractor/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout
    };

    const req = protocol.request(requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchUrl(redirectUrl, { timeout, maxRedirects: maxRedirects - 1 })
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        resolve({
          content,
          contentType: res.headers['content-type'] || 'text/html',
          finalUrl: url
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Extract title from HTML content
 * @param {string} html - HTML content
 * @returns {string|null} Extracted title
 */
function extractTitle(html) {
  // Try og:title first
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitle) return decodeHtmlEntities(ogTitle[1]);

  // Try twitter:title
  const twitterTitle = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
  if (twitterTitle) return decodeHtmlEntities(twitterTitle[1]);

  // Try <title> tag
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTag) return decodeHtmlEntities(titleTag[1].trim());

  // Try h1 tag
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return decodeHtmlEntities(h1[1].trim());

  return null;
}

/**
 * Extract author from HTML content
 * @param {string} html - HTML content
 * @returns {string|null} Extracted author
 */
function extractAuthor(html) {
  // Try meta author
  const metaAuthor = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
  if (metaAuthor) return decodeHtmlEntities(metaAuthor[1]);

  // Try article:author
  const ogAuthor = html.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);
  if (ogAuthor) return decodeHtmlEntities(ogAuthor[1]);

  // Try twitter:creator
  const twitterCreator = html.match(/<meta[^>]*name=["']twitter:creator["'][^>]*content=["']([^"']+)["']/i);
  if (twitterCreator) return decodeHtmlEntities(twitterCreator[1]);

  // Try schema.org author
  const schemaAuthor = html.match(/"author"\s*:\s*{\s*"name"\s*:\s*"([^"]+)"/i);
  if (schemaAuthor) return schemaAuthor[1];

  // Try common author class patterns
  const authorClass = html.match(/class=["'][^"']*author[^"']*["'][^>]*>([^<]+)</i);
  if (authorClass) return decodeHtmlEntities(authorClass[1].trim());

  return null;
}

/**
 * Extract publication date from HTML content
 * @param {string} html - HTML content
 * @returns {string|null} Extracted date in YYYY-MM-DD format
 */
function extractDate(html) {
  // Try article:published_time
  const ogDate = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
  if (ogDate) return parseDate(ogDate[1]);

  // Try datePublished schema.org
  const schemaDate = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (schemaDate) return parseDate(schemaDate[1]);

  // Try time element
  const timeElement = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeElement) return parseDate(timeElement[1]);

  // Try meta date
  const metaDate = html.match(/<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i);
  if (metaDate) return parseDate(metaDate[1]);

  return null;
}

/**
 * Parse date string to YYYY-MM-DD format
 * @param {string} dateStr - Date string
 * @returns {string|null} Formatted date
 */
function parseDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Decode HTML entities
 * @param {string} str - String with HTML entities
 * @returns {string} Decoded string
 */
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract keywords/tags from HTML content
 * @param {string} html - HTML content
 * @returns {string[]} Extracted tags
 */
function extractTags(html) {
  const tags = new Set();

  // Try meta keywords
  const metaKeywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  if (metaKeywords) {
    const keywords = metaKeywords[1].split(/[,，]/).map(k => k.trim().toLowerCase());
    keywords.forEach(k => {
      if (k && k.length > 1 && k.length < 30) tags.add(k);
    });
  }

  // Try article:tag
  const articleTags = html.matchAll(/<meta[^>]*property=["']article:tag["'][^>]*content=["']([^"']+)["']/gi);
  for (const match of articleTags) {
    const tag = match[1].trim().toLowerCase();
    if (tag && tag.length > 1 && tag.length < 30) tags.add(tag);
  }

  return Array.from(tags).slice(0, 10); // Limit to 10 tags
}

/**
 * Infer source type from URL domain
 * @param {string} url - URL string
 * @returns {string} Inferred source type
 */
function inferSourceType(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    // Check exact domain matches first
    for (const [domain, type] of Object.entries(DomainSourceTypeMap)) {
      if (hostname.includes(domain) || (domain.startsWith('blog.') && hostname.startsWith('blog.'))) {
        // Check path-specific mappings
        if (domain.includes('/')) {
          const [domainPart, pathPart] = domain.split('/');
          if (hostname.includes(domainPart) && pathname.includes(pathPart)) {
            return type;
          }
        } else {
          return type;
        }
      }
    }

    // Default to blog for most web content
    return 'blog';
  } catch {
    return 'blog';
  }
}

/**
 * Infer credibility from URL domain
 * @param {string} url - URL string
 * @returns {string} Inferred credibility level
 */
function inferCredibility(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    for (const [domain, credibility] of Object.entries(DomainCredibilityMap)) {
      if (hostname.includes(domain)) {
        return credibility;
      }
    }

    // Default to medium
    return 'medium';
  } catch {
    return 'medium';
  }
}

/**
 * Extract affiliation/organization from content
 * @param {string} html - HTML content
 * @returns {string|null} Extracted affiliation
 */
function extractAffiliation(html) {
  // Try schema.org organization
  const schemaOrg = html.match(/"publisher"\s*:\s*{\s*[^}]*"name"\s*:\s*"([^"]+)"/i);
  if (schemaOrg) return schemaOrg[1];

  // Try og:site_name
  const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (ogSite) return decodeHtmlEntities(ogSite[1]);

  return null;
}

/**
 * Extract metadata from URL
 * @param {string} url - URL to extract from
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} Extracted metadata
 */
async function extractFromUrl(url, options = {}) {
  const result = {
    success: false,
    url,
    metadata: null,
    error: null
  };

  try {
    const { content, contentType, finalUrl } = await fetchUrl(url, options);

    // Only process HTML content
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      result.error = `Unsupported content type: ${contentType}`;
      return result;
    }

    const metadata = {
      title: extractTitle(content),
      author: extractAuthor(content),
      affiliation: extractAffiliation(content),
      date: extractDate(content) || new Date().toISOString().split('T')[0],
      type: inferSourceType(finalUrl),
      credibility: inferCredibility(finalUrl),
      url: finalUrl,
      tags: extractTags(content)
    };

    result.success = true;
    result.metadata = metadata;
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Extract metadata from text content
 * @param {string} text - Text content
 * @param {Object} [hints] - Optional hints about the source
 * @param {string} [hints.sourceType] - Known source type
 * @param {string} [hints.author] - Known author
 * @param {string} [hints.date] - Known date
 * @returns {Object} Extracted metadata
 */
function extractFromText(text, hints = {}) {
  const lines = text.split('\n').filter(l => l.trim());

  // Try to extract title using smart extraction
  let title = extractSmartTitleFromText(text);

  // Try to extract author from common patterns
  let author = hints.author || null;
  if (!author) {
    for (const line of lines.slice(0, 10)) {
      // Pattern: "By Author Name" or "作者: Name"
      const byMatch = line.match(/^(?:by|作者[:：])\s*(.+)/i);
      if (byMatch) {
        author = byMatch[1].trim();
        break;
      }
    }
  }

  // Extract date from content or use hint
  let date = hints.date || null;
  if (!date) {
    for (const line of lines.slice(0, 10)) {
      const dateMatch = line.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
      if (dateMatch) {
        date = parseDate(dateMatch[0]);
        if (date) break;
      }
    }
  }

  // Generate tags from content
  const tags = generateTagsFromText(text);

  return {
    success: true,
    metadata: {
      title: title || 'Untitled Insight',
      author,
      affiliation: null,
      date: date || new Date().toISOString().split('T')[0],
      type: hints.sourceType || 'experience',
      credibility: hints.credibility || 'medium',
      url: null,
      tags
    }
  };
}

/**
 * Smart title extraction from text content
 * Uses heuristics to find the most meaningful title
 * @param {string} text - Text content
 * @returns {string} Extracted title
 */
function extractSmartTitleFromText(text) {
  const lines = text.split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    return 'Untitled Insight';
  }

  // Strategy 1: Look for explicit title markers
  for (const line of lines) {
    const trimmed = line.trim();
    // Check for markdown headings first
    const headingMatch = trimmed.match(/^(#+)\s+(.+)$/);
    if (headingMatch) {
      const extracted = headingMatch[2].trim();
      if (extracted && extracted.length > 2) {
        return truncateTitle(extracted);
      }
    }
    // Check for common title patterns
    if (trimmed.match(/^(标题|题目|主题|Title|Subject)[:：]/i)) {
      const extracted = trimmed.replace(/^(标题|题目|主题|Title|Subject)[:：]\s*/i, '');
      if (extracted && extracted.length > 2) {
        return truncateTitle(extracted);
      }
    }
  }

  // Strategy 2: Find first meaningful sentence
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip common non-title patterns
    if (trimmed.match(/^(笔记|思考|学习|记录|Note|Thought|Memo|Log|今日|今天)/i)) {
      continue;
    }
    // Look for sentences with structure (contains keywords, has proper length)
    if (trimmed.length >= 5 && trimmed.length <= 100) {
      // Contains technical keywords or has proper structure
      if (trimmed.includes(':') || trimmed.includes('的') || trimmed.includes('是') || trimmed.match(/[A-Z][a-z]+/)) {
        return truncateTitle(trimmed);
      }
    }
  }

  // Strategy 3: Use first line with markdown heading removal
  const firstLine = lines[0].trim();
  const withoutHeading = firstLine.replace(/^#+\s*/, '').trim();
  if (withoutHeading && withoutHeading.length > 0) {
    return truncateTitle(withoutHeading);
  }

  return 'Untitled Insight';
}

/**
 * Truncate title to reasonable length
 * @param {string} title - Original title
 * @returns {string} Truncated title
 */
function truncateTitle(title) {
  // Remove common prefixes
  title = title.replace(/^(关于|学习|记录|笔记|思考|学习笔记|今日学习|今天)[:：]?\s*/i, '');

  // Limit length
  if (title.length > 60) {
    // Try to break at word boundary
    const breakPoint = title.substring(0, 60).lastIndexOf(' ');
    if (breakPoint > 20) {
      title = title.substring(0, breakPoint);
    } else {
      title = title.substring(0, 60);
    }
    title += '...';
  }

  return title.trim() || 'Untitled Insight';
}

/**
 * Generate tags from text content
 * @param {string} text - Text content
 * @returns {string[]} Generated tags
 */
function generateTagsFromText(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};

  // Count word frequency
  for (const word of words) {
    // Only consider words that look like potential tags
    if (word.length >= 3 && word.length <= 20 && /^[a-z][a-z0-9-]*$/.test(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  // Common stop words to exclude
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that', 'with',
    'they', 'from', 'what', 'when', 'where', 'which', 'will', 'would', 'could',
    'should', 'there', 'their', 'about', 'these', 'those', 'then', 'than',
    'into', 'just', 'also', 'very', 'some', 'more', 'most', 'other'
  ]);

  // Sort by frequency and filter
  const sortedWords = Object.entries(wordFreq)
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return sortedWords;
}

/**
 * Validate extracted metadata
 * @param {Object} metadata - Extracted metadata
 * @returns {Object} Validation result
 */
function validateMetadata(metadata) {
  const errors = [];
  const warnings = [];

  if (!metadata.title) {
    errors.push('Title is required');
  }

  if (!metadata.date) {
    warnings.push('Date not found, using today');
  }

  if (!metadata.author) {
    warnings.push('Author not found');
  }

  if (!metadata.tags || metadata.tags.length === 0) {
    warnings.push('No tags extracted');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  // Main extraction functions
  extractFromUrl,
  extractFromText,

  // Helper functions
  fetchUrl,
  extractTitle,
  extractAuthor,
  extractDate,
  extractTags,
  extractAffiliation,
  inferSourceType,
  inferCredibility,
  generateTagsFromText,
  validateMetadata,
  extractSmartTitleFromText,
  truncateTitle,

  // Constants (for testing)
  DomainSourceTypeMap,
  DomainCredibilityMap
};
