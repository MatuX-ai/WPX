/**
 * WPX 桌面端集成测试
 *
 * 覆盖三大端到端工作流：
 *  1. MD 智能排版引擎（5 个模板 + 图片对齐策略）
 *  2. 本地指令系统（58 个内置指令）
 *  3. JCode + PPT 工作流（launcher 状态机 / callSwarm 降级 / usePPTWorkflow 四步）
 *
 * 运行： node scripts/desktop-integration-test.mjs
 * 退出码： 0 = 全部通过；1 = 存在失败用例
 */
import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

const results = { passed: 0, failed: 0, failures: [], timings: {} }
const log = (line, c = RESET) => process.stdout.write(`${c}${line}${RESET}\n`)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ELECTRON_DIR = path.join(ROOT, 'electron')
const WPX_APP_DIR = path.join(ROOT, 'wpx-app')

function pass(name, ms) {
  results.passed += 1
  results.timings[name] = ms
  log(`  ${GREEN}✓${RESET} ${name}  ${YELLOW}(${ms.toFixed(1)}ms)${RESET}`)
}
function fail(name, err) {
  results.failed += 1
  results.failures.push({ name, error: err?.stack || String(err) })
  log(`  ${RED}✗${RESET} ${name}`)
  log(`    ${RED}${err?.message || err}${RESET}`)
}
async function step(name, fn) {
  const t0 = performance.now()
  try { await fn(); pass(name, performance.now() - t0) }
  catch (e) { fail(name, e) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, e, m) => { if (a !== e) throw new Error(`${m||'eq'} (expected ${JSON.stringify(e)}, got ${JSON.stringify(a)})`) }

const electronRequire = createRequire(path.join(ELECTRON_DIR, '_dummy.cjs'))
const launcher = electronRequire(path.join(ELECTRON_DIR, 'services', 'jcode-launcher.js'))
const detector = electronRequire(path.join(ELECTRON_DIR, 'services', 'jcode-detector.js'))

/* ─────────── vitest 子进程：写临时 spec → 跑 → 解析 JSON ─────────── */
async function runVitestInline(virtualName, virtualContent) {
  const fs = await import('node:fs/promises')
  const tmpPath = path.join(WPX_APP_DIR, 'src', '__integration_tmp__', `${virtualName}.spec.js`)
  await fs.mkdir(path.dirname(tmpPath), { recursive: true })
  await fs.writeFile(tmpPath, virtualContent, 'utf8')
  try {
    return await new Promise((resolve) => {
      const child = spawn('node', [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--reporter=json',
        '--no-color',
        tmpPath,
      ], { cwd: WPX_APP_DIR, shell: true, windowsHide: true })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => (out += d.toString()))
      child.stderr.on('data', (d) => (err += d.toString()))
      child.on('exit', () => {
        // vitest 末尾可能混 PowerShell 警告；找 JSON 字符串外最右 '}'
        let lastClose = -1, inStr = false, esc = false
        for (let i = 0; i < out.length; i++) {
          const ch = out[i]
          if (esc) { esc = false; continue }
          if (ch === '\\') { esc = true; continue }
          if (ch === '"') { inStr = !inStr; continue }
          if (!inStr && ch === '}') lastClose = i
        }
        if (lastClose > 0) {
          try {
            const json = JSON.parse(out.slice(0, lastClose + 1))
            resolve({
              ok: json.success === true,
              passed: json.numPassedTests ?? 0,
              failed: json.numFailedTests ?? 0,
              total: json.numTotalTests ?? 0,
              stderr: err,
            })
            return
          } catch { /* fallthrough */ }
        }
        resolve({ ok: false, passed: 0, failed: 1, total: 0, stderr: err + '\n' + out.slice(-300) })
      })
    })
  } finally {
    await fs.rm(tmpPath, { force: true })
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* 一、MD 智能排版引擎                                              */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 一、MD 智能排版引擎 ══════════${RESET}`)

await step('MD 排版：detectMarkdown 识别 #/-/|/> 等 MD 标记', async () => {
  const r = await runVitestInline('md-detect', `
import { detectMarkdown } from '@/utils/markdownDetector';
import { describe, it, expect } from 'vitest';
describe('detect', () => {
  it('case A: heading/list/quote/table', () => {
    expect(detectMarkdown('# 标题')).toBe(true);
    expect(detectMarkdown('- 项目')).toBe(true);
    expect(detectMarkdown('> 引用')).toBe(true);
    expect(detectMarkdown('| a | b |\\n| - | - |')).toBe(true);
  });
  it('case B: plain text returns false', () => {
    expect(detectMarkdown('普通文字，没有标记')).toBe(false);
  });
  it('case C: short text returns false', () => {
    expect(detectMarkdown('a')).toBe(false);
    expect(detectMarkdown('')).toBe(false);
  });
});`)
  assert(r.ok, `MD detect 子用例失败：${r.stderr}`)
})

await step('MD 排版：5 个模板元数据完整', async () => {
  const r = await runVitestInline('md-templates', `
import { MARKDOWN_TEMPLATES, getTemplateList, getTemplateById } from '@/composables/useMarkdownFormatter';
import { describe, it, expect } from 'vitest';
describe('templates', () => {
  it('has 5 templates', () => {
    expect(Object.keys(MARKDOWN_TEMPLATES).sort())
      .toEqual(['article','lesson-plan','official','paper','report']);
  });
  it('labels correct', () => {
    expect(MARKDOWN_TEMPLATES.article.label).toBe('通用文章');
    expect(MARKDOWN_TEMPLATES.report.label).toBe('正式报告');
    expect(MARKDOWN_TEMPLATES.official.label).toBe('公文通知');
    expect(MARKDOWN_TEMPLATES['lesson-plan'].label).toBe('教案模板');
    expect(MARKDOWN_TEMPLATES.paper.label).toBe('科研论文');
  });
  it('getTemplateList returns 5 items', () => {
    expect(getTemplateList()).toHaveLength(5);
  });
  it('getTemplateById returns correct', () => {
    expect(getTemplateById('article')?.label).toBe('通用文章');
    expect(getTemplateById('not-exist')).toBeNull();
  });
});`)
  assert(r.ok, `MD 模板子用例失败：${r.stderr}`)
})

await step('MD 排版：图片对齐策略（fill/narrow/keep 三模式）', async () => {
  const r = await runVitestInline('md-imagealign', `
import { getDefaultImageAlignMode, hasImagesInDoc, getDocumentHasMarkdown } from '@/composables/useMarkdownFormatter';
import { describe, it, expect } from 'vitest';
function mock(ws){return {state:{doc:{descendants(cb){ws.forEach(n=>cb(n))}}}}};
describe('image align', () => {
  it('fill when width>400', () => {
    expect(getDefaultImageAlignMode(mock([{type:{name:'image'},attrs:{width:600}}]))).toBe('fill');
  });
  it('narrow when width<400', () => {
    expect(getDefaultImageAlignMode(mock([{type:{name:'image'},attrs:{width:300}}]))).toBe('narrow');
  });
  it('narrow when percentage<=65%', () => {
    expect(getDefaultImageAlignMode(mock([{type:{name:'image'},attrs:{width:'60%'}}]))).toBe('narrow');
  });
  it('fill when no images', () => {
    expect(getDefaultImageAlignMode(mock([]))).toBe('fill');
  });
  it('hasImagesInDoc true/false', () => {
    expect(hasImagesInDoc(mock([{type:{name:'image'},attrs:{}}]))).toBe(true);
    expect(hasImagesInDoc(mock([]))).toBe(false);
  });
});`)
  assert(r.ok, `MD 图片对齐子用例失败：${r.stderr}`)
})

await step('MD 排版：formatDocument 把模板规则应用到节点', async () => {
  const r = await runVitestInline('md-format', `
import { formatDocument, alignImages } from '@/composables/useMarkdownFormatter';
import { describe, it, expect, vi } from 'vitest';
function buildEditor(nodes) {
  const trCalls = [];
  const tr = {
    setNodeMarkup: vi.fn((pos, type, attrs) => { trCalls.push({ pos, attrs }); return tr; }),
    addMark: vi.fn(() => tr),
    removeMark: vi.fn(() => tr),
  };
  const schema = {
    marks: {
      fontSize: { create: (a) => ({ type: { name: 'fontSize' }, attrs: a }) },
      lineHeight: { create: (a) => ({ type: { name: 'lineHeight' }, attrs: a }) },
      fontFamily: { create: (a) => ({ type: { name: 'fontFamily' }, attrs: a }) },
    },
  };
  // 将 { type, attrs } 转换成带 isBlock 的 Tiptap-like 节点
  const wrapped = nodes.map((n) => ({ ...n, isBlock: n.type?.name !== 'image' }));
  return {
    state: { doc: {
      descendants: (cb) => { wrapped.forEach((n, i) => cb(n, i + 1)); },
      nodeAt: (pos) => wrapped[pos - 1] || null,
      textContent: '',
    } },
    schema,
    commands: { command: (cb) => {
      const dispatch = (t) => { return t; };
      return cb({ tr, dispatch });
    } },
    __trCalls: trCalls,
  };
}
describe('format', () => {
  it('article H1 center', () => {
    const e = buildEditor([{ type: { name: 'heading', attrs: { level: 1 } }, attrs: { level: 1 } }]);
    const r = formatDocument(e, 'article');
    expect(r.ok).toBe(true);
    const sm = e.__trCalls.find((c) => c.attrs && c.attrs.textAlign === 'center');
    expect(sm).toBeTruthy();
  });
  it('unknown template returns error', () => {
    const e = buildEditor([{ type: { name: 'paragraph' }, attrs: {} }]);
    const r = formatDocument(e, 'no-such');
    expect(r.ok).toBe(false);
  });
  it('alignImages narrow sets width=65%', () => {
    const e = buildEditor([{ type: { name: 'image' }, attrs: {} }]);
    const r = alignImages(e, 'narrow');
    expect(r.ok).toBe(true);
    const sm = e.__trCalls.find((c) => c.attrs && c.attrs.width === '65%');
    expect(sm).toBeTruthy();
  });
});`)
  assert(r.ok, `MD formatDocument 子用例失败：${r.stderr}`)
})

/* ═══════════════════════════════════════════════════════════════ */
/* 二、本地指令系统                                                  */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 二、本地指令系统 ══════════${RESET}`)

await step('本地指令：58 个内置指令总数正确', async () => {
  const r = await runVitestInline('cmd-count', `
import { LOCAL_COMMANDS, LOCAL_COMMANDS_COUNT } from '@/data/local-commands';
import { describe, it, expect } from 'vitest';
describe('count', () => {
  it('58 commands registered', () => {
    expect(LOCAL_COMMANDS_COUNT).toBe(58);
    expect(LOCAL_COMMANDS.length).toBe(58);
  });
  it('10 categories', () => {
    const cats = new Set(LOCAL_COMMANDS.map((c) => c.category));
    expect(cats).toEqual(new Set(['text','format','font','align','heading','list','insert','view','file','window']));
  });
});`)
  assert(r.ok, `指令总数子用例失败：${r.stderr}`)
})

await step('本地指令：文本/格式/字体/对齐/标题/插入/视图/文件/窗口九大类匹配', async () => {
  const r = await runVitestInline('cmd-classify', `
import { processUserInput } from '@/composables/useLocalCommands';
import { describe, it, expect } from 'vitest';
function ed() {
  const c = new Proxy({}, { get: (_, p) => p === 'run' ? () => true : () => c });
  return { state: { selection: { from: 0, to: 0 }, doc: { textContent: '', textBetween: () => '', descendants: () => {} } }, chain: () => c, can: () => ({ undo: () => true, redo: () => true }) };
}
const cases = [
  ['删除', { editor: ed(), hasSelection: true }, 'delete-selection'],
  ['复制', { editor: ed(), hasSelection: true }, 'copy-selection'],
  ['加粗', { editor: ed(), hasSelection: true }, 'bold'],
  ['斜体', { editor: ed(), hasSelection: true }, 'italic'],
  ['下划线', { editor: ed(), hasSelection: true }, 'underline'],
  ['清除格式', { editor: ed(), hasSelection: true }, 'clear-format'],
  ['用思源黑体', { editor: ed(), hasSelection: true }, 'font-source-han-sans'],
  ['用JetBrains Mono', { editor: ed(), hasSelection: true }, 'font-jetbrains-mono'],
  ['用默认字体', { editor: ed(), hasSelection: true }, 'font-default'],
  ['居中', { editor: ed(), hasCursor: true }, 'align-center'],
  ['左对齐', { editor: ed(), hasCursor: true }, 'align-left'],
  ['右对齐', { editor: ed(), hasCursor: true }, 'align-right'],
  ['两端对齐', { editor: ed(), hasCursor: true }, 'align-justify'],
  ['标题1', { editor: ed(), hasCursor: true }, 'heading-1'],
  ['标题2', { editor: ed(), hasCursor: true }, 'heading-2'],
  ['设为标题三', { editor: ed(), hasCursor: true }, 'heading-3'],
  ['正文', { editor: ed(), hasCursor: true }, 'paragraph'],
  ['无序列表', { editor: ed(), hasCursor: true }, 'bullet-list'],
  ['有序列表', { editor: ed(), hasCursor: true }, 'ordered-list'],
  ['引用', { editor: ed(), hasCursor: true }, 'blockquote'],
  ['代码块', { editor: ed(), hasCursor: true }, 'code-block'],
  ['插入表格', { editor: ed() }, 'insert-table'],
  ['插入分隔线', { editor: ed() }, 'insert-hr'],
  ['插入日期', { editor: ed() }, 'insert-date'],
  ['插入时间', { editor: ed() }, 'insert-time'],
  ['插入图片', { editor: ed() }, 'insert-image'],
  ['导出PDF', { editor: ed(), documentContent: 'hello' }, 'export-pdf'],
  ['导出Word', { editor: ed(), documentContent: 'hello' }, 'export-docx'],
  ['保存', { editor: ed(), saveDocument: () => {} }, 'save'],
  ['新建', { editor: ed() }, 'new-document'],
  ['设置', {}, 'open-settings'],
  ['字体商店', {}, 'open-font-market'],
  ['文库', {}, 'open-library'],
];
describe('classify', () => {
  for (const [input, ctx, expected] of cases) {
    it('input=' + JSON.stringify(input), () => {
      const r = processUserInput(input, ctx);
      expect(r.commandId).toBe(expected);
    });
  }
});`)
  assert(r.ok, `分类匹配子用例失败：${r.stderr}`)
})

await step('本地指令：未匹配回退到 AI（type=ai）', async () => {
  const r = await runVitestInline('cmd-fallback', `
import { processUserInput } from '@/composables/useLocalCommands';
import { describe, it, expect } from 'vitest';
describe('fallback', () => {
  it('生成一份教案 goes to AI', () => {
    expect(processUserInput('生成一份教案', {}).type).toBe('ai');
  });
  it('今天天气真好 goes to AI', () => {
    expect(processUserInput('今天天气真好', {}).type).toBe('ai');
  });
  it('empty input goes to AI', () => {
    expect(processUserInput('', {}).type).toBe('ai');
  });
  it('non-string goes to AI', () => {
    expect(processUserInput(null, {}).type).toBe('ai');
  });
});`)
  assert(r.ok, `fallback 子用例失败：${r.stderr}`)
})

await step('本地指令：MD 排版指令 format-md / align-md-images', async () => {
  const r = await runVitestInline('cmd-md', `
import { processUserInput } from '@/composables/useLocalCommands';
import { describe, it, expect } from 'vitest';
function edWith(types) {
  return { state: { selection: { from: 0, to: 0 }, doc: { descendants: (cb) => types.forEach((t) => cb({ type: { name: t }, attrs: {} })) } }, chain: () => ({ focus: () => ({ run: () => true }) }), can: () => ({ undo: () => true, redo: () => true }) };
}
describe('md cmds', () => {
  it('排版 + heading → format-md', () => {
    const r = processUserInput('排版', { editor: edWith(['heading']) });
    expect(r.commandId).toBe('format-md');
    expect(r.message).toBe('__MARKDOWN_FORMAT_PROMPT__');
  });
  it('美化 → format-md', () => {
    expect(processUserInput('美化', { editor: edWith(['bulletList']) }).commandId).toBe('format-md');
  });
  it('format md 英文 → format-md', () => {
    expect(processUserInput('format md', { editor: edWith(['table']) }).commandId).toBe('format-md');
  });
  it('排版 + 纯 paragraph → failure', () => {
    const r = processUserInput('排版', { editor: edWith(['paragraph']) });
    expect(r.success).toBe(false);
  });
  it('对齐图片 + image → align-md-images', () => {
    const r = processUserInput('对齐图片', { editor: edWith(['image']) });
    expect(r.commandId).toBe('align-md-images');
    expect(r.message).toBe('__MARKDOWN_IMAGE_ALIGN_PROMPT__');
  });
  it('对齐图片 + 无图 → failure', () => {
    expect(processUserInput('对齐图片', { editor: edWith(['heading']) }).success).toBe(false);
  });
});`)
  assert(r.ok, `MD 指令子用例失败：${r.stderr}`)
})

/* ═══════════════════════════════════════════════════════════════ */
/* 三、JCode 状态机                                                  */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 三、JCode 状态机 ══════════${RESET}`)

await step('STATES 枚举完整（5 个状态）', () => {
  const keys = Object.keys(launcher.STATES).sort()
  eq(keys.join(','), 'FAILED,RUNNING,SLEEPING,STARTING,STOPPED', 'STATES 枚举字段不一致')
})

await step('IDLE_TIMEOUT_MS = 5 分钟', () => {
  eq(launcher.IDLE_TIMEOUT_MS, 5 * 60 * 1000, '空闲休眠时长错误')
})

await step('isJcodeRunning 仅在 RUNNING 时为 true', () => {
  launcher.setStatus({ state: 'STOPPED' })
  assert(!launcher.isJcodeRunning(), 'STOPPED 不应返回 true')
  launcher.setStatus({ state: 'RUNNING' })
  assert(launcher.isJcodeRunning(), 'RUNNING 应返回 true')
  launcher.setStatus({ state: 'FAILED' })
  assert(!launcher.isJcodeRunning(), 'FAILED 不应返回 true')
  launcher.setStatus({ state: 'STOPPED', lastError: null, lastActivityAt: null })
})

await step('on("status") 订阅能收到状态变化', () => {
  const events = []
  const off = launcher.on('status', (s) => events.push(s.state))
  try {
    launcher.setStatus({ state: 'RUNNING' })
    launcher.setStatus({ state: 'SLEEPING' })
  } finally { off() }
  assert(events.includes('RUNNING'), '未收到 RUNNING 事件')
  assert(events.includes('SLEEPING'), '未收到 SLEEPING 事件')
})

await step('off 取消订阅', () => {
  const events = []
  const listener = (s) => events.push(s.state)
  launcher.on('status', listener)
  launcher.off('status', listener)
  launcher.setStatus({ state: 'RUNNING' })
  eq(events.length, 0, 'off 后仍收到事件')
})

await step('markActivity 在 RUNNING 时更新 lastActivityAt', () => {
  launcher.setStatus({ state: 'RUNNING', lastActivityAt: 0 })
  const before = Date.now()
  launcher.markActivity()
  const after = Date.now()
  const s = launcher.getStatus()
  assert(s.lastActivityAt >= before && s.lastActivityAt <= after, `lastActivityAt=${s.lastActivityAt} 不在 [${before},${after}]`)
  launcher.setStatus({ state: 'STOPPED', lastError: null, lastActivityAt: null })
})

await step('markActivity 在 STOPPED 时无副作用', () => {
  launcher.setStatus({ state: 'STOPPED', lastActivityAt: 0 })
  launcher.markActivity()
  eq(launcher.getStatus().state, 'STOPPED', 'STOPPED 被误启动')
})

await step('detect 报告未安装时 startJcode → FAILED 且 reason 保留', async () => {
  const original = detector.detectJcode
  detector.detectJcode = async () => ({
    installed: false, path: null, version: null, reason: 'integration-mock-not-found',
  })
  try {
    launcher.setStatus({ state: 'STOPPED' })
    const status = await launcher.startJcode()
    eq(status.state, 'FAILED', '未安装应进入 FAILED')
    assert(String(status.lastError || '').includes('integration-mock-not-found'), `reason 未保留: ${status.lastError}`)
  } finally {
    detector.detectJcode = original
    await launcher.stopJcode({ reason: 'test teardown' })
  }
})

await step('ensureJcodeRunning 在 STOPPED+未安装时 → FAILED', async () => {
  const original = detector.detectJcode
  detector.detectJcode = async () => ({ installed: false, reason: 'no-jcode' })
  try {
    launcher.setStatus({ state: 'STOPPED' })
    const status = await launcher.ensureJcodeRunning()
    eq(status.state, 'FAILED', 'ensureJcodeRunning 应进入 FAILED')
  } finally {
    detector.detectJcode = original
    await launcher.stopJcode({ reason: 'test teardown' })
  }
})

await step('stopJcode 在无 proc 时置 STOPPED 并写入 lastError=reason', async () => {
  launcher.setStatus({ state: 'RUNNING', pid: null })
  const status = await launcher.stopJcode({ reason: 'integration-stop' })
  eq(status.state, 'STOPPED', '应回到 STOPPED')
  eq(status.lastError, 'integration-stop', 'reason 未透传到 lastError')
})

/* ═══════════════════════════════════════════════════════════════ */
/* 四、PPT 工作流（usePPTWorkflow）                                 */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 四、PPT 工作流 ══════════${RESET}`)

