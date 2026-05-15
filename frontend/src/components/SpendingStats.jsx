const CATEGORY_CONFIG = {
  food:          { label: 'Food',          color: 'bg-orange-500', lightBg: 'bg-orange-50', text: 'text-orange-700', icon: '🍔' },
  rent:          { label: 'Rent',          color: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-700', icon: '🏠' },
  utilities:     { label: 'Utilities',     color: 'bg-blue-500',   lightBg: 'bg-blue-50',   text: 'text-blue-700',   icon: '💡' },
  transport:     { label: 'Transport',     color: 'bg-emerald-500',lightBg: 'bg-emerald-50',text: 'text-emerald-700',icon: '🚗' },
  entertainment: { label: 'Entertainment', color: 'bg-pink-500',   lightBg: 'bg-pink-50',   text: 'text-pink-700',   icon: '🎬' },
  general:       { label: 'General',       color: 'bg-gray-500',   lightBg: 'bg-gray-50',   text: 'text-gray-700',   icon: '💳' },
  other:         { label: 'Other',         color: 'bg-amber-500',  lightBg: 'bg-amber-50',  text: 'text-amber-700',  icon: '📦' },
};

export default function SpendingStats({ expenses, members, currentUserId }) {
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const yourShare = expenses.reduce((sum, e) => {
    const split = e.splits?.find(s => String(s.userId) === String(currentUserId));
    return sum + (split ? parseFloat(split.amount) : 0);
  }, 0);

  const youPaid = expenses
    .filter(e => String(e.paid_by) === String(currentUserId))
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Category breakdown
  const categories = {};
  expenses.forEach(e => {
    const cat = e.category || 'general';
    if (!categories[cat]) categories[cat] = 0;
    categories[cat] += parseFloat(e.amount);
  });
  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const maxCatAmount = sortedCategories[0]?.[1] || 1;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total spent</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">
            ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Your share</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600 tabular-nums mt-1">
            ${yourShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalSpent > 0 ? `${((yourShare / totalSpent) * 100).toFixed(0)}% of total` : '-'}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">You paid</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 tabular-nums mt-1">
            ${youPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalSpent > 0 ? `${((youPaid / totalSpent) * 100).toFixed(0)}% of total` : '-'}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      {sortedCategories.length > 0 && (
        <div className="card">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Spending by category</h4>
          <div className="space-y-3">
            {sortedCategories.map(([cat, amount], i) => {
              const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
              const pct = (amount / totalSpent) * 100;
              const barWidth = (amount / maxCatAmount) * 100;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{config.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums w-20 text-right">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.color} rounded-full animate-bar-grow`}
                      style={{ width: `${barWidth}%`, animationDelay: `${i * 100}ms` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
