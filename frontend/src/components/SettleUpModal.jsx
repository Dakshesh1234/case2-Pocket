import { useState, useMemo, useEffect } from 'react';

export default function SettleUpModal({ transactions, currentUserId, onClose, onSettle }) {
  const myDebts = useMemo(
    () => (transactions || []).filter(tx => String(tx.from.userId) === String(currentUserId)),
    [transactions, currentUserId]
  );
  const owedToMe = useMemo(
    () => (transactions || []).filter(tx => String(tx.to.userId) === String(currentUserId)),
    [transactions, currentUserId]
  );
  const myTransactions = useMemo(() => [...myDebts, ...owedToMe], [myDebts, owedToMe]);
  const totalInvolved = useMemo(
    () => myTransactions.reduce((s, tx) => s + tx.amount, 0),
    [myTransactions]
  );

  const [mode, setMode] = useState(myTransactions.length > 1 ? 'all' : 'single');
  const [selected, setSelected] = useState(myTransactions[0] || null);
  const [customAmount, setCustomAmount] = useState(
    myTransactions[0] ? myTransactions[0].amount.toFixed(2) : ''
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, loading]);

  const selectTx = (tx) => {
    setMode('single');
    setSelected(tx);
    setCustomAmount(tx.amount.toFixed(2));
    setError('');
  };

  const txRole = (tx) =>
    String(tx.from.userId) === String(currentUserId) ? 'payer' : 'payee';

  const handleConfirmSingle = async () => {
    if (!selected) return;
    const amount = parseFloat(customAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amount > selected.amount + 0.001) {
      setError(`Amount can't exceed $${selected.amount.toFixed(2)}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSettle(selected.from.userId, selected.to.userId, amount);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to settle');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    if (myTransactions.length === 0) return;
    setLoading(true);
    setError('');
    setProgress({ done: 0, total: myTransactions.length });
    try {
      for (let i = 0; i < myTransactions.length; i++) {
        const tx = myTransactions[i];
        await onSettle(tx.from.userId, tx.to.userId, tx.amount);
        setProgress({ done: i + 1, total: myTransactions.length });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to settle all');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => (mode === 'all' ? handleConfirmAll() : handleConfirmSingle());

  const nothingToSettle = myTransactions.length === 0;
  const canSettleAll = myTransactions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-black/40 modal-backdrop" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md modal-content max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">Settle up</h2>
              <p className="text-xs text-gray-500">Either party can record a payment.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="btn-ghost p-2 disabled:opacity-50" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 custom-scroll">
          {nothingToSettle ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-emerald-50 rounded-full flex items-center justify-center">
                <span className="text-3xl">🎉</span>
              </div>
              <h4 className="font-bold text-gray-900 mb-1">You're all settled!</h4>
              <p className="text-sm text-gray-500">Nothing to pay or receive right now.</p>
            </div>
          ) : (
            <>
              {/* Mode switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setMode('all')}
                  disabled={!canSettleAll}
                  className={`text-sm font-medium py-2 rounded-lg transition-all ${
                    mode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Settle all
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('single'); if (!selected) selectTx(myTransactions[0]); }}
                  className={`text-sm font-medium py-2 rounded-lg transition-all ${
                    mode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Single transaction
                </button>
              </div>

              {mode === 'all' ? (
                <div>
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total to record</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                      ${totalInvolved.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Across {myTransactions.length} transfer{myTransactions.length !== 1 ? 's' : ''}.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {myTransactions.map((tx, i) => {
                      const role = txRole(tx);
                      return (
                        <li
                          key={i}
                          className={`p-3 rounded-xl border flex items-center justify-between text-sm ${
                            role === 'payer'
                              ? 'border-red-100 bg-red-50/40'
                              : 'border-emerald-100 bg-emerald-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              role === 'payer' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {role === 'payer' ? 'You pay' : 'You receive'}
                            </span>
                            <span className="font-medium text-gray-900 truncate">
                              {role === 'payer' ? tx.to.name : tx.from.name}
                            </span>
                          </div>
                          <span className="font-bold tabular-nums text-gray-900">${tx.amount.toFixed(2)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {loading && progress.total > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Recording…</span>
                        <span>{progress.done} / {progress.total}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-200"
                          style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {myDebts.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        You owe
                      </h3>
                      <div className="space-y-2">
                        {myDebts.map((tx, i) => {
                          const active = selected && selected.from.userId === tx.from.userId && selected.to.userId === tx.to.userId;
                          return (
                            <button
                              key={i}
                              onClick={() => selectTx(tx)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                active
                                  ? 'border-indigo-500 bg-indigo-50/50'
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-500">Pay</span>
                                  <span className="font-semibold text-gray-900">{tx.to.name}</span>
                                </div>
                                <span className="font-bold tabular-nums text-gray-900">${tx.amount.toFixed(2)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {owedToMe.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Owed to you
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        Already received the money? Mark it as paid.
                      </p>
                      <div className="space-y-2">
                        {owedToMe.map((tx, i) => {
                          const active = selected && selected.from.userId === tx.from.userId && selected.to.userId === tx.to.userId;
                          return (
                            <button
                              key={i}
                              onClick={() => selectTx(tx)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                active
                                  ? 'border-emerald-500 bg-emerald-50/50'
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-500">From</span>
                                  <span className="font-semibold text-gray-900">{tx.from.name}</span>
                                </div>
                                <span className="font-bold tabular-nums text-emerald-700">${tx.amount.toFixed(2)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selected && (
                    <div className="mt-2 pt-4 border-t border-gray-100">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {txRole(selected) === 'payer'
                          ? `Amount to pay ${selected.to.name}`
                          : `Amount received from ${selected.from.name}`}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={selected.amount}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="input pl-7 text-lg font-semibold tabular-nums"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setCustomAmount(selected.amount.toFixed(2))}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md"
                        >
                          Full (${selected.amount.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomAmount((selected.amount / 2).toFixed(2))}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md"
                        >
                          Half
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            </>
          )}
        </div>

        {!nothingToSettle && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50 rounded-b-2xl">
            <button onClick={onClose} disabled={loading} className="btn-secondary flex-1 disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (mode === 'single' && !selected)}
              className="btn-success flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (mode === 'all' ? `Recording ${progress.done}/${progress.total}…` : 'Processing…')
                : mode === 'all'
                  ? `Settle all ($${totalInvolved.toFixed(2)})`
                  : selected && txRole(selected) === 'payee'
                    ? 'Mark as received'
                    : 'Confirm payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
