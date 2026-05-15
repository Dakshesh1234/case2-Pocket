import { useState, useEffect } from 'react';
import Confetti from './Confetti';

const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700', 'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700', 'bg-amber-100 text-amber-700',
];

export default function BalanceView({ netBalances, transactions, currentUserId, onSettle }) {
  const [settling, setSettling] = useState(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [justSettled, setJustSettled] = useState(false);

  const allSettled = transactions.length === 0 && Object.keys(netBalances).length > 0;

  useEffect(() => {
    if (justSettled && allSettled) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [justSettled, allSettled]);

  const handleSettle = async () => {
    setSettleLoading(true);
    setError('');
    try {
      await onSettle(settling.fromUser, settling.toUser, settling.amount);
      setSettling(null);
      setJustSettled(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to settle');
    } finally {
      setSettleLoading(false);
    }
  };

  const members = Object.entries(netBalances);
  const maxAbsBalance = Math.max(...members.map(([, { amount }]) => Math.abs(amount)), 1);

  return (
    <div className="space-y-4">
      <Confetti active={showConfetti} />

      {/* Net balances with visual bars */}
      <div className="card animate-fade-in-up">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Member balances</h3>
        {members.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No expenses yet.</p>
        ) : (
          <div className="space-y-3">
            {members.map(([userId, { amount, name }], i) => {
              const barWidth = Math.abs(amount) / maxAbsBalance * 100;
              const isSettled = Math.abs(amount) < 0.01;
              return (
                <div key={userId}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {name[0]}
                    </div>
                    <span className={`flex-1 text-sm font-medium ${String(userId) === String(currentUserId) ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {name}
                      {String(userId) === String(currentUserId) && <span className="text-xs text-indigo-400 ml-1">(you)</span>}
                    </span>
                    <div className="text-right">
                      {isSettled ? (
                        <span className="badge-gray">Settled</span>
                      ) : amount > 0 ? (
                        <span className="text-emerald-600 font-bold text-sm tabular-nums">+${amount.toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500 font-bold text-sm tabular-nums">-${Math.abs(amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  {!isSettled && (
                    <div className="ml-11 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full animate-bar-grow ${amount > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${barWidth}%`, animationDelay: `${i * 80}ms` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Minimized transactions */}
      <div className="card animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settle up</h3>
          {transactions.length > 0 && (
            <span className="badge-indigo">{transactions.length} transfer{transactions.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {allSettled ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-3 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse-ring">
              <span className="text-3xl">🎉</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-1">All settled up!</h4>
            <p className="text-sm text-gray-500">No outstanding debts in this group.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-2">
              Optimized to {transactions.length} transfer{transactions.length !== 1 ? 's' : ''} (minimum possible).
            </p>
            {transactions.map((tx, i) => {
              const isMe = String(tx.from.userId) === String(currentUserId);
              const owedToMe = String(tx.to.userId) === String(currentUserId);
              return (
                <div
                  key={i}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${
                    isMe ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50'
                    : owedToMe ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50'
                    : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 sm:mb-0">
                    <span className="font-semibold text-sm text-gray-800">{tx.from.name}</span>
                    <div className="flex items-center gap-1 text-gray-400">
                      <div className="w-6 h-px bg-gray-300" />
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{tx.to.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900 tabular-nums">${tx.amount.toFixed(2)}</span>
                    {isMe && (
                      <button
                        onClick={() => setSettling({
                          fromUser: tx.from.userId, toUser: tx.to.userId,
                          amount: tx.amount, fromName: tx.from.name, toName: tx.to.name,
                          role: 'payer',
                        })}
                        className="btn-success text-xs py-1.5 px-4"
                      >
                        Pay now
                      </button>
                    )}
                    {owedToMe && (
                      <button
                        onClick={() => setSettling({
                          fromUser: tx.from.userId, toUser: tx.to.userId,
                          amount: tx.amount, fromName: tx.from.name, toName: tx.to.name,
                          role: 'payee',
                        })}
                        className="btn-secondary text-xs py-1.5 px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        Mark received
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle confirmation modal */}
      {settling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 modal-backdrop" onClick={() => setSettling(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm modal-content">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-50 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {settling.role === 'payee' ? 'Mark as received' : 'Confirm payment'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {settling.role === 'payee'
                  ? `Record that ${settling.fromName} paid you back.`
                  : `Record that you paid ${settling.toName}.`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="text-gray-500">From</p>
                  <p className="font-semibold text-gray-900">{settling.fromName}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="text-sm text-right">
                  <p className="text-gray-500">To</p>
                  <p className="font-semibold text-gray-900">{settling.toName}</p>
                </div>
              </div>
              <div className="text-center mt-3 pt-3 border-t border-gray-200">
                <p className="text-3xl font-bold text-gray-900 tabular-nums">${settling.amount.toFixed(2)}</p>
              </div>
            </div>
            {error && <p className="text-red-600 text-sm mb-3 text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setSettling(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSettle} className="btn-success flex-1" disabled={settleLoading}>
                {settleLoading
                  ? 'Processing...'
                  : settling.role === 'payee' ? 'Mark received' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
