import { describe, expect, it } from 'vitest'
import { useSkillExecutor } from '@/composables/useSkillExecutor'
import { buildSelectionPrompt } from '@/utils/aiSelection'

describe('skill match for polish instruction', () => {
  const executor = useSkillExecutor()
  const userOnly = '请润色这段话'
  const full = buildSelectionPrompt(userOnly, '这是一段需要润色的文字')

  it('user only message', () => {
    expect(executor.matchSkillByIntent(userOnly)).toBeNull()
  })

  it('selection prompt message', () => {
    const matched = executor.matchSkillByIntent(full)
    // eslint-disable-next-line no-console
    console.log('matched skill:', matched)
    expect(matched).toBeNull()
  })
})
