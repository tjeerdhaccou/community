import { useState, useCallback, useRef, useEffect } from 'react'
import { DEMO_SUPPORT } from '../content/demoSupport'

// Zelfde vorm als useSupportConversation, maar voor de klik-demo: geen database,
// alleen het voorbeeldgesprek uit content/demoSupport.js plus wat de bezoeker
// zelf typt. Na elk bericht volgt een automatisch antwoord dat uitlegt hoe het
// in een echt project werkt.

function minutesAgo(min) {
  return new Date(Date.now() - min * 60_000).toISOString()
}

let seq = 0
function msg(role, body, extra = {}) {
  seq += 1
  return { id: `demo-support-${seq}`, sender_role: role, body, created_at: new Date().toISOString(), ...extra }
}

export function useDemoSupportConversation() {
  const [messages, setMessages] = useState(() =>
    DEMO_SUPPORT.messages.map((m, i) => ({
      id: `demo-support-seed-${i}`,
      sender_role: m.from === 'me' ? 'user' : 'agent',
      body: m.text,
      created_at: minutesAgo(m.ago),
    }))
  )
  const [unreadCount, setUnreadCount] = useState(DEMO_SUPPORT.unread)
  const [sending, setSending] = useState(false)
  const replies = useRef(0)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const sendMessage = useCallback(async (text, file) => {
    setMessages(prev => [...prev, msg('user', text, file ? { demo_attachment_name: file.name } : {})])
    setSending(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const reply = replies.current === 0 ? DEMO_SUPPORT.firstReply : DEMO_SUPPORT.nextReply
      replies.current += 1
      setMessages(prev => [...prev, msg('agent', reply)])
      setSending(false)
    }, 1200)
  }, [])

  const markRead = useCallback(() => setUnreadCount(0), [])

  return { messages, loading: false, sending, sendMessage, markRead, unreadCount, note: DEMO_SUPPORT.note }
}
