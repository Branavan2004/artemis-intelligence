import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, api } from '../lib/api'
import { clearAuthSession, readAuthToken, readAuthUser } from '../lib/auth'
import { useTelemetry } from '../hooks/useTelemetry'
import { formatMissionMet, getMissionHoursElapsed } from '../lib/mission'
import { getDistanceFromEarthKm, getVelocityKmS } from '../lib/replay'

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

interface MissionResponse {
  launchDate: string
}

const SUGGESTED_PROMPTS = [
  'What is the signal delay right now?',
  'How far is the crew from the Moon?',
  'What are the crew doing right now?',
  'Has the distance record been broken?',
]

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Telemetry-linked mission control assistant online. Ask about signal delay, lunar distance, crew activity, or the current record status.',
}

const NUMBER_PATTERN = /(\b\d[\d,]*(?:\.\d+)?(?:\s?(?:km\/s|km|s|days?|hours?|minutes?|%|°F|G))?)/g
const NUMBER_SEGMENT = /^\d[\d,]*(?:\.\d+)?(?:\s?(?:km\/s|km|s|days?|hours?|minutes?|%|°F|G))?$/

function renderAssistantContent(content: string) {
  return content.split(NUMBER_PATTERN).map((segment, index) => {
    if (!segment) {
      return null
    }

    if (NUMBER_SEGMENT.test(segment)) {
      return (
        <span key={`${segment}-${index}`} className="data-value">
          {segment}
        </span>
      )
    }

    return <span key={`${segment}-${index}`}>{segment}</span>
  })
}

function getMissionPhaseLabel(hoursElapsed: number) {
  if (hoursElapsed < 25) return 'Earth Orbit'
  if (hoursElapsed < 94) return 'Cislunar Transit'
  if (hoursElapsed < 120) return 'Lunar Flyby'
  if (hoursElapsed < 204) return 'Return Transit'
  return 'Reentry & Recovery'
}

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [isFallbackMode, setIsFallbackMode] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [launchDate, setLaunchDate] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const bottomRef = useRef<HTMLDivElement>(null)
  const { data: telemetry } = useTelemetry()
  const authUser = readAuthUser()
  const userLabel = authUser?.name?.toUpperCase() || 'USER'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    api
      .get<MissionResponse>('/api/mission')
      .then((response) => setLaunchDate(response.data.launchDate))
      .catch(() => {})
  }, [])

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

    void loadHistory()

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

  const hoursElapsed = launchDate ? getMissionHoursElapsed(launchDate, now) : 0
  const phase = launchDate ? getMissionPhaseLabel(hoursElapsed) : 'Awaiting mission clock'
  const metElapsed = launchDate ? formatMissionMet(launchDate, now) : '00:00:00'
  const distance = telemetry?.trajectory?.distanceFromEarthKm ?? getDistanceFromEarthKm(hoursElapsed)
  const velocity = telemetry?.trajectory?.speedKmS ?? getVelocityKmS(hoursElapsed)
  const signalDelay = distance / 299792
  const risk = telemetry?.spaceWeather?.riskLevel ?? 'nominal'
  const distanceFromMoon = Math.abs(384400 - distance)
  const recordDelta = Math.round(distance - 400171)

  return (
    <div className="chat-page">
      <section className="chat-main">
        <header className="chat-header">
          <div className="panel-label">Mission Control AI</div>
          <div className="chat-header-copy">Context-aware · Grounded in live telemetry</div>
        </header>

        {isFallbackMode ? <div className="chat-note">Live model unavailable. Responses are currently grounded in the local mission knowledge base.</div> : null}
        {historyLoading ? <div className="chat-note">Loading previous messages...</div> : null}
        {historyError ? <div className="chat-note">{historyError}</div> : null}

        <div className="chat-messages">
          {messages.map((message, index) => {
            const isEmptyAssistant = message.role === 'assistant' && !message.content && loading

            return (
              <article key={`${message.role}-${index}`} className={`chat-message chat-message--${message.role}`}>
                <span className="chat-message__label">{message.role === 'user' ? userLabel : 'ARTEMIS AI · MISSION CONTROL'}</span>
                <div className="chat-message__body">
                  {isEmptyAssistant ? (
                    <span className="chat-loading" aria-label="Thinking">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : message.role === 'assistant' ? (
                    renderAssistantContent(message.content)
                  ) : (
                    message.content
                  )}
                </div>
              </article>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className={`chat-inputbar${isInputFocused ? ' chat-inputbar--focused' : ''}`}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Ask mission control..."
            className="chat-input"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading || historyLoading || !input.trim()}
            className="chat-send"
          >
            →
          </button>
        </div>
      </section>

      <aside className="chat-sidebar">
        <div className="panel-label">Live Context</div>
        <div className="chat-context-rows" style={{ marginTop: 16 }}>
          {[
            ['MET', metElapsed, ''],
            ['DISTANCE', `${Math.round(distance).toLocaleString()} km`, ''],
            ['VELOCITY', `${velocity.toFixed(3)} km/s`, ''],
            ['SIGNAL DELAY', `${signalDelay.toFixed(2)} s`, ''],
            ['RADIATION', risk.toUpperCase(), risk],
            ['PHASE', phase, ''],
            ['FROM MOON', `${Math.round(distanceFromMoon).toLocaleString()} km`, ''],
          ].map(([label, value, tone]) => (
            <div key={label} className="chat-context-row">
              <span className="chat-context-key">{label}</span>
              <span className={`chat-context-value${tone ? ` chat-context-value--${tone}` : ''}`}>{value}</span>
            </div>
          ))}

          {recordDelta > 0 ? (
            <div className="chat-context-row">
              <span className="chat-context-key">RECORD DIST</span>
              <span className="chat-context-value">+{recordDelta.toLocaleString()} km</span>
            </div>
          ) : null}
        </div>

        <div className="panel-divider" style={{ marginTop: 20, marginBottom: 20 }} />

        <div className="panel-label">What You Can Ask</div>
        <div className="chat-chip-list">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" className="chat-chip" onClick={() => setInput(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <p className="chat-sidebar-note">AI responses grounded in real-time telemetry data</p>
      </aside>
    </div>
  )
}
