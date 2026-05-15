import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../api';
import AddExpense from './AddExpense';
import BalanceView from '../components/BalanceView';
import ExpenseList from '../components/ExpenseList';
import AuditLog from '../components/AuditLog';
import SpendingStats from '../components/SpendingStats';
import NotificationBell from '../components/NotificationBell';
import SettleUpModal from '../components/SettleUpModal';

const AVATAR_COLORS = ['bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700'];

function MembersTab({ members, group, currentUserId }) {
  const { addToast } = useToast();

  const copyCode = () => {
    navigator.clipboard.writeText(group.invite_code);
    addToast('Invite code copied!', 'info');
  };
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${group.invite_code}`);
    addToast('Invite link copied!', 'info');
  };

  return (
    <div className="space-y-4 stagger-children">
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">Invite people</h3>
        <p className="text-sm text-gray-500 mb-4">Share the code or link — anyone with an account can join.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-5 py-4">
            <div>
              <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-0.5">Invite code</p>
              <p className="text-3xl font-bold font-mono tracking-[0.3em] text-indigo-700">{group.invite_code}</p>
            </div>
            <button onClick={copyCode} className="btn-primary text-sm ml-4">Copy</button>
          </div>
          <button onClick={copyLink} className="btn-secondary text-sm flex items-center gap-2 justify-center px-5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy invite link
          </button>
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">{members.length} member{members.length !== 1 ? 's' : ''}</h3>
        <div className="divide-y divide-gray-50">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                {m.name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
              {String(m.id) === String(currentUserId) && <span className="badge-indigo text-xs">You</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function exportCSV(expenses, members, groupName) {
  const headers = ['Date', 'Description', 'Amount', 'Paid By', 'Category', ...members.map(m => `${m.name} share`)];
  const rows = expenses.map(e => {
    const date = new Date(e.created_at).toLocaleDateString('en-US');
    const memberSplits = members.map(m => {
      const split = e.splits?.find(s => String(s.userId) === String(m.id));
      return split ? parseFloat(split.amount).toFixed(2) : '0.00';
    });
    return [date, e.description, parseFloat(e.amount).toFixed(2), e.paid_by_name, e.category || 'general', ...memberSplits];
  });
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${groupName.replace(/\s+/g, '_')}_expenses.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SkeletonGroupDetail() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="skeleton h-24 rounded-2xl mb-6" />
      <div className="flex gap-4 mb-6">
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
      </div>
      <div className="skeleton h-48 rounded-2xl mb-4" />
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}

const TABS = [
  { key: 'expenses', label: 'Expenses', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { key: 'balances', label: 'Balances', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg> },
  { key: 'stats', label: 'Stats', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { key: 'members', label: 'Members', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
  { key: 'activity', label: 'Activity', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({ netBalances: {}, transactions: [] });
  const [auditLog, setAuditLog] = useState([]);
  const [tab, setTab] = useState('expenses');
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);

  const fetchAll = useCallback(async () => {
    const [groupRes, membersRes, expensesRes, balancesRes, auditRes] = await Promise.all([
      api.get(`/groups/${id}`),
      api.get(`/groups/${id}/members`),
      api.get(`/groups/${id}/expenses`),
      api.get(`/groups/${id}/balances`),
      api.get(`/groups/${id}/audit`),
    ]);
    setGroup(groupRes.data.group);
    setMembers(membersRes.data.members);
    setExpenses(expensesRes.data.expenses);
    setBalances(balancesRes.data);
    setAuditLog(auditRes.data.log);
  }, [id]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const handleSettle = async (fromUser, toUser, amount) => {
    const res = await api.post(`/groups/${id}/settle`, { from_user: fromUser, to_user: toUser, amount });
    setBalances({ netBalances: res.data.netBalances, transactions: res.data.transactions });
    const auditRes = await api.get(`/groups/${id}/audit`);
    setAuditLog(auditRes.data.log);
    addToast(`Settled $${amount.toFixed(2)}!`, 'success');
  };

  const handleDeleteExpense = async (expenseId) => {
    await api.delete(`/expenses/${expenseId}`);
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    const [balancesRes, auditRes] = await Promise.all([
      api.get(`/groups/${id}/balances`),
      api.get(`/groups/${id}/audit`),
    ]);
    setBalances(balancesRes.data);
    setAuditLog(auditRes.data.log);
    addToast('Expense deleted', 'info');
  };

  const handleExpenseAdded = async () => {
    setShowAddExpense(false);
    const [expensesRes, balancesRes, auditRes] = await Promise.all([
      api.get(`/groups/${id}/expenses`),
      api.get(`/groups/${id}/balances`),
      api.get(`/groups/${id}/audit`),
    ]);
    setExpenses(expensesRes.data.expenses);
    setBalances(balancesRes.data);
    setAuditLog(auditRes.data.log);
    addToast('Expense added!', 'success');
  };

  const handleExportCSV = () => {
    exportCSV(expenses, members, group.name);
    addToast('CSV exported!', 'info');
  };

  const myBalance = balances.netBalances[user?.id]?.amount ?? 0;

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="skeleton w-5 h-5 rounded" />
          <div className="skeleton h-5 w-32 rounded" />
        </div>
      </header>
      <SkeletonGroupDetail />
    </div>
  );

  if (!group) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <span className="text-4xl">🔍</span>
      <p className="text-gray-500 font-medium">Group not found</p>
      <Link to="/" className="btn-primary text-sm">Back to dashboard</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {expenses.length > 0 && (
              <button onClick={handleExportCSV} className="btn-ghost text-xs p-2" title="Export CSV">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
            )}
            <button onClick={() => setShowAddExpense(true)} className="btn-primary text-sm py-1.5">
              + Add expense
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Balance card */}
        <div className={`rounded-2xl p-5 mb-6 animate-fade-in-up ${
          myBalance > 0.01 ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100'
          : myBalance < -0.01 ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-100'
          : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your balance</p>
              <p className={`text-3xl font-bold tabular-nums mt-1 ${
                myBalance > 0.01 ? 'text-emerald-700'
                : myBalance < -0.01 ? 'text-red-600'
                : 'text-gray-400'
              }`}>
                {myBalance > 0.01 ? '+' : myBalance < -0.01 ? '-' : ''}${Math.abs(myBalance).toFixed(2)}
              </p>
              <div className={`inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                myBalance > 0.01 ? 'bg-emerald-100 text-emerald-700'
                : myBalance < -0.01 ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500'
              }`}>
                {myBalance > 0.01 ? "You're owed" : myBalance < -0.01 ? 'You owe' : 'All settled'}
              </div>
            </div>
            {balances.transactions?.length > 0 && (
              <button
                onClick={() => setShowSettleUp(true)}
                className="btn-success flex items-center gap-2 shadow-md hover:shadow-lg whitespace-nowrap px-5 py-2.5 text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Settle up
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-px -mx-4 px-4 custom-scroll">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">
          {tab === 'expenses' && (
            <ExpenseList expenses={expenses} currentUserId={user?.id} onDelete={handleDeleteExpense} />
          )}
          {tab === 'balances' && (
            <BalanceView
              netBalances={balances.netBalances}
              transactions={balances.transactions}
              currentUserId={user?.id}
              onSettle={handleSettle}
            />
          )}
          {tab === 'stats' && (
            <SpendingStats expenses={expenses} members={members} currentUserId={user?.id} />
          )}
          {tab === 'members' && (
            <MembersTab members={members} group={group} currentUserId={user?.id} />
          )}
          {tab === 'activity' && (
            <AuditLog log={auditLog} />
          )}
        </div>
      </main>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpense
          groupId={id}
          members={members}
          currentUserId={user?.id}
          onClose={() => setShowAddExpense(false)}
          onAdded={handleExpenseAdded}
        />
      )}

      {/* Settle Up Modal */}
      {showSettleUp && (
        <SettleUpModal
          transactions={balances.transactions}
          currentUserId={user?.id}
          onClose={() => setShowSettleUp(false)}
          onSettle={handleSettle}
        />
      )}
    </div>
  );
}