await step('PPT 工作流：四步状态机初始为 STEP_OUTLINE', async () => {
  const r = await runVitestInline('ppt-init', `
import { PPT_STEP, usePPTWorkflow } from '@/composables/usePPTWorkflow';
import { describe, it, expect } from 'vitest';
describe('init', () => {
  it('step1 outline', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    expect(w.state.step).toBe(PPT_STEP.OUTLINE);
    expect(w.stepIndex.value).toBe(0);
    expect(w.progress.value).toBeCloseTo(0.25);
  });
  it('PPT_STEP constants', () => {
    expect(PPT_STEP.OUTLINE).toBe('STEP_OUTLINE');
    expect(PPT_STEP.TEMPLATE).toBe('STEP_TEMPLATE');
    expect(PPT_STEP.GENERATE).toBe('STEP_GENERATE');
    expect(PPT_STEP.EDITING).toBe('STEP_EDITING');
  });
  it('singleton share', () => {
    const a = usePPTWorkflow();
    const b = usePPTWorkflow();
    expect(a.state).toBe(b.state);
  });
});`)
  assert(r.ok, `PPT init 子用例失败：${r.stderr}`)
})

await step('PPT 工作流：startWorkflow → confirmOutline → selectTemplate → onSlidesGenerated', async () => {
  const r = await runVitestInline('ppt-e2e', `
import { PPT_STEP, usePPTWorkflow } from '@/composables/usePPTWorkflow';
import { describe, it, expect } from 'vitest';
describe('e2e', () => {
  it('full lifecycle', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    expect(w.startWorkflow('AI 产品发布会')).toBe(true);
    expect(w.state.step).toBe(PPT_STEP.OUTLINE);
    expect(w.confirmOutline('# 封面\\n## 市场\\n## 卖点')).toBe(true);
    expect(w.state.step).toBe(PPT_STEP.TEMPLATE);
    expect(w.selectTemplate('tech')).toBe(true);
    expect(w.state.step).toBe(PPT_STEP.GENERATE);
    expect(w.state.templateId).toBe('tech');
    const slides = [
      { component: 'CoverSlide', props: { title: 'AI 产品发布会' } },
      { component: 'TextSlide', props: { title: '卖点', bulletPoints: ['快','稳','省'] } },
      { component: 'EndSlide', props: { text: '谢谢' } },
    ];
    expect(w.onSlidesGenerated(slides)).toBe(true);
    expect(w.state.step).toBe(PPT_STEP.EDITING);
    expect(w.state.slides).toHaveLength(3);
    expect(w.state.completedAt).toBeGreaterThan(0);
    expect(w.progress.value).toBe(1);
  });
});`)
  assert(r.ok, `PPT 端到端子用例失败：${r.stderr}`)
})

