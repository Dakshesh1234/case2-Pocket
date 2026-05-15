import { useState, useMemo } from 'react';

const CATEGORY_CONFIG = {
  food:          { icon: '🍔', color: 'bg-orange-100' },
  rent:          { icon: '🏠', color: 'bg-purple-100' },
  utilities:     { icon: '💡', color: 'bg-blue-100' },
  transport:     { icon: '🚗', color: 'bg-emerald-100' },
  entertainment: { icon: '🎬', color: 'bg-pink-100' },
  general:       { icon: '💳', color: 'bg-gray-100' },
  other:         { icon: '📦', color: 'bg-amber-100' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ExpenseList({ expenses, currentUserId, onDelete }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const categories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category || 'general'));
    return ['all', ...Array.from(cats)];
  }, [expenses]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.paid_by_name?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter(e => (e.category || 'general') === categoryFilter);
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'amount-desc') return parseFloat(b.amount) - parseFloat(a.amount);
      if (sortBy === 'amount-asc') return parseFloat(a.amount) - parseFloat(b.amount);
      return 0;
    });
    return result;
  }, [expenses, search, categoryFilter, sortBy]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await onDelete(id); } finally { setDeleting(null); setConfirmDelete(null); }
  };

  if (expenses.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <span className="text-3xl">📋</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No expenses yet</h3>
        <p className="text-sm text-gray-500">Add the first expense using the button above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 animate-fade-in-up">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto text-sm"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      {(search || categoryFilter !== 'all') && (
        <p className="text-xs text-gray-400">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          {search && <> for "<span className="font-medium text-gray-600">{search}</span>"</>}
        </p>
      )}

      {/* Expense cards */}
      <div className="space-y-2 stagger-children">
        {filtered.map(expense => {
          const mySplit = expense.splits?.find(s => String(s.userId) === String(currentUserId));
          const paidByMe = String(expense.paid_by) === String(currentUserId);
          const myAmount = parseFloat(mySplit?.amount || 0);
          const lentAmount = paidByMe ? parseFloat(expense.amount) - myAmount : 0;
          const catConfig = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.general;
          const isExpanded = expandedId === expense.id;
          const canDelete = String(expense.paid_by) === String(currentUserId) || String(expense.created_by) === String(currentUserId);

          return (
            <div
              key={expense.id}
              className={`card p-0 overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md ring-1 ring-indigo-100' : ''}`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${catConfig.color} flex items-center justify-center text-lg flex-shrink-0`}>
                  {catConfig.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{expense.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(expense.created_at)} · {expense.paid_by_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 tabular-nums">${parseFloat(expense.amount).toFixed(2)}</p>
                  {mySplit && (
                    <p className={`text-xs font-medium mt-0.5 ${paidByMe ? 'text-emerald-600' : 'text-red-500'}`}>
                      {paidByMe ? `lent $${lentAmount.toFixed(2)}` : `owe $${myAmount.toFixed(2)}`}
                    </p>
                  )}
                </div>
                <svg className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-50 animate-fade-in">
                  <div className="pt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Split breakdown</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {expense.splits?.map(s => (
                        <div key={s.userId} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                          String(s.userId) === String(currentUserId)
                            ? 'bg-indigo-50 ring-1 ring-indigo-100'
                            : 'bg-gray-50'
                        }`}>
                          <span className="font-medium text-gray-700 truncate flex-1">{s.name}</span>
                          <span className="font-semibold tabular-nums text-gray-900">${parseFloat(s.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {canDelete && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(expense); }}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete expense
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && expenses.length > 0 && (
        <div className="text-center py-12 animate-fade-in">
          <p className="text-gray-400 text-sm">No expenses match your filters.</p>
          <button onClick={() => { setSearch(''); setCategoryFilter('all'); }} className="text-indigo-600 text-sm font-medium mt-2 hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 modal-backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm modal-content">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete expense?</h3>
            <p className="text-gray-500 text-sm mb-4">
              Delete "<span className="font-medium text-gray-700">{confirmDelete.description}</span>" (${parseFloat(confirmDelete.amount).toFixed(2)})?
              All balances will be recalculated.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="btn-danger flex-1"
                disabled={deleting === confirmDelete.id}
              >
                {deleting === confirmDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
