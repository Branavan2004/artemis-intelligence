import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { API_BASE_URL, api } from '../lib/api'
import { clearAuthSession, readAuthToken } from '../lib/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatHistoryItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const SUGGESTED = [
  'What is the current mission phase?',
  'Tell me about the Artemis II crew',
  'How does the Orion spacecraft work?',
  'What records will Artemis II break?',
  'How is Artemis different from Apollo?',
]

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content:
    'I can help with mission phases, crew details, spacecraft questions, and Apollo comparisons. Ask a question to start.',
}

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [isFallbackMode, setIsFallbackMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    let active = true

    async function loadHistory() {
      const token = readAuthToken()

      if (!token) {
        clearAuthSession()
        navigate('/login', { replace: true, state: { from: '/chat' } })
        return
      }

      setHistoryLoading(true)
      setHistoryError('')

      try {
        const { data } = await api.get<ChatHistoryItem[]>('/api/chat/history', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!active) return

        const restoredMessages = data
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({
            role: message.role,
            content: message.content,
          }))

        setMessages(restoredMessages.length > 0 ? restoredMessages : [WELCOME_MESSAGE])
      } catch (error) {
        if (!active) return

        setMessages([WELCOME_MESSAGE])
        setHistoryError('Could not load previous chat history.')

        if (typeof error === 'object' && error !== null && 'response' in error) {
          const status = (error as { response?: { status?: number } }).response?.status

          if (status === 401) {
            clearAuthSession()
            navigate('/login', { replace: true, state: { from: '/chat' } })
            return
          }
        }
      } finally {
        if (active) {
          setHistoryLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [navigate])

  async function sendMessage(text?: string) {
    const message = text || input.trim()
    if (!message || loading || historyLoading) return

    setInput('')
    setHistoryError('')
    setIsFallbackMode(false)
    setMessages((previous) => [...previous, { role: 'user', content: message }])
    setLoading(true)

    try {
      const token = readAuthToken()
      if (!token) {
        clearAuthSession()
        navigate('/login', { replace: true, state: { from: '/chat' } })
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, history: messages }),
      })

      if (!response.ok) {
        throw new Error('Unable to reach the AI stream right now.')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      setMessages((previous) => [...previous, { role: 'assistant', content: '' }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.fallback) {
              setIsFallbackMode(true)
            }
            if (data.error) {
              throw new Error(data.error)
            }
            if (data.text) {
              fullText += data.text
              setMessages((previous) => {
                const updated = [...previous]
                updated[updated.length - 1] = { role: 'assistant', content: fullText }
                return updated
              })
            }
          } catch {
            // Ignore malformed chunks and keep streaming.
          }
        }
      }
    } catch (error) {
      const content =
        error instanceof Error ? error.message : 'AI service unavailable right now. Please try again in a moment.'
      setMessages((previous) => [...previous, { role: 'assistant', content }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <section className="page-header-split">
        <div className="page-header">
          <p className="section-label">Chat</p>
          <h1 className="page-title">Mission assistant</h1>
          <p className="page-copy">
            Ask questions about Artemis II, the crew, mission phases, and how the current program compares with Apollo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-plain p-6">
            <p className="section-label">Model status</p>
            <div className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">
              {isFallbackMode ? 'Fallback' : 'Ready'}
            </div>
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              {isFallbackMode ? 'Local mission knowledge base in use.' : 'Streaming responses available.'}
            </p>
          </div>
          <div className="card-plain p-6">
            <p className="section-label">History</p>
            <div className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">
              {historyLoading ? 'Loading' : `${messages.length}`}
            </div>
            <p className="mt-4 text-sm text-[color:var(--muted)]">Visible messages in the current authenticated session.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          {isFallbackMode && (
            <div className="card border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              The live Gemini model is unavailable, so responses are coming from the local mission knowledge base.
            </div>
          )}

          {(historyLoading || historyError) && (
            <div
              className={`card p-4 text-sm ${
                historyLoading
                  ? 'border-blue-600/30 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
              }`}
            >
              {historyLoading ? 'Loading previous messages...' : historyError}
            </div>
          )}

          <div className="card p-6 md:p-8">
            <div className="flex flex-col gap-3 border-b border-[color:var(--border)] pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-[color:var(--text)]">Conversation</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {historyLoading ? 'Loading history' : `${messages.length} messages`}
                </p>
              </div>
              <div className="text-sm text-[color:var(--muted)]">
                Scope: <span className="font-medium text-[color:var(--text)]">Mission, crew, spacecraft, history</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED.map((question) => (
                <button key={question} onClick={() => sendMessage(question)} className="pill-button">
                  {question}
                </button>
              ))}
            </div>

            <div className="mt-6 max-h-[560px] overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-7 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'border border-[color:var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--text)]'
                      }`}
                    >
                      {message.content || <span className="text-[color:var(--muted)]">Thinking...</span>}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
                placeholder="Ask a question about Artemis II"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || historyLoading || !input.trim()}
                className="button-primary w-11 px-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="section-label">Coverage</p>
            <h2 className="section-title mt-2">What the assistant covers</h2>
            <div className="mt-6 space-y-4">
              {[
                'Mission phases and timeline',
                'Crew records and roles',
                'Spacecraft and launch system details',
                'Apollo and Artemis comparisons',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-sm text-[color:var(--text)]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="section-label">Prompt ideas</p>
            <h2 className="section-title mt-2">Questions to try</h2>
            <div className="mt-6 space-y-2">
              {[
                'What makes Artemis II historically important?',
                'Which crew members are setting new records?',
                'Why does the mission use a free-return trajectory?',
                'What is happening in the current mission phase?',
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendMessage(item)}
                  className="w-full rounded-lg border border-[color:var(--border)] px-4 py-3 text-left text-sm text-[color:var(--text)] transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
