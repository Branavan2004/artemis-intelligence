import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { API_BASE_URL } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'What is the current mission phase?',
  'Tell me about the Artemis II crew',
  'How does the Orion spacecraft work?',
  'What records will Artemis II break?',
  'How is Artemis different from Apollo?',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m Artemis AI 🚀 I\'m your intelligent guide to the Artemis II mission. Ask me anything about the crew, spacecraft, mission phases, or how this historic mission compares to Apollo. What would you like to know?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const message = text || input.trim()
    if (!message || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setLoading(true)

    try {
      const token = localStorage.getItem('artemis_token')
      if (!token) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'AI chat is connected to the backend, but this page still needs the upcoming login flow to send a real JWT. Auth is the next frontend step.'
        }])
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message, history: messages }),
      })

      if (!res.ok) {
        throw new Error('Unable to reach the AI stream right now.')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              throw new Error(data.error)
            }
            if (data.text) {
              fullText += data.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullText }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (error) {
      const content = error instanceof Error ? error.message : 'AI service unavailable. Add your Anthropic API key to enable the chat.'
      setMessages(prev => [...prev, { role: 'assistant', content }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="mb-4">
        <h1 className="font-display text-4xl font-black text-white mb-2">AI CHAT</h1>
        <p className="text-gray-400">Ask Artemis AI anything about the mission</p>
      </div>

      {/* Suggested questions */}
      <div className="flex gap-2 flex-wrap mb-4">
        {SUGGESTED.map(q => (
          <button key={q} onClick={() => sendMessage(q)} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-artemis-blue/20 hover:border-artemis-blue border border-gray-700 rounded-full text-gray-300 hover:text-artemis-blue transition-all">
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-artemis-blue/20 border border-artemis-blue/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-artemis-blue" />
              </div>
            )}
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-artemis-blue text-white rounded-tr-sm' : 'bg-space-900 border border-gray-800 text-gray-200 rounded-tl-sm'}`}>
              {msg.content || <span className="animate-pulse text-gray-500">Thinking...</span>}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything about Artemis II..."
          className="flex-1 bg-space-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-artemis-blue transition-colors"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-artemis-blue hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
