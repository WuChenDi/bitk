import type {
  EngineAvailability,
  EngineCapability,
  EngineExecutor,
  EngineModel,
  ExecutionEnv,
  FollowUpOptions,
  NormalizedLogEntry,
  SpawnedProcess,
  SpawnOptions,
} from '../types'
import { logger } from '../../logger'
import { safeEnv } from '../safe-env'

const CODEX_CMD = ['npx', '-y', '@openai/codex@latest']
const JSONRPC_TIMEOUT = 15000

/**
 * Lightweight JSON-RPC session over a stdio process.
 * Shares a single ReadableStream reader and buffer across calls
 * so no data is lost between sequential requests.
 */
class JsonRpcSession {
  private reader: ReadableStreamDefaultReader<Uint8Array>
  private decoder = new TextDecoder()
  private buffer = ''
  private done = false

  constructor(private proc: ReturnType<typeof Bun.spawn>) {
    this.reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
  }

  async call(method: string, params: Record<string, unknown>, id: number): Promise<unknown> {
    const request = JSON.stringify({ method, id, params })
    logger.debug({ method, id, request }, 'codex_rpc_send')
    this.proc.stdin.write(`${request}\n`)

    const deadline = Date.now() + JSONRPC_TIMEOUT

    while (!this.done && Date.now() < deadline) {
      // First, drain any complete lines already in the buffer
      const parsed = this.parseLine(id)
      if (parsed !== undefined) {
        logger.debug({ method, id, result: JSON.stringify(parsed).slice(0, 500) }, 'codex_rpc_recv')
        return parsed
      }

      // Read more data from the stream
      const { value, done } = await this.reader.read()
      if (done) {
        logger.debug(
          {
            method,
            id,
            remainingBuffer: this.buffer.slice(0, 500),
          },
          'codex_rpc_stream_end',
        )
        this.done = true
        break
      }
      const chunk = this.decoder.decode(value, { stream: true })
      logger.debug(
        {
          method,
          id,
          chunkLen: chunk.length,
          chunk: chunk.slice(0, 500),
        },
        'codex_rpc_chunk',
      )
      this.buffer += chunk
    }

    // Final attempt to parse remaining buffer
    const parsed = this.parseLine(id)
    if (parsed !== undefined) {
      logger.debug(
        {
          method,
          id,
          result: JSON.stringify(parsed).slice(0, 500),
        },
        'codex_rpc_recv_final',
      )
      return parsed
    }

    logger.error(
      {
        method,
        id,
        bufferLen: this.buffer.length,
        buffer: this.buffer.slice(0, 1000),
        streamDone: this.done,
      },
      'codex_rpc_timeout',
    )
    throw new Error(`JSON-RPC timeout waiting for response id=${id}`)
  }

  /** Send a JSON-RPC notification (no id, no response expected). */
  notify(method: string, params: Record<string, unknown>): void {
    const msg = JSON.stringify({ method, params })
    logger.debug({ method }, 'codex_rpc_notify')
    this.proc.stdin.write(`${msg}\n`)
  }

  /** Try to extract and return the response matching `id` from buffered lines. */
  private parseLine(id: number): unknown | undefined {
    for (
      let newlineIdx = this.buffer.indexOf('\n');
      newlineIdx !== -1;
      newlineIdx = this.buffer.indexOf('\n')
    ) {
      const line = this.buffer.slice(0, newlineIdx).trim()
      this.buffer = this.buffer.slice(newlineIdx + 1)
      if (!line) continue
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(line)
      } catch {
        logger.debug({ line: line.slice(0, 200) }, 'codex_rpc_non_json')
        continue
      }
      logger.debug(
        {
          waitingForId: id,
          msgId: msg.id,
          msgKeys: Object.keys(msg),
          line: line.slice(0, 300),
        },
        'codex_rpc_line',
      )
      if (msg.id === id) {
        if (msg.error) {
          const err = msg.error as { message?: string }
          logger.error({ method: `id=${id}`, error: err.message }, 'codex_rpc_error')
          throw new Error(err.message ?? 'JSON-RPC error')
        }
        return msg.result
      }
    }
    return undefined
  }

  destroy(): void {
    this.reader.releaseLock()
  }
}

/**
 * Codex app-server model/list response shape.
 * @see https://github.com/openai/codex/tree/main/codex-rs/app-server
 */
interface CodexModelListResponse {
  data: Array<{
    id: string
    model: string
    displayName: string
    description?: string
    isDefault?: boolean
  }>
  nextCursor?: string | null
}

/**
 * Start a short-lived Codex app-server, perform the initialize handshake,
 * then paginate through model/list. Returns flattened EngineModel[].
 *
 * Protocol: JSON-RPC lite over stdio (JSONL, no "jsonrpc":"2.0" header).
 * Lifecycle: initialize → initialized notification → model/list (paginated) → kill.
 */
