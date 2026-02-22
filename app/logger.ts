import type { MiddlewareHandler } from 'hono'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import pino from 'pino'

const level = process.env.LOG_LEVEL ?? 'info'
const name = process.env.SERVICE_NAME ?? 'bitk'

// In compiled binary import.meta.dir points to read-only /$bunfs — use cwd instead
const baseDir = import.meta.dir.startsWith('/$bunfs')
  ? process.cwd()
  : resolve(import.meta.dir, '..')
const logDir = join(baseDir, 'data', 'logs')
mkdirSync(logDir, { recursive: true })

const logFile = join(logDir, `${name}.log`)

export const logger = pino(
  { level, base: undefined },
  pino.multistream([{ stream: process.stdout }, { stream: pino.destination(logFile) }]),
)

export function httpLogger(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    if (c.req.path === '/api/health' || c.req.path === '/api/events') return
    logger.info(`${c.req.method} ${c.req.path} ${c.res.status}`)
  }
}