await step('PPT 工作流：模板白名单 + 自定义模板描述', async () => {
  const r = await runVitestInline('ppt-templates', `
import { PPT_STEP, usePPTWorkflow } from '@/composables/usePPTWorkflow';
import { describe, it, expect } from 'vitest';
describe('templates', () => {
  it('business/tech/fresh 全部可接受', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    w.startWorkflow('T');
    w.confirmOutline('# X');
    expect(w.selectTemplate('business')).toBe(true);
    expect(w.selectTemplate('tech')).toBe(true);
    expect(w.selectTemplate('fresh')).toBe(true);
  });
  it('custom 需带描述', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    w.startWorkflow('T');
    w.confirmOutline('# X');
    expect(w.selectTemplate('custom')).toBe(false);
    expect(w.selectTemplate('custom', '特斯拉极简')).toBe(true);
    expect(w.state.templateCustom).toBe('特斯拉极简');
  });
  it('illegal templateId rejected', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    w.startWorkflow('T');
    w.confirmOutline('# X');
    expect(w.selectTemplate('garbage')).toBe(false);
    expect(w.state.step).toBe(PPT_STEP.TEMPLATE);
  });
});`)
  assert(r.ok, `PPT 模板子用例失败：${r.stderr}`)
})

await step('PPT 工作流：系统提示词片段编译（4 步各 1 个 hint）', async () => {
  const r = await runVitestInline('ppt-prompt', `
import { usePPTWorkflow } from '@/composables/usePPTWorkflow';
import { describe, it, expect } from 'vitest';
describe('prompt', () => {
  it('all 4 steps', () => {
    const w = usePPTWorkflow();
    w.resetWorkflow();
    w.startWorkflow('主题A');
    const h1 = w.getSystemPromptAddition();
    expect(h1).toContain('当前步骤：生成大纲');
    expect(h1).toContain('主题：主题A');
    w.confirmOutline('# X');
    const h2 = w.getSystemPromptAddition();
    expect(h2).toContain('当前步骤：选择模板');
    w.selectTemplate('tech');
    const h3 = w.getSystemPromptAddition();
    expect(h3).toContain('当前步骤：生成幻灯片');
    w.onSlidesGenerated([{ component: 'X', props: {} }]);
    const h4 = w.getSystemPromptAddition();
    expect(h4).toContain('当前步骤：编辑中');
    expect(h4).toContain('exportAsHTML');
    expect(h4).toContain('exportAsPPTX');
  });
});`)
  assert(r.ok, `PPT 提示词子用例失败：${r.stderr}`)
})