async function queryCodexModels(): Promise<EngineModel[]> {
  logger.debug({ cmd: [...CODEX_CMD, 'app-server'].join(' ') }, 'codex_models_start')

  const proc = Bun.spawn([...CODEX_CMD, 'app-server'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: safeEnv({ NPM_CONFIG_LOGLEVEL: 'error' }),
  })

  // Capture stderr for diagnostics
  const stderrReader = new Response(proc.stderr).text()

  const killTimer = setTimeout(() => {
    logger.warn({ message: 'Killing codex app-server after timeout' }, 'codex_models_kill_timeout')
    proc.kill()
  }, JSONRPC_TIMEOUT + 5000)
  const session = new JsonRpcSession(proc)

  try {
    // 1. Initialize handshake
    logger.debug({ message: 'Sending initialize...' }, 'codex_models_init')
    const initResult = await session.call(
      'initialize',
      { clientInfo: { name: 'bitk', title: 'BitK', version: '0.1.0' } },
      0,
    )
    logger.debug({ result: JSON.stringify(initResult).slice(0, 500) }, 'codex_models_init_done')

    // 2. Send initialized notification (required before other methods)
    session.notify('initialized', {})

    // 3. Paginate through model/list
    const models: EngineModel[] = []
    let cursor: string | null | undefined = null
    let reqId = 1

    do {
      const params: Record<string, unknown> = {}
      if (cursor) params.cursor = cursor

      logger.debug({ cursor, reqId }, 'codex_models_list')
      const result = (await session.call('model/list', params, reqId++)) as CodexModelListResponse
      logger.debug({ rawResult: JSON.stringify(result).slice(0, 1000) }, 'codex_models_list_done')

      if (result?.data) {
        for (const m of result.data) {
          models.push({
            id: m.id,
            name: m.displayName ?? m.model ?? m.id,
            isDefault: m.isDefault,
          })
        }
      }

      cursor = result?.nextCursor
    } while (cursor)

    logger.debug({ count: models.length, models: models.map((m) => m.id) }, 'codex_models_done')
    return models
  } catch (error) {
    const stderr = await stderrReader.catch(() => '')
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stderr: typeof stderr === 'string' ? stderr.slice(0, 1000) : '',
      },
      'codex_models_error',
    )
    throw error
  } finally {
    session.destroy()
    clearTimeout(killTimer)
    proc.kill()
  }
}

/**
 * Codex executor — uses JSON-RPC protocol via `app-server` mode.
 *
 * Launch: `codex app-server`
 * Communication: JSON-RPC over stdio (JSONL)
 *
 * TODO: Implement spawn/follow-up with app-server mode.
 */
export class CodexExecutor implements EngineExecutor {
  readonly engineType = 'codex' as const
  readonly protocol = 'json-rpc' as const
  readonly capabilities: EngineCapability[] = [
    'session-fork',
    'setup-helper',
    'context-usage',
    'sandbox',
    'reasoning',
  ]

  async spawn(_options: SpawnOptions, _env: ExecutionEnv): Promise<SpawnedProcess> {
    // TODO: Implement Codex app-server spawn
    // 1. Start `npx -y @openai/codex@latest app-server --port <port>`
    // 2. Wait for server ready signal
    // 3. Send initial prompt via JSON-RPC
    throw new Error('Codex executor not yet implemented')
  }

  async spawnFollowUp(_options: FollowUpOptions, _env: ExecutionEnv): Promise<SpawnedProcess> {
    // TODO: Implement follow-up via JSON-RPC session continuation
    throw new Error('Codex follow-up not yet implemented')
  }

  async cancel(spawnedProcess: SpawnedProcess): Promise<void> {
    spawnedProcess.cancel()
    const timeout = setTimeout(() => {
      try {
        spawnedProcess.subprocess.kill(9)
      } catch {
        /* already dead */
      }
    }, 5000)

    try {
      await spawnedProcess.subprocess.exited
    } finally {
      clearTimeout(timeout)
    }
  }

  async getAvailability(): Promise<EngineAvailability> {
    try {
      const proc = Bun.spawn([...CODEX_CMD, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const timer = setTimeout(() => proc.kill(), 10000)
      const exitCode = await proc.exited
      clearTimeout(timer)

      if (exitCode !== 0) {
        return { engineType: 'codex', installed: false, authStatus: 'unknown' }
      }

      const stdout = await new Response(proc.stdout).text()
      const versionMatch = stdout.match(/(\d+\.\d+\.\d[\w.-]*)/)
      const version = versionMatch?.[1]

      // Check auth — OPENAI_API_KEY, CODEX_API_KEY, or ~/.codex/config.toml
      let authStatus: EngineAvailability['authStatus'] = 'unknown'
      if (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY) {
        authStatus = 'authenticated'
      } else {
        const home = process.env.HOME ?? '/root'
        const configFile = Bun.file(`${home}/.codex/config.toml`)
        if (await configFile.exists()) {
          authStatus = 'authenticated'
        } else {
          authStatus = 'unauthenticated'
        }
      }

      return {
        engineType: 'codex',
        installed: true,
        executable: false, // spawn not yet implemented
        version,
        authStatus,
      }
    } catch (error) {
      return {
        engineType: 'codex',
        installed: false,
        executable: false,
        authStatus: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getModels(): Promise<EngineModel[]> {
    try {
      return await queryCodexModels()
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'codex_get_models_failed',
      )
      return []
    }
  }

  normalizeLog(rawLine: string): NormalizedLogEntry | null {
    // TODO: Implement JSON-RPC log normalization for Codex
    // Codex uses JSON-RPC messages, need to parse and normalize
    try {
      const data = JSON.parse(rawLine)

      // JSON-RPC response
      if (data.jsonrpc === '2.0') {
        if (data.error) {
          return {
            entryType: 'error-message',
            content: data.error.message ?? 'Unknown JSON-RPC error',
            timestamp: new Date().toISOString(),
            metadata: { code: data.error.code },
          }
        }
        if (data.result) {
          return {
            entryType: 'assistant-message',
            content: typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
            timestamp: new Date().toISOString(),
            metadata: { id: data.id },
          }
        }
      }

      return null
    } catch {
      if (rawLine.trim()) {
        return {
          entryType: 'system-message',
          content: rawLine,
        }
      }
      return null
    }
  }
}
