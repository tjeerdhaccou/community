import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useProject } from '../contexts/ProjectContext'
import { NOTIFICATION_CONFIG, timeAgo } from '../lib/constants'

export default function NotificationBell() {
  const { project, basePath } = useProject()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleClick(notification) {
    markAsRead(notification.id)
    setOpen(false)

    // Navigate to related content
    const { related_type, related_id } = notification
    if (related_type === 'post') navigate(`${basePath}/community`)
    else if (related_type === 'update') navigate(`${basePath}/updates`)
    else if (related_type === 'event') navigate(`${basePath}/events`)
    else if (related_type === 'document') navigate(`${basePath}/documenten`)
    else if (related_type === 'document_request') navigate(`${basePath}/mijn-documenten`)
    else navigate(basePath)
  }

  function handleMarkAll() {
    markAllAsRead()
  }

  return (
    <div className="notification-bell" ref={ref}>
      <button
        className={`notification-bell__trigger ${unreadCount > 0 ? 'notification-bell__trigger--has-unread' : ''}`}
        onClick={() => setOpen(!open)}
        title="Notificaties"
        aria-label="Notificaties"
      >
        <i className="fa-solid fa-bell" />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__header">
            <h3>Notificaties</h3>
            {unreadCount > 0 && (
              <button className="notification-dropdown__mark-all" onClick={handleMarkAll}>
                Alles gelezen
              </button>
            )}
          </div>

          <div className="notification-dropdown__list">
            {notifications.length === 0 ? (
              <div className="notification-dropdown__empty">
                <i className="fa-regular fa-bell-slash" />
                <p>Geen notificaties</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({ notification, onClick }) {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.comment
  const initials = (notification.actor?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)

  return (
    <div
      className={`notification-item ${!notification.is_read ? 'notification-item--unread' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="notification-item__avatar">
        {notification.actor?.avatar_url ? (
          <img src={notification.actor.avatar_url} alt={notification.actor.full_name || ''} />
        ) : (
          <div className="notification-item__avatar-placeholder" style={{ background: config.color }}>
            {notification.actor ? initials : <i className={config.icon} />}
          </div>
        )}
      </div>

      <div className="notification-item__content">
        <p className="notification-item__text">{notification.title}</p>
        {notification.body && (
          <p className="notification-item__body">{notification.body}</p>
        )}
        <span className="notification-item__time">{timeAgo(notification.created_at)}</span>
      </div>

      <div className="notification-item__indicator">
        <i className={config.icon} style={{ color: config.color }} />
        {!notification.is_read && <span className="notification-item__dot" />}
      </div>
    </div>
  )
}