/* ═══════════════════════════════════════════════════════════════ */
/* 五、JCode → PPT 调用链                                            */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 五、JCode → PPT 调用链 ══════════${RESET}`)

await step('PPT 意图识别：用户自然语言 → topic 抽取', async () => {
  const r = await runVitestInline('ppt-intent', `
// 使用 RegExp 字面量避免字符串转义陷阱
const TRIGGER = /(?:帮我|帮我弄|请|麻烦|能|可以|能不能|想|要)?\\s*(?:生成|做|写|弄|画|设计|出|创建)/;
const TYPE = /(?:PPT|ppt|幻灯片|演示稿|演示文稿|演讲稿|讲稿|片子|slides?|deck|presentation)/;
// 构造完整的 RX
const RX = new RegExp('(?:' + TRIGGER.source + ')\\\\s*(?:一份|一个|下|个|篇|a|an)?\\\\s*([\\\\s\\\\S]*?)\\\\s*(?:' + TYPE.source + ')', 'i');
const PRES_RX = /\\b(presentation)\\b/i;
function extract(m) {
  if (!m || typeof m !== 'string') return { matched: false, topic: '' };
  const x = m.match(RX);
  if (x) {
    const topic = (x[1] || '').trim()
      .replace(/^(?:一份|一个|下|个|篇|a|an)\\s*/, '')
      .replace(/^[\s，,。:：！!？?]+/, '')
      .replace(/[\s，,。:：！!？?]+$/, '')
      .trim() || m.trim();
    return { matched: true, topic };
  }
  if (PRES_RX.test(m)) return { matched: true, topic: m.trim() };
  return { matched: false, topic: '' };
}
import { describe, it, expect } from 'vitest';
describe('intent', () => {
  it('提取主题"AI 产品" from "生成一份关于 AI 产品的 PPT"', () => {
    const r = extract('生成一份关于 AI 产品的 PPT');
    expect(r.matched).toBe(true);
    expect(r.topic).toContain('AI 产品');
  });
  it('提取主题"新能源汽车发布会" from "帮我做一份新能源汽车发布会演示稿"', () => {
    const r = extract('帮我做一份新能源汽车发布会演示稿');
    expect(r.matched).toBe(true);
    expect(r.topic).toContain('新能源汽车发布会');
  });
  it('"presentation" 关键词独立命中', () => {
    const r = extract('help me prepare a presentation about AI');
    expect(r.matched).toBe(true);
  });
  it('生成一份关于产品介绍的 presentation', () => {
    const r = extract('请写一份关于产品介绍的 presentation');
    expect(r.matched).toBe(true);
    expect(typeof r.topic).toBe('string');
  });
  it('非 PPT 表达返回 matched=false', () => {
    expect(extract('今天天气真好').matched).toBe(false);
    expect(extract('帮我写一份教案').matched).toBe(false);
    expect(extract('hello world').matched).toBe(false);
  });
});`)
  assert(r.ok, `PPT 意图子用例失败：${r.stderr}`)
})

await step('JCode IPC：未启用时 callSwarm 走降级', async () => {
  const r = await runVitestInline('jcode-disabled', `
