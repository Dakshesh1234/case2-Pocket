import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const POLL_INTERVAL_MS = 30000;

const TYPE_ICON = {
  expense_added: { emoji: '🧾', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  expense_deleted: { emoji: '🗑️', bg: 'bg-gray-100', text: 'text-gray-600' },
  settlement: { emoji: '💸', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  member_joined: { emoji: '👋', bg: 'bg-amber-50', text: 'text-amber-600' },
  group_created: { emoji: '🏠', bg: 'bg-purple-50', text: 'text-purple-600' },
  default: { emoji: '🔔', bg: 'bg-gray-100', text: 'text-gray-600' },
};

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      // Silently fail — bell shouldn't break the page
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (_) { /* no-op */ }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
    } catch (_) { /* no-op */ }
  };

  const onNotificationClick = async (n) => {
    if (!n.read) await markRead(n.id);
    if (n.group_id) {
      setOpen(false);
      navigate(`/groups/${n.group_id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-all duration-150"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse-ring">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-down origin-top-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              <p className="text-xs text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scroll">
            {loading && notifications.length === 0 ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-9 h-9 rounded-full" />
                    <div className="flex-1">
                      <div className="skeleton h-3 w-3/4 mb-2" />
                      <div className="skeleton h-2 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-14 h-14 mx-auto mb-3 bg-gray-50 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🔔</span>
                </div>
                <p className="text-sm font-medium text-gray-700">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">We'll let you know when something happens.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map(n => {
                  const icon = TYPE_ICON[n.type] || TYPE_ICON.default;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => onNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          n.read ? 'hover:bg-gray-50' : 'bg-indigo-50/40 hover:bg-indigo-50'
                        }`}
                      >
                        <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center ${icon.bg}`}>
                          <span className="text-base">{icon.emoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${n.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {n.group_name && (
                              <span className="text-[11px] text-gray-400 truncate">{n.group_name}</span>
                            )}
                            <span className="text-[11px] text-gray-400">·</span>
                            <span className="text-[11px] text-gray-400">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                        {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
