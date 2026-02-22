import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_ID, STATUS_MAP, STATUSES } from '../statuses'

describe('STATUSES', () => {
  it('contains exactly 4 statuses', () => {
    expect(STATUSES).toHaveLength(4)
  })

  it('has correct status IDs in order', () => {
    const ids = STATUSES.map((s) => s.id)
    expect(ids).toEqual(['todo', 'working', 'review', 'done'])
  })

  it('each status has required fields', () => {
    for (const status of STATUSES) {
      expect(status.id).toBeTruthy()
      expect(status.name).toBeTruthy()
      expect(status.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(typeof status.sortOrder).toBe('number')
    }
  })

  it('sortOrder values are sequential starting from 0', () => {
    const orders = STATUSES.map((s) => s.sortOrder)
    expect(orders).toEqual([0, 1, 2, 3])
  })
})

describe('STATUS_MAP', () => {
  it('maps all status IDs', () => {
    expect(STATUS_MAP.size).toBe(4)
    expect(STATUS_MAP.has('todo')).toBe(true)
    expect(STATUS_MAP.has('working')).toBe(true)
    expect(STATUS_MAP.has('review')).toBe(true)
    expect(STATUS_MAP.has('done')).toBe(true)
  })

  it('returns correct definition for each ID', () => {
    const todo = STATUS_MAP.get('todo')
    expect(todo).toBeDefined()
    expect(todo!.name).toBe('Todo')

    const done = STATUS_MAP.get('done')
    expect(done).toBeDefined()
    expect(done!.name).toBe('Done')
  })

  it('returns undefined for unknown IDs', () => {
    expect(STATUS_MAP.get('invalid')).toBeUndefined()
  })
})

describe('DEFAULT_STATUS_ID', () => {
  it('is todo', () => {
    expect(DEFAULT_STATUS_ID).toBe('todo')
  })

  it('exists in STATUS_MAP', () => {
    expect(STATUS_MAP.has(DEFAULT_STATUS_ID)).toBe(true)
  })
})
