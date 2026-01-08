'use client';

import { API_BASE_URL } from '@/lib/config';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Globe,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GithubIcon } from '../../components/icons/GithubIcon';

interface UserInfo {
  id: string;
  username: string;
  avatarUrl: string;
  githubId: string;
  isGithubConnected: boolean;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        // Update local storage user if needed
        localStorage.setItem('user', JSON.stringify(data));
      } else if (res.status === 401) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Failed to fetch user info', err);
      toast.error('Failed to load user settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const disconnectGithub = async () => {
    if (
      !confirm(
        'Are you sure you want to disconnect GitHub? You will not be able to deploy from your repositories until you reconnect.',
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/github/disconnect`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('GitHub disconnected successfully');
        fetchUser();
      } else {
        toast.error('Failed to disconnect GitHub');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to API');
    }
  };

  const reconnectGithub = () => {
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
          <p className="text-slate-400 text-lg">Manage your account and integrations</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-8 relative z-10">
            <div className="relative">
              {user?.avatarUrl ? (
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-indigo-500/30">
                  <Image
                    src={user.avatarUrl}
                    alt={user.username}
                    width={96}
                    height={96}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center border-2 border-white/10 text-slate-500">
                  <Globe size={40} />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">{user?.username}</h2>
              <p className="text-slate-500 font-mono text-sm mt-1">ID: {user?.id}</p>
              <div className="flex gap-2 mt-4">
                <span className="px-3 py-1 bg-indigo-500/15 text-indigo-400 text-[11px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/20 shadow-sm">
                  Free Plan <span className="text-[10px]">🇨🇭</span>
                </span>
                <span className="px-3 py-1 bg-white/5 text-slate-400 text-[11px] font-bold uppercase tracking-wider rounded-full border border-white/10 shadow-sm">
                  Early Access
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* GitHub Integration */}
        <section className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-white/10 bg-white/2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white text-black rounded-2xl shadow-lg">
                <GithubIcon size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">GitHub Integration</h2>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Manage your connected GitHub account and repository access.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors hover:border-indigo-500/30 group/item">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 group-hover/item:border-indigo-500/20 transition-all shadow-inner">
                  <GithubIcon size={28} />
                </div>
                <div>
                  <div className="font-bold text-lg text-white flex items-center gap-3">
                    {user?.username}
                    {user?.isGithubConnected ? (
                      <span className="text-[10px] uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 font-bold shadow-sm">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest bg-rose-500/15 text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/20 flex items-center gap-1.5 font-bold shadow-sm">
                        <AlertCircle size={12} /> Disconnected
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-1 font-medium">
                    GitHub Account Linked
                  </div>
                </div>
              </div>

              {user?.isGithubConnected ? (
                <button
                  onClick={disconnectGithub}
                  className="w-full sm:w-auto text-sm text-rose-400 hover:text-white font-bold transition-all flex items-center justify-center gap-2 px-6 py-3 bg-rose-500/10 hover:bg-rose-500 rounded-xl border border-rose-500/20 shadow-md active:scale-95"
                >
                  <LogOut size={16} /> Disconnect
                </button>
              ) : (
                <button
                  onClick={reconnectGithub}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Reconnect
                </button>
              )}
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 flex items-start gap-5">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 mt-0.5 shadow-sm">
                <Shield size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg tracking-tight">
                  Managing Organization Access
                </h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed font-medium">
                  If you need to grant or revoke access to specific GitHub Organizations, you can do
                  so directly in your GitHub Personal Settings. This platform only requests the
                  permissions you explicitly grant.
                </p>
                <a
                  href={`https://github.com/settings/connections/applications/${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-all mt-5 bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20"
                >
                  Manage on GitHub
                  <ArrowUpRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-rose-500/5 border border-rose-500/20 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-rose-500/10 bg-rose-500/5">
            <h2 className="text-2xl font-bold text-rose-400 tracking-tight">Danger Zone</h2>
            <p className="text-rose-400/60 text-sm mt-1 font-medium">
              Irreversible actions for your account.
            </p>
          </div>
          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <div className="font-bold text-lg text-white">Delete Account</div>
                <div className="text-sm text-slate-500 mt-1 font-medium max-w-md">
                  Permanently remove all your data, services, and deployments. This cannot be
                  undone.
                </div>
              </div>
              <button
                className="w-full sm:w-auto p-4 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-md active:scale-95 border border-rose-500/20"
                title="Delete Account"
              >
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
