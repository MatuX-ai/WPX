/**
 * hermes-env 单元测试（Phase 3 / M3-C）
 *
 * 运行：npm --prefix wpx-app run test:zip -- hermes-env
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { buildEnvFileContent, escapeEnvValue, writeHermesEnvFile, ALLOWED_KEYS } = require('../services/hermes-env.js')

let tmpDir

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'hermes-env-test-'))
})

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true })
})

describe('hermes-env — buildEnvFileContent', () => {
  it('有 Key 时生成 OPENAI_API_KEY 行', () => {
    const { content, keys } = buildEnvFileContent({ apiKey: 'sk-test-123' })
    expect(keys).toEqual(['OPENAI_API_KEY'])
    expect(content).toContain('OPENAI_API_KEY=sk-test-123')
  })

  it('有 baseUrl 时追加 OPENAI_BASE_URL', () => {
    const { content, keys } = buildEnvFileContent({ apiKey: 'k', baseUrl: 'https://api.deepseek.com/v1' })
    expect(keys).toEqual(['OPENAI_API_KEY', 'OPENAI_BASE_URL'])
    expect(content).toContain('OPENAI_BASE_URL=https://api.deepseek.com/v1')
  })

  it('无 Key 时为空内容', () => {
    const { content, keys } = buildEnvFileContent({})
    expect(content).toBe('')
    expect(keys).toHaveLength(0)
  })

  it('换行/井号被转义（防 .env 注入）', () => {
    const { content } = buildEnvFileContent({ apiKey: 'a\nb#c' })
    // 值内换行被替换为空格（尾部换行是正常的行结束符）
    expect(content.trim()).not.toContain('\n')
    expect(content).toContain('\\#')
    expect(content).toContain('OPENAI_API_KEY=a b\\#c')
  })

  it('白名单仅 OPENAI_*', () => {
    expect(ALLOWED_KEYS).toEqual(['OPENAI_API_KEY', 'OPENAI_BASE_URL'])
  })

  it('escapeEnvValue 去除换行', () => {
    expect(escapeEnvValue('x\r\ny')).toBe('x y')
  })
})

describe('hermes-env — writeHermesEnvFile', () => {
  it('原子写入 .env 且内容正确', async () => {
    const home = path.join(tmpDir, 'home')
    const result = await writeHermesEnvFile(home, { apiKey: 'sk-abc', baseUrl: 'https://x.example/v1' })
    expect(result.ok).toBe(true)
    expect(result.keys).toEqual(['OPENAI_API_KEY', 'OPENAI_BASE_URL'])

    const content = await fsp.readFile(path.join(home, '.env'), 'utf8')
    expect(content).toContain('OPENAI_API_KEY=sk-abc')
    expect(content).toContain('OPENAI_BASE_URL=https://x.example/v1')
    // 无残留 tmp 文件
    const entries = await fsp.readdir(home)
    expect(entries).toEqual(['.env'])
  })

  it('无 Key 时写入空文件（清掉旧 Key）', async () => {
    const home = path.join(tmpDir, 'home')
    await writeHermesEnvFile(home, { apiKey: 'old-key' })
    const result = await writeHermesEnvFile(home, {})
    expect(result.ok).toBe(true)
    expect(result.keys).toHaveLength(0)
    const content = await fsp.readFile(path.join(home, '.env'), 'utf8')
    expect(content).toBe('')
  })

  it('返回结果不回显 Key 内容', async () => {
    const home = path.join(tmpDir, 'home')
    const result = await writeHermesEnvFile(home, { apiKey: 'sk-secret-42' })
    expect(JSON.stringify(result)).not.toContain('sk-secret-42')
  })
})
