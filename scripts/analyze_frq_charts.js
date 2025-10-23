#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.join(__dirname, '..');
const CURRICULUM_PATH = path.join(ROOT_DIR, 'data', 'curriculum.js');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'analysis');

const KNOWN_TYPES = [
  'histogram',
  'dotplot',
  'boxplot',
  'scatter',
  'bar',
  'pie',
  'line',
  'numberline',
  'normal',
  'chisquare'
];

const KEYWORD_PATTERNS = [
  { label: 'histogram', type: 'histogram', patterns: [/\bhistogram(s)?\b/i] },
  { label: 'dotplot', type: 'dotplot', patterns: [/\b(dot\s*plot|dotplot)s?\b/i] },
  { label: 'boxplot', type: 'boxplot', patterns: [/\bbox\s*-?\s*(and\s*-?\s*whisker|plot)\b/i, /\bboxplot(s)?\b/i] },
  { label: 'scatterplot', type: 'scatter', patterns: [/\bscatter\s*(plot|diagram)\b/i, /\bscatterplot(s)?\b/i] },
  { label: 'bar chart', type: 'bar', patterns: [/\bbar\s*(chart|graph)s?\b/i] },
  { label: 'pie chart', type: 'pie', patterns: [/\bpie\s*chart(s)?\b/i] },
  { label: 'line graph', type: 'line', patterns: [/\bline\s*(graph|plot)s?\b/i] },
  { label: 'number line', type: 'numberline', patterns: [/\bnumber\s*line(s)?\b/i] },
  { label: 'normal curve', type: 'normal', patterns: [/\bnormal\s*(distribution|curve)\b/i, /\bN\s*\(/i] },
  { label: 'chi-square', type: 'chisquare', patterns: [/\bchi[-\s]?square\b/i, /χ\^?2/i, /chi\s*\^?2/i] },
  { label: 'stem-and-leaf', type: 'other:stemleaf', patterns: [/stem-?and-?leaf/i] },
  { label: 'mosaic', type: 'other:mosaic', patterns: [/\bmosaic\b/i] },
  { label: 'violin', type: 'other:violin', patterns: [/\bviolin\b/i] },
  { label: 'treemap', type: 'other:treemap', patterns: [/\btreemap\b/i] },
  { label: 'sankey', type: 'other:sankey', patterns: [/\bsankey\b/i] },
  { label: 'heatmap', type: 'other:heatmap', patterns: [/\bheat\s*map\b/i] },
  { label: 'matrix', type: 'other:matrix', patterns: [/\bmatrix\b/i] }
];

const DIRECT_TYPE_ALIASES = [
  { type: 'histogram', aliases: ['histogram', 'histograms'] },
  { type: 'dotplot', aliases: ['dot plot', 'dotplot', 'dot plots', 'dotplots'] },
  {
    type: 'boxplot',
    aliases: ['box plot', 'boxplot', 'box plots', 'boxplots', 'box-and-whisker', 'box and whisker', 'box-and-whisker plot']
  },
  { type: 'scatter', aliases: ['scatter', 'scatterplot', 'scatter plot', 'scatter diagram'] },
  { type: 'bar', aliases: ['bar', 'bar chart', 'bar graph'] },
  { type: 'pie', aliases: ['pie', 'pie chart'] },
  { type: 'line', aliases: ['line', 'line graph', 'line plot'] },
  { type: 'numberline', aliases: ['number line', 'numberline'] },
  { type: 'normal', aliases: ['normal', 'normal curve', 'normal distribution', 'n('] },
  { type: 'chisquare', aliases: ['chi-square', 'chi square', 'chisquare', 'chi^2', 'χ^2'] },
  { type: 'other:stemleaf', aliases: ['stem-and-leaf', 'stem and leaf'] },
  { type: 'other:mosaic', aliases: ['mosaic'] },
  { type: 'other:violin', aliases: ['violin', 'violin plot'] },
  { type: 'other:treemap', aliases: ['treemap'] },
  { type: 'other:sankey', aliases: ['sankey'] },
  { type: 'other:heatmap', aliases: ['heatmap', 'heat map'] },
  { type: 'other:matrix', aliases: ['matrix'] }
];

const DIRECT_TYPE_MAP = buildDirectTypeMap();

function buildDirectTypeMap() {
  const map = new Map();
  DIRECT_TYPE_ALIASES.forEach(({ type, aliases }) => {
    aliases.forEach((alias) => {
      const normalized = alias.trim().toLowerCase();
      if (!normalized) return;
      const collapsed = normalized.replace(/\s+/g, ' ');
      map.set(collapsed, type);
      const sanitized = normalized.replace(/[^a-z0-9]+/g, '');
      if (sanitized) {
        map.set(sanitized, type);
      }
    });
  });
  return map;
}

function loadCurriculum(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const context = { module: {}, exports: {}, console: { log: () => {} } };
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);

  try {
    vm.runInContext(
      `${source};\nif (typeof EMBEDDED_CURRICULUM !== 'undefined') { globalThis.__CURRICULUM__ = EMBEDDED_CURRICULUM; } else if (typeof module !== 'undefined' && module.exports) { globalThis.__CURRICULUM__ = module.exports; }`,
      context,
      { filename: path.basename(filePath) }
    );
  } catch (error) {
    throw new Error(`Failed to evaluate curriculum.js: ${error.message}`);
  }

  if (!Array.isArray(context.__CURRICULUM__)) {
    throw new Error('Unable to load curriculum data as an array.');
  }

  return context.__CURRICULUM__;
}

