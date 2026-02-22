import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getAppSetting, setAppSetting } from '../db/helpers'

const settings = new Hono()

const WORKSPACE_PATH_KEY = 'workspace:defaultPath'

// GET /api/settings/workspace-path
settings.get('/workspace-path', async (c) => {
  const value = await getAppSetting(WORKSPACE_PATH_KEY)
  return c.json({ success: true, data: { path: value ?? '/' } })
})

// PATCH /api/settings/workspace-path
settings.patch(
  '/workspace-path',
  zValidator('json', z.object({ path: z.string().min(1).max(1024) })),
  async (c) => {
    const { path } = c.req.valid('json')
    const resolved = resolve(path)

    // Validate the path exists and is a directory
    try {
      const s = await stat(resolved)
      if (!s.isDirectory()) {
        return c.json({ success: false, error: 'Path is not a directory' }, 400)
      }
    } catch {
      return c.json({ success: false, error: 'Path does not exist' }, 400)
    }

    await setAppSetting(WORKSPACE_PATH_KEY, resolved)
    return c.json({ success: true, data: { path: resolved } })
  },
)

export default settings
