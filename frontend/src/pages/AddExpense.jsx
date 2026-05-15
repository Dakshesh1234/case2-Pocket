import { useState, useEffect } from 'react';
import api from '../api';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: '💳' },
  { key: 'food', label: 'Food', icon: '🍔' },
  { key: 'rent', label: 'Rent', icon: '🏠' },
  { key: 'utilities', label: 'Utilities', icon: '💡' },
  { key: 'transport', label: 'Transport', icon: '🚗' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { key: 'other', label: 'Other', icon: '📦' },
];

export default function AddExpense({ groupId, members, currentUserId, onClose, onAdded }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(String(currentUserId));
  const [category, setCategory] = useState('general');
  const [splitMode, setSplitMode] = useState('equal');
  const [splits, setSplits] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { initSplits(); }, [members, splitMode]);
  useEffect(() => {
    if (splitMode === 'equal' || splitMode === 'percent') recalcSplits();
  }, [amount, splitMode]);

  const initSplits = () => {
    setSplits(members.map(m => ({
      userId: String(m.id), name: m.name, included: true,
      amount: '0', percent: (100 / members.length).toFixed(2),
    })));
  };

  const recalcSplits = () => {
    const total = parseFloat(amount) || 0;
    setSplits(prev => {
      const included = prev.filter(s => s.included);
      if (included.length === 0) return prev;
      if (splitMode === 'equal') {
        const each = (total / included.length).toFixed(2);
        const remainder = (total - parseFloat(each) * included.length).toFixed(2);
        let i = 0;
        return prev.map(s => {
          if (!s.included) return { ...s, amount: '0' };
          const amt = i === 0 ? (parseFloat(each) + parseFloat(remainder)).toFixed(2) : each;
          i++;
          return { ...s, amount: amt };
        });
      }
      if (splitMode === 'percent') {
        return prev.map(s => ({
          ...s, amount: s.included ? ((parseFloat(s.percent) / 100) * total).toFixed(2) : '0',
        }));
      }
      return prev;
    });
  };

  const toggleMember = (userId) => {
    setSplits(prev => {
      const updated = prev.map(s => s.userId === userId ? { ...s, included: !s.included } : s);
      const total = parseFloat(amount) || 0;
      const included = updated.filter(s => s.included);
      if (splitMode === 'equal' && included.length > 0) {
        const each = (total / included.length).toFixed(2);
        const remainder = (total - parseFloat(each) * included.length).toFixed(2);
        let i = 0;
        return updated.map(s => {
          if (!s.included) return { ...s, amount: '0' };
          const amt = i === 0 ? (parseFloat(each) + parseFloat(remainder)).toFixed(2) : each;
          i++;
          return { ...s, amount: amt };
        });
      }
      return updated.map(s => s.included ? s : { ...s, amount: '0' });
    });
  };

  const updatePercent = (userId, val) => {
    const total = parseFloat(amount) || 0;
    setSplits(prev => prev.map(s =>
      s.userId === userId ? { ...s, percent: val, amount: ((parseFloat(val) || 0) / 100 * total).toFixed(2) } : s
    ));
  };
  const updateExact = (userId, val) => {
    setSplits(prev => prev.map(s => s.userId === userId ? { ...s, amount: val } : s));
  };

  const totalSplits = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const amountNum = parseFloat(amount) || 0;
  const splitValid = Math.abs(totalSplits - amountNum) < 0.02;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!description.trim()) return setError('Description required');
    if (!amount || parseFloat(amount) <= 0) return setError('Valid amount required');
    if (!splitValid) return setError(`Splits ($${totalSplits.toFixed(2)}) must equal amount ($${amountNum.toFixed(2)})`);
    const activeSplits = splits.filter(s => s.included && parseFloat(s.amount) > 0);
    if (activeSplits.length === 0) return setError('At least one person must be in the split');

    setLoading(true);
    try {
      await api.post(`/groups/${groupId}/expenses`, {
        description: description.trim(), amount: parseFloat(amount),
        paid_by: parseInt(paidBy), category,
        splits: activeSplits.map(s => ({ userId: parseInt(s.userId), amount: parseFloat(s.amount) })),
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto custom-scroll modal-content-mobile sm:modal-content">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">New expense</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Description & Amount side by side */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">What was it for?</label>
              <input className="input text-base" placeholder="Groceries, rent, dinner..." value={description} onChange={e => setDescription(e.target.value)} autoFocus required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">How much?</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input type="number" step="0.01" min="0.01" className="input pl-7 text-2xl font-bold tabular-nums" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
            </div>

            {/* Category pills */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      category === c.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid by */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Paid by</label>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaidBy(String(m.id))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      paidBy === String(m.id)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.name} {String(m.id) === String(currentUserId) ? '(me)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Split mode */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Split method</label>
              <div className="flex bg-gray-100 rounded-xl p-1">
                {[
                  { key: 'equal', label: 'Equal', desc: 'Split evenly' },
                  { key: 'percent', label: 'By %', desc: 'Custom percentages' },
                  { key: 'exact', label: 'Exact', desc: 'Custom amounts' },
                ].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSplitMode(m.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      splitMode === m.key
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Splits */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Split between</label>
                {amountNum > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    splitValid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    ${totalSplits.toFixed(2)} / ${amountNum.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {splits.map(s => (
                  <div key={s.userId} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                    s.included ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/50 opacity-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={() => toggleMember(s.userId)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-700">
                      {s.name}
                      {String(s.userId) === String(currentUserId) && <span className="text-indigo-400 ml-1">(me)</span>}
                    </span>
                    {splitMode === 'percent' && s.included && (
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.01" min="0" max="100"
                          className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={s.percent} onChange={e => updatePercent(s.userId, e.target.value)} />
                        <span className="text-xs text-gray-400 font-medium">%</span>
                      </div>
                    )}
                    {splitMode === 'exact' && s.included && (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input type="number" step="0.01" min="0"
                          className="w-20 text-right border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={s.amount} onChange={e => updateExact(s.userId, e.target.value)} />
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-600 tabular-nums w-16 text-right">
                      ${parseFloat(s.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
              <button type="submit" className="btn-primary flex-1 py-2.5" disabled={loading || !splitValid || !amountNum}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Adding...
                  </span>
                ) : 'Add expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
