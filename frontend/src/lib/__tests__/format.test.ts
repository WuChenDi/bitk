import { describe, expect, it } from 'vitest'
import { formatModelName, getProjectInitials } from '../format'

describe('formatModelName', () => {
  it('formats Claude model IDs', () => {
    expect(formatModelName('claude-opus-4-6')).toBe('Claude Opus 4.6')
    expect(formatModelName('claude-sonnet-4-6')).toBe('Claude Sonnet 4.6')
    expect(formatModelName('claude-haiku-4-5')).toBe('Claude Haiku 4.5')
  })

  it('returns unknown IDs as-is', () => {
    expect(formatModelName('gpt-4o')).toBe('gpt-4o')
    expect(formatModelName('auto')).toBe('auto')
  })
})

describe('getProjectInitials', () => {
  it('returns first two letters of initials for multi-word names', () => {
    expect(getProjectInitials('My Project')).toBe('MP')
    expect(getProjectInitials('hello world test')).toBe('HW')
  })

  it('returns first two characters for single-word names', () => {
    expect(getProjectInitials('kanban')).toBe('KA')
    expect(getProjectInitials('A')).toBe('A')
  })

  it('returns ?? for empty string', () => {
    expect(getProjectInitials('')).toBe('??')
    expect(getProjectInitials('   ')).toBe('??')
  })

  it('handles extra whitespace', () => {
    expect(getProjectInitials('  My  Project  ')).toBe('MP')
  })
})
