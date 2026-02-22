import { useRef, useState, useCallback, useMemo } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EngineIcon } from '@/components/EngineIcons'
import { formatModelName } from '@/lib/format'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useChangesSummary } from '@/hooks/use-changes-summary'
import { useEngineAvailability, useFollowUpIssue } from '@/hooks/use-kanban'
import type { BusyAction, EngineModel, SessionStatus } from '@/types/kanban'

const MODE_OPTIONS = ['auto', 'ask'] as const
type ModeOption = (typeof MODE_OPTIONS)[number]

function normalizePrompt(input: string): string {
  return input.replace(/^(?:\\n|\s)+/g, '').replace(/(?:\\n|\s)+$/g, '')
}

function toPermissionMode(mode: ModeOption): 'auto' | 'supervised' {
  if (mode === 'ask') return 'supervised'
  return mode
}

export function ChatInput({
  projectId,
  issueId,
  diffOpen,
  onToggleDiff,
  scrollRef,
  engineType,
  model,
  sessionStatus,
  statusId,
  isThinking = false,
  onSendStart,
  onSendError,
}: {
  projectId?: string
  issueId?: string
  diffOpen?: boolean
  onToggleDiff?: () => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
  engineType?: string
  model?: string
  sessionStatus?: SessionStatus | null
  statusId?: string
  isThinking?: boolean
  onSendStart?: (prompt: string) => void
  onSendError?: () => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSendingRef = useRef(false)

  const followUp = useFollowUpIssue(projectId ?? '')
  const changesSummary = useChangesSummary(issueId ?? undefined)
  const changedCount = changesSummary?.fileCount ?? 0
  const additions = changesSummary?.additions ?? 0
  const deletions = changesSummary?.deletions ?? 0

  // Fetch models for current engine
  const { data: discovery } = useEngineAvailability(!!engineType)
  const models = useMemo(
    () => (engineType ? (discovery?.models[engineType] ?? []) : []),
    [engineType, discovery],
  )
  const [selectedModel, setSelectedModel] = useState('')
  const [mode, setMode] = useState<ModeOption>('auto')
  const [busyAction, setBusyAction] = useState<BusyAction>('queue')
  const activeModel = selectedModel || model || ''
  const isSessionActive =
    sessionStatus === 'running' || sessionStatus === 'pending'
  const effectiveBusyAction: BusyAction | undefined = isSessionActive
    ? isThinking
      ? 'queue'
      : busyAction
    : undefined

  const normalizedPrompt = normalizePrompt(input)
  const canSend = normalizedPrompt.length > 0 && !!issueId && !!projectId

  const handleSend = async () => {
    if (!canSend || !issueId || isSendingRef.current) return
    isSendingRef.current = true
    const prompt = normalizedPrompt
    onSendStart?.(prompt)
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setSendError(null)
    try {
      await followUp.mutateAsync({
        issueId,
        prompt,
        model: activeModel || undefined,
        permissionMode: toPermissionMode(mode),
        busyAction: effectiveBusyAction,
      })
    } catch (err) {
      onSendError?.()
      const msg = err instanceof Error ? err.message : String(err)
      setSendError(msg)
      setTimeout(() => setSendError(null), 5000)
    } finally {
      isSendingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    },
    [],
  )

  return (
    <div className="shrink-0 w-full min-w-0 px-4 pb-4">
      <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-border focus-within:shadow-md">
        {/* Status bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30">
          <button
            type="button"
            onClick={onToggleDiff}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all duration-200 ${
              diffOpen
                ? 'bg-primary/[0.08] ring-1 ring-primary/20 text-foreground'
                : 'bg-muted/40 hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{t('chat.filesChanged', { count: changedCount })}</span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                +{additions}
              </span>
              <span className="font-mono tabular-nums text-red-600 dark:text-red-400 font-medium">
                -{deletions}
              </span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            {isSessionActive && !isThinking ? (
              <BusyActionSelect value={busyAction} onChange={setBusyAction} />
            ) : null}
            <ModeSelect value={mode} onChange={setMode} />
            {models.length > 0 ? (
              <ModelSelect
                models={models}
                value={activeModel}
                onChange={setSelectedModel}
              />
            ) : null}
          </div>
        </div>

        {/* Error banner */}
        {sendError ? (
          <div className="mx-3 mt-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {sendError}
          </div>
        ) : null}

        {/* Textarea */}
        <div className="px-3 py-2.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Scroll chat to bottom when keyboard opens on mobile
              setTimeout(() => {
                scrollRef?.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: 'smooth',
                })
              }, 100)
            }}
            placeholder={
              statusId === 'todo'
                ? t('chat.placeholderTodo')
                : t('chat.placeholder')
            }
            rows={1}
            className="w-full bg-transparent text-base md:text-sm resize-none outline-none placeholder:text-muted-foreground/40 min-h-[24px] leading-relaxed"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">
          <div className="flex items-center gap-0.5">
            {engineType ? <EngineInfo engineType={engineType} /> : null}
          </div>

          <button
            type="button"
            disabled={!canSend || followUp.isPending}
            onClick={handleSend}
            className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {followUp.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('session.sending')}
              </span>
            ) : (
              t('chat.send')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function BusyActionSelect({
  value,
  onChange,
}: {
  value: BusyAction
  onChange: (v: BusyAction) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        title={t('chat.busyAction.label')}
      >
        <span className="truncate max-w-[100px]">
          {t(`chat.busyAction.${value}`)}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 min-w-[150px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-sm py-1 shadow-xl text-xs text-popover-foreground">
          {(['queue', 'cancel'] as const).map((option) => {
            const isActive = option === value
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent/50'
                }`}
              >
                <span className="truncate">
                  {t(`chat.busyAction.${option}`)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function EngineInfo({ engineType }: { engineType: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  const engineName = t(`createIssue.engineLabel.${engineType}`, engineType)

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title={engineName}
      >
        <EngineIcon engineType={engineType} className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute left-0 bottom-full mb-1.5 z-50 whitespace-nowrap rounded-xl border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs text-popover-foreground">
          <div className="flex items-center gap-1.5">
            <EngineIcon engineType={engineType} className="h-3 w-3 shrink-0" />
            <span className="font-medium">{engineName}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ModelSelect({
  models,
  value,
  onChange,
}: {
  models: EngineModel[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  const current = models.find((m) => m.id === value)
  const displayName = current
    ? formatModelName(current.name || current.id)
    : formatModelName(value)

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <span className="truncate max-w-[140px]">{displayName}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 min-w-[180px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-sm py-1 shadow-xl text-xs text-popover-foreground">
          {models.map((m) => {
            const isActive = m.id === value
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent/50'
                }`}
              >
                <span className="truncate">
                  {formatModelName(m.name || m.id)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ModeSelect({
  value,
  onChange,
}: {
  value: ModeOption
  onChange: (v: ModeOption) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        title={t('createIssue.mode')}
      >
        <span className="truncate max-w-[84px]">
          {t(`createIssue.perm.${value}`)}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 min-w-[130px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-sm py-1 shadow-xl text-xs text-popover-foreground">
          {MODE_OPTIONS.map((option) => {
            const isActive = option === value
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent/50'
                }`}
              >
                <span className="truncate">
                  {t(`createIssue.perm.${option}`)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
