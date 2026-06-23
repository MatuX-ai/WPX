/**
 * WPX 压缩/解压缩集成测试（Vitest + 内置 7za）
 *
 * 运行前请将 7za 放入 resources/bin/7za.exe（Windows）。
 * 无 7za 时整套测试自动 skip。
 *
 * 运行：npm --prefix wpx-app run test:zip
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createTempWorkDir,
  hasBundled7za,
  listDirectoryEntries,
  readTextFile,
  testArchiveIntegrity,
  writeBinaryFile,
  writeTextFile,
} from '../test/helpers.js'

const require = createRequire(import.meta.url)
const {
  CancelledError,
  SevenZipCommandError,
  compress,
  extract,
  list,
} = require('../zip-service.js')

const describeWith7za = hasBundled7za() ? describe : describe.skip

describeWith7za('zip-service 集成测试', () => {
  /** @type {string} */
  let workDir

  beforeAll(async () => {
    workDir = await createTempWorkDir('wpx-zip-integration')
  })

  afterEach(async () => {
    if (!workDir) return

    const entries = await fsp.readdir(workDir)
    await Promise.all(
      entries.map((entry) => fsp.rm(path.join(workDir, entry), { recursive: true, force: true })),
    )
  })

  it('1. 压缩单文件为 .7z，验证文件生成且可被 7-Zip 校验', async () => {
    const sourceFile = path.join(workDir, 'single.txt')
    const archivePath = path.join(workDir, 'single.7z')
    const content = 'hello single file archive'

    await writeTextFile(sourceFile, content)

    const { promise } = compress([sourceFile], archivePath, { format: '7z', level: 5 })
    const result = await promise

    expect(result.outputPath).toBe(archivePath)
    expect(fs.existsSync(archivePath)).toBe(true)
    expect(fs.statSync(archivePath).size).toBeGreaterThan(0)

    await testArchiveIntegrity(archivePath)

    const entries = await list(archivePath)
    expect(entries.some((entry) => entry.name.includes('single.txt'))).toBe(true)
  })

  it('2. 压缩文件夹为 .zip，验证文件结构完整', async () => {
    const folderPath = path.join(workDir, 'sample-folder')
    const nestedDir = path.join(folderPath, 'nested')
    const archivePath = path.join(workDir, 'folder.zip')

    await writeTextFile(path.join(folderPath, 'root.txt'), 'root content')
    await writeTextFile(path.join(nestedDir, 'inner.txt'), 'inner content')

    const { promise } = compress([folderPath], archivePath, { format: 'zip', level: 5 })
    await promise

    expect(fs.existsSync(archivePath)).toBe(true)

    const listed = await list(archivePath)
    const names = listed.map((entry) => entry.name.replace(/\\/g, '/'))
    expect(names.some((name) => name.endsWith('root.txt'))).toBe(true)
    expect(names.some((name) => name.endsWith('inner.txt'))).toBe(true)

    const extractDir = path.join(workDir, 'folder-extract')
    await extract(archivePath, extractDir).promise

    expect(await readTextFile(path.join(extractDir, 'sample-folder', 'root.txt'))).toBe(
      'root content',
    )
    expect(await readTextFile(path.join(extractDir, 'sample-folder', 'nested', 'inner.txt'))).toBe(
      'inner content',
    )
  })

  it('3. 加密压缩 + 正确密码解压，验证内容一致', async () => {
    const sourceFile = path.join(workDir, 'secret.txt')
    const archivePath = path.join(workDir, 'encrypted.7z')
    const extractDir = path.join(workDir, 'encrypted-out')
    const password = 'wpx-test-password'
    const content = 'encrypted payload 12345'

    await writeTextFile(sourceFile, content)

    await compress([sourceFile], archivePath, { format: '7z', level: 5, password }).promise
    await extract(archivePath, extractDir, { password }).promise

    const extractedPath = path.join(extractDir, 'secret.txt')
    expect(await readTextFile(extractedPath)).toBe(content)
  })

  it('4. 加密压缩 + 错误密码，验证提示错误', async () => {
    const sourceFile = path.join(workDir, 'locked.txt')
    const archivePath = path.join(workDir, 'locked.7z')
    const extractDir = path.join(workDir, 'locked-out')
    const password = 'correct-password'

    await writeTextFile(sourceFile, 'locked content')
    await compress([sourceFile], archivePath, { format: '7z', level: 5, password }).promise

    await expect(
      extract(archivePath, extractDir, { password: 'wrong-password' }).promise,
    ).rejects.toBeInstanceOf(SevenZipCommandError)
  })

  it('5. 解压时文件名冲突，选择覆盖，验证文件被替换', async () => {
    const sourceFile = path.join(workDir, 'conflict.txt')
    const archivePath = path.join(workDir, 'conflict-overwrite.zip')
    const extractDir = path.join(workDir, 'conflict-overwrite-out')
    const targetFile = path.join(extractDir, 'conflict.txt')

    await writeTextFile(sourceFile, 'from archive')
    await compress([sourceFile], archivePath, { format: 'zip', level: 5 }).promise

    await fsp.mkdir(extractDir, { recursive: true })
    await writeTextFile(targetFile, 'keep old')

    await extract(archivePath, extractDir, { conflictMode: 'overwrite' }).promise

    expect(await readTextFile(targetFile)).toBe('from archive')
  })

  it('6. 解压时文件名冲突，选择跳过，验证原文件保留', async () => {
    const sourceFile = path.join(workDir, 'conflict-skip.txt')
    const archivePath = path.join(workDir, 'conflict-skip.zip')
    const extractDir = path.join(workDir, 'conflict-skip-out')
    const targetFile = path.join(extractDir, 'conflict-skip.txt')

    await writeTextFile(sourceFile, 'from archive')
    await compress([sourceFile], archivePath, { format: 'zip', level: 5 }).promise

    await fsp.mkdir(extractDir, { recursive: true })
    await writeTextFile(targetFile, 'keep original')

    await extract(archivePath, extractDir, { conflictMode: 'skip' }).promise

    expect(await readTextFile(targetFile)).toBe('keep original')
  })

  it('7. 大文件压缩（>100MB），验证进度条回调更新', async () => {
    const largeFile = path.join(workDir, 'large.bin')
    const archivePath = path.join(workDir, 'large.7z')
    const largeSize = 101 * 1024 * 1024

    await writeBinaryFile(largeFile, largeSize)

    /** @type {number[]} */
    const progressValues = []

    const { promise } = compress([largeFile], archivePath, {
      format: '7z',
      level: 1,
      onProgress: (percent) => {
        progressValues.push(percent)
      },
    })

    await promise

    expect(fs.existsSync(archivePath)).toBe(true)
    expect(progressValues.length).toBeGreaterThan(1)
    expect(progressValues.at(-1)).toBe(100)
    expect(new Set(progressValues).size).toBeGreaterThan(1)
  })

  it('8. 压缩过程中取消，验证操作终止且无残留文件', async () => {
    const largeFile = path.join(workDir, 'cancel-large.bin')
    const archivePath = path.join(workDir, 'cancel-large.7z')
    const cancelSize = 64 * 1024 * 1024

    await writeBinaryFile(largeFile, cancelSize)

    const { promise, cancel } = compress([largeFile], archivePath, {
      format: '7z',
      level: 1,
    })

    await new Promise((resolve) => setTimeout(resolve, 80))
    cancel()

    await expect(promise).rejects.toBeInstanceOf(CancelledError)
    expect(fs.existsSync(archivePath)).toBe(false)
  })

  it('9. 压缩包 list 接口返回完整文件列表（预览窗口数据源）', async () => {
    const folderPath = path.join(workDir, 'preview-folder')
    const archivePath = path.join(workDir, 'preview.zip')

    await writeTextFile(path.join(folderPath, 'alpha.txt'), 'alpha')
    await writeTextFile(path.join(folderPath, 'beta.txt'), 'beta')
    await writeTextFile(path.join(folderPath, 'nested', 'gamma.txt'), 'gamma')

    await compress([folderPath], archivePath, { format: 'zip', level: 5 }).promise

    const entries = await list(archivePath)
    const fileNames = entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.name.replace(/\\/g, '/'))

    expect(fileNames.some((name) => name.endsWith('alpha.txt'))).toBe(true)
    expect(fileNames.some((name) => name.endsWith('beta.txt'))).toBe(true)
    expect(fileNames.some((name) => name.endsWith('gamma.txt'))).toBe(true)
    expect(entries.every((entry) => typeof entry.size === 'number')).toBe(true)
  })

  it('10. 选择性解压，验证仅解压勾选文件', async () => {
    const folderPath = path.join(workDir, 'selective')
    const archivePath = path.join(workDir, 'selective.zip')
    const extractDir = path.join(workDir, 'selective-out')

    await writeTextFile(path.join(folderPath, 'keep-me.txt'), 'keep')
    await writeTextFile(path.join(folderPath, 'skip-me.txt'), 'skip')

    await compress([folderPath], archivePath, { format: 'zip', level: 5 }).promise

    const listed = await list(archivePath)
    const keepEntry = listed.find((entry) => entry.name.replace(/\\/g, '/').endsWith('keep-me.txt'))
    expect(keepEntry).toBeTruthy()

    await extract(archivePath, extractDir, { files: [keepEntry.name] }).promise

    const extractedEntries = await listDirectoryEntries(extractDir)
    expect(extractedEntries.some((name) => name.endsWith('keep-me.txt'))).toBe(true)
    expect(extractedEntries.some((name) => name.endsWith('skip-me.txt'))).toBe(false)
  })
})
