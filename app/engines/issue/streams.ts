import type { NormalizedLogEntry } from '../types'
import type { ManagedProcess } from './types'
import { setAppSetting } from '../../db/helpers'
import { normalizeStream } from '../logs'
import { MAX_LOG_ENTRIES } from './types'

const SLASH_COMMANDS_KEY = 'engine:slashCommands'

async function saveSlashCommandsToSettings(commands: string[]): Promise<void> {
  if (commands.length === 0) return
  await setAppSetting(SLASH_COMMANDS_KEY, JSON.stringify(commands))
}

export interface StreamCallbacks {
  getManaged: () => ManagedProcess | undefined
  getTurnIndex: () => number
  onEntry: (entry: NormalizedLogEntry) => void
  onTurnCompleted: () => void
  onStreamError: (error: unknown) => void
}

// ---------- Pure classification functions ----------

export function isTurnCompletionEntry(entry: NormalizedLogEntry): boolean {
  if (entry.metadata?.turnCompleted === true) return true
  if (entry.metadata && Object.prototype.hasOwnProperty.call(entry.metadata, 'resultSubtype')) {
    return true
  }
  return (
    entry.entryType === 'system-message' &&
    !!entry.metadata &&
    Object.prototype.hasOwnProperty.call(entry.metadata, 'duration')
  )
}

export function isCancelledNoiseEntry(entry: NormalizedLogEntry): boolean {
  const subtype = entry.metadata?.resultSubtype
  if (typeof subtype !== 'string' || subtype !== 'error_during_execution') return false
  const raw = `${entry.content ?? ''} ${String(entry.metadata?.error ?? '')}`.toLowerCase()
  return (
    raw.includes('request was aborted') ||
    raw.includes('request interrupted by user') ||
    raw.includes('rust analyzer lsp crashed') ||
    raw.includes('rust-analyzer-lsp')
  )
}

// ---------- Helpers ----------

function pushStderrEntry(
  managed: ManagedProcess,
  content: string,
  turnIndex: number,
  onEntry: (entry: NormalizedLogEntry) => void,
): void {
  const entry: NormalizedLogEntry = {
    entryType: 'error-message',
    content,
    turnIndex,
    timestamp: new Date().toISOString(),
  }
  if (managed.logs.length < MAX_LOG_ENTRIES) {
    managed.logs.push(entry)
  }
  onEntry(entry)
}

// ---------- Stream consumers ----------

export async function consumeStream(
  executionId: string,
  issueId: string,
  stream: ReadableStream<Uint8Array>,
  parser: (line: string) => NormalizedLogEntry | NormalizedLogEntry[] | null,
  callbacks: StreamCallbacks,
): Promise<void> {
  try {
    for await (const rawEntry of normalizeStream(stream, parser)) {
      const managed = callbacks.getManaged()
      if (!managed) break
      const turnIdx = callbacks.getTurnIndex()

      const entry: NormalizedLogEntry = {
        ...rawEntry,
        turnIndex: turnIdx,
        timestamp: rawEntry.timestamp ?? new Date().toISOString(),
      }

      // Extract slash commands from SDK init message
      if (
        entry.entryType === 'system-message' &&
        entry.metadata?.subtype === 'init' &&
        Array.isArray(entry.metadata.slashCommands)
      ) {
        managed.slashCommands = entry.metadata.slashCommands as string[]
        void saveSlashCommandsToSettings(managed.slashCommands)
      }

      // Tag all entries in a meta turn so they are hidden from the frontend
      if (managed.metaTurn) {
        entry.metadata = { ...entry.metadata, type: 'system' }
      }

      // Claude may emit execution noise after interrupt (e.g. request aborted /
      // rust-analyzer crash). If this turn was user-cancelled, suppress it.
      if (managed.cancelledByUser && isCancelledNoiseEntry(entry)) {
        if (isTurnCompletionEntry(entry)) {
          callbacks.onTurnCompleted()
        }
        continue
      }

      callbacks.onEntry(entry)

      if (isTurnCompletionEntry(entry)) {
        callbacks.onTurnCompleted()
      }
    }
  } catch (error) {
    callbacks.onStreamError(error)
  }
}

export async function consumeStderr(
  executionId: string,
  issueId: string,
  stream: ReadableStream<Uint8Array>,
  callbacks: Pick<StreamCallbacks, 'getManaged' | 'getTurnIndex' | 'onEntry'>,
): Promise<void> {
  try {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const managed = callbacks.getManaged()
        if (!managed) {
          reader.releaseLock()
          return
        }
        pushStderrEntry(managed, line, callbacks.getTurnIndex(), callbacks.onEntry)
      }
    }

    if (buffer.trim()) {
      const managed = callbacks.getManaged()
      if (managed) {
        pushStderrEntry(managed, buffer, callbacks.getTurnIndex(), callbacks.onEntry)
      }
    }
  } catch {
    // Stderr stream closed or error — ignore
  }
}
