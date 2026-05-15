const ACTION_CONFIG = {
  group_created:  { label: 'created the group',      icon: '🏠', color: 'bg-purple-100 text-purple-600' },
  member_joined:  { label: 'joined the group',       icon: '👋', color: 'bg-blue-100 text-blue-600' },
  expense_added:  { label: 'added an expense',       icon: '💳', color: 'bg-emerald-100 text-emerald-600' },
  expense_deleted:{ label: 'deleted an expense',      icon: '🗑️', color: 'bg-red-100 text-red-600' },
  settled_up:     { label: 'settled a payment',       icon: '✅', color: 'bg-amber-100 text-amber-600' },
};

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActionDetail({ action, details }) {
  if (!details) return null;
  try {
    const d = typeof details === 'string' ? JSON.parse(details) : details;
    if (action === 'expense_added') return (
      <span className="text-gray-600">
        "{d.description}" — <span className="font-semibold tabular-nums">${parseFloat(d.amount).toFixed(2)}</span>
      </span>
    );
    if (action === 'expense_deleted') return (
      <span className="text-gray-500 line-through">
        "{d.description}" — ${parseFloat(d.amount).toFixed(2)}
      </span>
    );
    if (action === 'settled_up') return (
      <span className="text-gray-600">
        {d.from} paid {d.to} <span className="font-semibold tabular-nums">${parseFloat(d.amount).toFixed(2)}</span>
      </span>
    );
    if (action === 'group_created') return <span className="text-gray-600">"{d.name}"</span>;
    if (action === 'member_joined') return <span className="text-gray-600">{d.name}</span>;
    return null;
  } catch { return null; }
}

export default function AuditLog({ log }) {
  if (log.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <span className="text-3xl">📜</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No activity yet</h3>
        <p className="text-sm text-gray-500">Actions will appear here as they happen.</p>
      </div>
    );
  }

  // Group by date
  const grouped = {};
  log.forEach(entry => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(entry);
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 sticky top-0 bg-gray-50 py-1 z-[1]">
            {date}
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gray-100" />

            <div className="space-y-1">
              {entries.map(entry => {
                const config = ACTION_CONFIG[entry.action] || { label: entry.action, icon: '📌', color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={entry.id} className="flex items-start gap-3 relative py-2.5 pl-1 hover:bg-white/60 rounded-xl transition-colors">
                    <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs z-[2] ring-2 ring-gray-50 ${config.color}`}>
                      <span className="text-[11px]">{config.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">{entry.user_name}</span>
                        {' '}{config.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <ActionDetail action={entry.action} details={entry.details} />
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 pt-1 tabular-nums">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