function isFrq(question) {
  if (!question || typeof question !== 'object') return false;
  if (typeof question.type === 'string' && question.type.toLowerCase() === 'free-response') return true;
  if (typeof question.id === 'string' && /frq/i.test(question.id)) return true;
  return false;
}

const TEXT_KEY_REGEX = /(prompt|solution|instruction|text|reason|explanation|stem|question|body|scenario|context|rubric|step|part|response|answer)/i;

function collectRelevantStrings(value, pathKeys = [], strings = []) {
  if (value == null) {
    return strings;
  }

  if (typeof value === 'string') {
    const lastKey = pathKeys[pathKeys.length - 1];
    if (!lastKey || TEXT_KEY_REGEX.test(lastKey) || pathKeys.some((k) => TEXT_KEY_REGEX.test(k))) {
      strings.push(value);
    }
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectRelevantStrings(item, pathKeys.concat(String(idx)), strings));
    return strings;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => collectRelevantStrings(val, pathKeys.concat(key), strings));
  }
  return strings;
}

function cleanText(str) {
  if (!str) return '';
  let text = str;
  text = text.replace(/\\chi/g, 'chi');
  text = text.replace(/χ/g, 'chi');
  text = text.replace(/\$[^$]*\$/g, ' ');
  text = text.replace(/\\\([^)]*\\\)/g, ' ');
  text = text.replace(/\\\[[^\]]*\\\]/g, ' ');
  text = text.replace(/\\[a-zA-Z]+/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

function detectTypesFromText(text, origin) {
  const cleaned = cleanText(text);
  const matches = [];
  const seen = new Set();
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.patterns.some((regex) => regex.test(cleaned))) {
      if (!seen.has(pattern.type)) {
        seen.add(pattern.type);
        matches.push({ type: pattern.type, origin, label: pattern.label });
      }
    }
  }
  return matches;
}

function extractCandidateTokens(raw) {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,\/;]|\band\b|\bor\b/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function canonicalizeDirectToken(token) {
  if (!token) return null;
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  const collapsed = normalized.replace(/\s+/g, ' ');
  if (DIRECT_TYPE_MAP.has(collapsed)) {
    return DIRECT_TYPE_MAP.get(collapsed);
  }
  const sanitized = normalized.replace(/[^a-z0-9]+/g, '');
  if (DIRECT_TYPE_MAP.has(sanitized)) {
    return DIRECT_TYPE_MAP.get(sanitized);
  }
  return null;
}

function resolveTypesFromRawString(raw, origin) {
  if (typeof raw !== 'string') return [];
  const matches = [];
  const seenTypes = new Set();

  const candidates = extractCandidateTokens(raw);
  if (candidates.length === 0) {
    candidates.push(raw);
  }

  candidates.forEach((candidate) => {
    const canonical = canonicalizeDirectToken(candidate);
    if (canonical && !seenTypes.has(canonical)) {
      seenTypes.add(canonical);
      matches.push({ type: canonical, origin, label: canonical });
    }
  });

  const keywordMatches = detectTypesFromText(raw, origin);
  keywordMatches.forEach((match) => {
    if (!seenTypes.has(match.type)) {
      seenTypes.add(match.type);
      matches.push(match);
    }
  });

  return matches;
}

function sanitizeOtherToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const token = cleaned.replace(/[^a-z0-9]+/g, '');
  if (!token) return null;
  return `other:${token}`;
}

function parseIdParts(id) {
  if (typeof id !== 'string') return { unit: '', lesson: '' };
  const unitMatch = id.match(/U(\d+)/i);
  const lessonMatch = id.match(/-L(\d+)/i);
  const result = {
    unit: unitMatch ? unitMatch[1] : '',
    lesson: lessonMatch ? lessonMatch[1] : ''
  };
  if (!result.lesson && /-PC/i.test(id)) {
    result.lesson = 'PC';
  }
  return result;
}