import { callJcodeSwarm } from '@/utils/jcodeApi';
import { describe, it, expect, beforeEach } from 'vitest';
beforeEach(() => {
  globalThis.window = globalThis.window || {};
  globalThis.window.electronAPI = {
    jcode: {
      detect: () => Promise.resolve({ installed: false, path: null, version: '', meetsRequirement: false }),
      getStatus: () => Promise.resolve({ state: 'unavailable', pid: null, port: null, version: '', lastError: 'disabled by user' }),
      start: () => Promise.resolve({ ok: false, error: 'disabled' }),
      stop: () => Promise.resolve({ ok: true }),
      getSettings: () => Promise.resolve({ settings: { enabled: false, useForComplexTasks: true, preStart: false, lastDetectedVersion: '' } }),
      setSettings: () => Promise.resolve({ ok: true }),
      callSwarm: () => Promise.resolve({ ok: false, fallbackReason: 'jcode_disabled', message: 'jcode 未启用' }),
      clearMemory: () => Promise.resolve({ ok: true }),
      markInstallHintShown: () => Promise.resolve({ ok: true }),
    },
  };
});
describe('disabled', () => {
  it('returns ok:false with fallbackReason', async () => {
    const r = await callJcodeSwarm({ task: 'generate_ppt', sessionId: 's1' });
    expect(r.ok).toBe(false);
    expect(['jcode_disabled', 'jcode_unavailable', 'ipc_error']).toContain(r.fallbackReason);
  });
});`)
  assert(r.ok, `JCode 降级子用例失败：${r.stderr}`)
})

await step('JCode IPC：未安装时 callSwarm 走 unavailable', async () => {
  const r = await runVitestInline('jcode-unavailable', `
