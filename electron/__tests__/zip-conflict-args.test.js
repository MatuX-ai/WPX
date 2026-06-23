import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { appendExtractConflictArg } = require('../zip-service.js')

describe('appendExtractConflictArg', () => {
  it('覆盖模式应追加 -aoa', () => {
    const args = ['x', 'a.zip', '-oout', '-bsp1']
    appendExtractConflictArg(args, 'overwrite')
    expect(args).toEqual(['x', 'a.zip', '-oout', '-bsp1', '-aoa'])
  })

  it('跳过模式应追加 -aos', () => {
    const args = ['x', 'a.zip', '-oout', '-bsp1']
    appendExtractConflictArg(args, 'skip')
    expect(args).toEqual(['x', 'a.zip', '-oout', '-bsp1', '-aos'])
  })

  it('默认模式应追加 -y', () => {
    const args = ['x', 'a.zip', '-oout', '-bsp1']
    appendExtractConflictArg(args, undefined)
    expect(args).toEqual(['x', 'a.zip', '-oout', '-bsp1', '-y'])
  })
})
