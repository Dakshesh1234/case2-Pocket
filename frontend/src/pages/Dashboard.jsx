import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../api';
import NotificationBell from '../components/NotificationBell';

const GROUP_COLORS = ['from-indigo-500 to-purple-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-pink-500 to-rose-500', 'from-blue-500 to-cyan-500'];

function Skeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5">
          <div className="flex items-center gap-4">
            <div className="skeleton w-12 h-12 rounded-xl" />
            <div className="flex-1">
              <div className="skeleton h-5 w-32 mb-2" />
              <div className="skeleton h-3 w-48" />
            </div>
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get('/groups').then(res => setGroups(res.data.groups)).finally(() => setLoading(false));
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/groups', { name: newGroupName });
      setGroups(g => [res.data.group, ...g]);
      setNewGroupName('');
      setShowCreate(false);
      addToast(`Group "${res.data.group.name}" created!`);
      navigate(`/groups/${res.data.group.id}`);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create group', 'error');
    } finally {
      setCreating(false);
    }
  };

  const joinGroup = async (e) => {
    e.preventDefault();
    setJoining(true);
    try {
      const res = await api.post(`/groups/join/${joinCode.trim()}`);
      const group = res.data.group;
      setGroups(g => g.find(x => x.id === group.id) ? g : [group, ...g]);
      setJoinCode('');
      setShowJoin(false);
      addToast(`Joined "${group.name}"!`);
      navigate(`/groups/${group.id}`);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to join group', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm">
              P
            </div>
            <span className="font-bold text-lg text-gray-900">Pocket</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-600">{user?.name}</span>
            </div>
            <button onClick={logout} className="btn-ghost text-sm">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-gray-900">
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Manage your shared expenses below.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Your groups</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); }}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Join
            </button>
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); }}
              className="btn-primary text-sm py-1.5 px-3"
            >
              + New group
            </button>
          </div>
        </div>

        {/* Create Group Form */}
        {showCreate && (
          <div className="card mb-5 animate-fade-in-down">
            <h3 className="font-semibold text-gray-900 mb-3">Create a new group</h3>
            <form onSubmit={createGroup} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Group name (e.g. The Flat)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn-primary whitespace-nowrap" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </form>
          </div>
        )}

        {/* Join Group Form */}
        {showJoin && (
          <div className="card mb-5 animate-fade-in-down">
            <h3 className="font-semibold text-gray-900 mb-3">Join with invite code</h3>
            <form onSubmit={joinGroup} className="flex gap-2">
              <input
                className="input flex-1 uppercase font-mono tracking-widest text-center"
                placeholder="DEMO01"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={10}
                autoFocus
                required
              />
              <button type="submit" className="btn-primary whitespace-nowrap" disabled={joining}>
                {joining ? 'Joining...' : 'Join'}
              </button>
              <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </form>
          </div>
        )}

        {/* Groups list */}
        {loading ? (
          <Skeleton />
        ) : groups.length === 0 ? (
          <div className="text-center py-20 animate-fade-in-up">
            <div className="w-20 h-20 mx-auto mb-4 bg-indigo-50 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🏠</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No groups yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create a group or join one with an invite code.</p>
            <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2.5 rounded-xl">
              <span className="text-sm text-indigo-600">Try the demo group:</span>
              <code className="font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">DEMO01</code>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 stagger-children">
            {groups.map((group, i) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="card-hover p-5 block group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GROUP_COLORS[i % GROUP_COLORS.length]} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                    {group.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{group.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {group.member_count} member{group.member_count !== 1 ? 's' : ''} · {group.expense_count} expense{group.expense_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge-gray font-mono">{group.invite_code}</span>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