function snippetFromText(text, length = 120) {
  if (!text) return '';
  const cleaned = cleanText(text).replace(/\s+/g, ' ');
  if (cleaned.length <= length) return cleaned;
  return `${cleaned.slice(0, length - 1)}…`;
}

function analyzeFrq(frq) {
  const detections = [];
  let requiresChart = false;
  const flagTypeSet = new Set();
  const flagTypes = [];
  const keywordTypeSet = new Set();
  const keywordTypes = [];

  function addType(targetSet, targetList, type) {
    if (!type) return;
    if (!targetSet.has(type)) {
      targetSet.add(type);
      targetList.push(type);
    }
  }

  function handleMatches(matches, targetSet, targetList) {
    for (const match of matches) {
      addType(targetSet, targetList, match.type);
      detections.push(`${match.origin}:${match.label}`);
    }
  }

  function traverseForFlags(value) {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(traverseForFlags);
      return;
    }
    if (typeof value !== 'object') return;

    for (const [key, val] of Object.entries(value)) {
      if (key === 'requiresGraph') {
        if (val) {
          requiresChart = true;
          if (typeof val === 'string') {
            const matches = resolveTypesFromRawString(val, 'flag:requiresGraph');
            if (matches.length > 0) {
              handleMatches(matches, flagTypeSet, flagTypes);
            } else {
              const fallback = sanitizeOtherToken(val);
              if (fallback) {
                addType(flagTypeSet, flagTypes, fallback);
                detections.push('flag:requiresGraph:' + fallback);
              } else {
                detections.push('flag:requiresGraph');
              }
            }
          } else {
            detections.push('flag:requiresGraph');
          }
        }
      } else if (key === 'chartType') {
        if (val != null) {
          requiresChart = true;
          const values = Array.isArray(val) ? val : [val];
          values.forEach((entry) => {
            if (typeof entry === 'string') {
              const matches = resolveTypesFromRawString(entry, 'flag:chartType');
              if (matches.length > 0) {
                handleMatches(matches, flagTypeSet, flagTypes);
              } else {
                const fallback = sanitizeOtherToken(entry);
                if (fallback) {
                  addType(flagTypeSet, flagTypes, fallback);
                  detections.push('flag:chartType:' + fallback);
                }
              }
            }
          });
        }
      }

      if (val && typeof val === 'object') {
        traverseForFlags(val);
      } else if (Array.isArray(val)) {
        traverseForFlags(val);
      }
    }
  }

  traverseForFlags(frq);

  const textChunks = collectRelevantStrings({
    prompt: frq.prompt,
    solution: frq.solution,
    instructions: frq.instructions,
    reasoning: frq.reasoning,
    explanation: frq.explanation
  });

  if (Array.isArray(frq.parts)) {
    collectRelevantStrings(frq.parts, ['parts'], textChunks);
  }
  if (frq.context) {
    collectRelevantStrings(frq.context, ['context'], textChunks);
  }

  const uniqueChunks = Array.from(new Set(textChunks.filter(Boolean)));

  for (const chunk of uniqueChunks) {
    const matches = detectTypesFromText(chunk, 'keyword');
    handleMatches(matches, keywordTypeSet, keywordTypes);
  }

  if (keywordTypes.length > 0) {
    requiresChart = true;
  }

  let finalTypes = [];
  if (flagTypes.length > 0) {
    finalTypes = flagTypes.slice();
  } else if (keywordTypes.length > 0) {
    finalTypes = keywordTypes.slice();
  } else if (requiresChart) {
    const fallback = 'other:unspecified';
    finalTypes = [fallback];
    detections.push('fallback:' + fallback);
  }

  const dedupDetections = Array.from(new Set(detections));

  let chartType = null;
  let typeList = [];
  if (finalTypes.length === 0) {
    chartType = 'words-only';
    requiresChart = false;
  } else if (finalTypes.length === 1) {
    chartType = finalTypes[0];
    typeList = [chartType];
  } else {
    chartType = 'multi';
    typeList = finalTypes;
  }

  const promptText = typeof frq.prompt === 'string' ? frq.prompt : uniqueChunks[0] || '';
  const promptSnippet = snippetFromText(promptText, 120);
  const { unit, lesson } = parseIdParts(frq.id || '');

  const isWordsOnly = chartType === 'words-only';

  return {
    id: frq.id || '',
    unit,
    lesson,
    originalType: frq.type || '',
    requiresChart: !isWordsOnly,
    chartType,
    types: chartType === 'multi' ? typeList : [],
    detections: dedupDetections,
    promptSnippet,
    unknownReason: isWordsOnly ? 'noKeywordsNoFlags' : null
  };
}

