import type { CommandCategory, LogEntryType, NormalizedLogEntry } from './types'

// Classify shell commands by category
export function classifyCommand(command: string): CommandCategory {
  const cmd = command.trim().split(/\s+/)[0] ?? ''
  if (['cat', 'head', 'tail', 'ls', 'less', 'more'].includes(cmd)) return 'read'
  if (['grep', 'rg', 'find', 'awk', 'ag'].includes(cmd)) return 'search'
  if (command.includes('>') || ['sed', 'rm', 'mv', 'cp', 'mkdir', 'touch'].includes(cmd))
    return 'edit'
  if (['curl', 'wget'].includes(cmd)) return 'fetch'
  return 'other'
}

// Async generator: normalize a ReadableStream into NormalizedLogEntry stream
export async function* normalizeStream(
  stream: ReadableStream<Uint8Array>,
  parser: (line: string) => NormalizedLogEntry | null,
): AsyncGenerator<NormalizedLogEntry> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        const entry = parser(line)
        if (entry) yield entry
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const entry = parser(buffer)
      if (entry) yield entry
    }
  } finally {
    reader.releaseLock()
  }
}
// Create a NormalizedLogEntry helper
export function createLogEntry(
  entryType: LogEntryType,
  content: string,
  metadata?: Record<string, unknown>,
): NormalizedLogEntry {
  return {
    entryType,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  }
}