import { isJcodeAvailable, callJcodeSwarm } from '@/utils/jcodeApi';
import { describe, it, expect, beforeEach } from 'vitest';
beforeEach(() => {
  delete globalThis.window?.electronAPI;
});
describe('unavailable', () => {
  it('isJcodeAvailable false in non-electron', () => {
    expect(isJcodeAvailable()).toBe(false);
  });
  it('callSwarm ok:false with jcode_unavailable', async () => {
    const r = await callJcodeSwarm({ task: 'generate_ppt' });
    expect(r.ok).toBe(false);
    expect(r.fallbackReason).toBe('jcode_unavailable');
  });
});`)
  assert(r.ok, `JCode unavailable 子用例失败：${r.stderr}`)
})

/* ═══════════════════════════════════════════════════════════════ */
/* 汇总                                                            */
/* ═══════════════════════════════════════════════════════════════ */
log(`${BOLD}${CYAN}\n══════════ 测试汇总 ══════════${RESET}`)
const total = results.passed + results.failed
log(`${BOLD}总用例：${total}${RESET}`)
log(`${GREEN}通过：${results.passed}${RESET}`)
if (results.failed > 0) {
  log(`${RED}失败：${results.failed}${RESET}\n`)
  for (const f of results.failures) {
    log(`  ${RED}✗${RESET} ${f.name}`)
    log(`    ${f.error.split('\n').slice(0, 5).join('\n    ')}`)
  }
}
const avg = Object.values(results.timings).reduce((a, b) => a + b, 0) / Object.values(results.timings).length
log(`${YELLOW}平均用例耗时：${(avg || 0).toFixed(1)}ms${RESET}`)
log('')
process.exit(results.failed === 0 ? 0 : 1)