function buildSummary(records) {
  const summary = {
    totalFrqs: records.length,
    wordsOnly: 0,
    chartFrqs: 0,
    byType: {},
    unknowns: []
  };

  for (const type of KNOWN_TYPES) {
    summary.byType[type] = { count: 0, ids: [] };
  }
  summary.byType.multi = { count: 0, items: [] };
  const otherMap = new Map();

  records.forEach((record) => {
    if (!record.requiresChart) {
      summary.wordsOnly += 1;
      summary.unknowns.push({ id: record.id, reason: record.unknownReason || 'noKeywordsNoFlags' });
      return;
    }

    summary.chartFrqs += 1;

    if (record.chartType === 'multi') {
      summary.byType.multi.count += 1;
      summary.byType.multi.items.push({ id: record.id, types: record.types.slice() });
      return;
    }

    const chartType = record.chartType;
    if (KNOWN_TYPES.includes(chartType)) {
      summary.byType[chartType].count += 1;
      summary.byType[chartType].ids.push(record.id);
    } else if (chartType.startsWith('other:')) {
      const token = chartType.slice('other:'.length);
      if (!otherMap.has(token)) {
        otherMap.set(token, { token, count: 0, ids: [] });
      }
      const entry = otherMap.get(token);
      entry.count += 1;
      entry.ids.push(record.id);
    }
  });

  summary.byType.other = Array.from(otherMap.values()).sort((a, b) => a.token.localeCompare(b.token));
  for (const type of KNOWN_TYPES) {
    summary.byType[type].ids.sort();
  }
  summary.byType.multi.items.sort((a, b) => a.id.localeCompare(b.id));
  summary.unknowns.sort((a, b) => a.id.localeCompare(b.id));
  return summary;
}

function writeJson(summary, filePath) {
  const jsonData = {
    totalFrqs: summary.totalFrqs,
    wordsOnly: summary.wordsOnly,
    chartFrqs: summary.chartFrqs,
    byType: {
      histogram: summary.byType.histogram,
      dotplot: summary.byType.dotplot,
      boxplot: summary.byType.boxplot,
      scatter: summary.byType.scatter,
      bar: summary.byType.bar,
      pie: summary.byType.pie,
      line: summary.byType.line,
      numberline: summary.byType.numberline,
      normal: summary.byType.normal,
      chisquare: summary.byType.chisquare,
      multi: summary.byType.multi,
      other: summary.byType.other
    },
    unknowns: summary.unknowns
  };

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsv(records, filePath) {
  const headers = ['id', 'unit', 'lesson', 'type', 'requiresChart', 'chartType', 'types', 'detection', 'promptSnippet'];
  const lines = [headers.join(',')];
  records.forEach((record) => {
    const typesField = record.chartType === 'multi' ? record.types.join(';') : '';
    const detectionField = record.detections.join(';');
    const row = [
      csvEscape(record.id),
      csvEscape(record.unit),
      csvEscape(record.lesson),
      csvEscape(record.originalType),
      csvEscape(record.requiresChart),
      csvEscape(record.chartType),
      csvEscape(typesField),
      csvEscape(detectionField),
      csvEscape(record.promptSnippet)
    ];
    lines.push(row.join(','));
  });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function printSummary(summary, records) {
  console.log(`Total FRQs: ${summary.totalFrqs}`);
  console.log(`Words-only: ${summary.wordsOnly}`);
  console.log(`Chart FRQs: ${summary.chartFrqs}`);
  console.log('Counts by chart type:');
  for (const type of KNOWN_TYPES) {
    const entry = summary.byType[type];
    console.log(`  ${type}: ${entry.count}`);
  }
  console.log(`  multi: ${summary.byType.multi.count}`);
  if (summary.byType.other.length > 0) {
    summary.byType.other.forEach((entry) => {
      console.log(`  other:${entry.token}: ${entry.count}`);
    });
  }
  const unknowns = summary.unknowns.slice(0, 10);
  if (unknowns.length > 0) {
    console.log('Top unknown/words-only FRQs:');
    const recordMap = new Map(records.map((r) => [r.id, r]));
    unknowns.forEach((item) => {
      const record = recordMap.get(item.id);
      const snippet = record ? record.promptSnippet : '';
      console.log(`  ${item.id}: ${snippet}`);
    });
  }
}

function main() {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const curriculum = loadCurriculum(CURRICULUM_PATH);
    const frqs = curriculum.filter(isFrq);
    const records = frqs.map(analyzeFrq);
    const summary = buildSummary(records);
    writeJson(summary, path.join(OUTPUT_DIR, 'frq_chart_inventory.json'));
    writeCsv(records, path.join(OUTPUT_DIR, 'frq_chart_inventory.csv'));
    printSummary(summary, records);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
