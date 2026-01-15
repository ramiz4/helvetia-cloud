'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Activity,
  BarChart3,
  Flag,
  Lock,
  LogOut,
  Server,
  Settings,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { isAdmin, loading, user, logout } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-red-500 rounded-full animate-spin-fast" />
      </div>
    );
  }

  if (!isAdmin || !user) return null;

  const adminCards = [
    {
      title: 'Server Setup',
      description: 'Generate deployment scripts for VPS',
      icon: Server,
      href: '/server-setup',
      color: 'blue',
      stats: 'Active',
    },
    {
      title: 'Feature Flags',
      description: 'Manage feature toggles and A/B testing',
      icon: Flag,
      href: '/feature-flags',
      color: 'indigo',
      stats: 'Active',
    },
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      icon: Users,
      href: '/users',
      color: 'emerald',
      stats: 'Coming Soon',
    },
    {
      title: 'System Analytics',
      description: 'Monitor platform performance and usage',
      icon: BarChart3,
      href: '/analytics',
      color: 'blue',
      stats: 'Coming Soon',
    },
    {
      title: 'Security Settings',
      description: 'Configure security policies and access control',
      icon: Lock,
      href: '/security',
      color: 'red',
      stats: 'Coming Soon',
    },
    {
      title: 'Activity Logs',
      description: 'View system and user activity logs',
      icon: Activity,
      href: '/logs',
      color: 'purple',
      stats: 'Coming Soon',
    },
    {
      title: 'Platform Settings',
      description: 'Configure global platform settings',
      icon: Settings,
      href: '/settings',
      color: 'orange',
      stats: 'Coming Soon',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 py-8 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-[24px] bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 shadow-inner">
              <Shield size={32} />
            </div>
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                Admin Dashboard
              </h1>
              <p className="text-slate-400 text-lg font-medium mt-2">
                Welcome back, {user?.username}
              </p>
            </div>
            <button
              onClick={logout}
              className="ml-auto flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-red-500/50 hover:bg-red-500/10 transition-all font-bold group"
            >
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
              <span>Logout</span>
            </button>
          </div>

          {/* Warning Banner */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-red-400 font-bold mb-1">Administrative Access</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                You are currently in the administrative control panel. All actions performed here
                are logged and monitored. Exercise caution when making changes to system
                configurations.
              </p>
            </div>
          </div>
        </div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.map((card, idx) => {
            const Icon = card.icon;
            const isActive = card.stats === 'Active';
            const colorClasses = {
              indigo: {
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20',
                text: 'text-indigo-400',
                hover: 'hover:border-indigo-500/50',
              },
              emerald: {
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
                text: 'text-emerald-400',
                hover: 'hover:border-emerald-500/50',
              },
              blue: {
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                text: 'text-blue-400',
                hover: 'hover:border-blue-500/50',
              },
              red: {
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
                text: 'text-red-400',
                hover: 'hover:border-red-500/50',
              },
              purple: {
                bg: 'bg-purple-500/10',
                border: 'border-purple-500/20',
                text: 'text-purple-400',
                hover: 'hover:border-purple-500/50',
              },
              orange: {
                bg: 'bg-orange-500/10',
                border: 'border-orange-500/20',
                text: 'text-orange-400',
                hover: 'hover:border-orange-500/50',
              },
            };

            const colors = colorClasses[card.color as keyof typeof colorClasses];

            return isActive ? (
              <Link
                key={idx}
                href={card.href}
                className={`p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-3xl border ${colors.border} shadow-2xl transition-all duration-300 ${colors.hover} hover:-translate-y-2 cursor-pointer group relative overflow-hidden`}
              >
                <div
                  className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div
                    className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center mb-6 border ${colors.border} group-hover:scale-110 transition-transform duration-500 shadow-lg`}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="text-2xl mb-3 font-bold text-white tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed text-sm mb-4">{card.description}</p>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}
                    >
                      {card.stats}
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div
                key={idx}
                className={`p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-3xl border ${colors.border} shadow-2xl transition-all duration-300 opacity-60 cursor-not-allowed group relative overflow-hidden`}
              >
                <div
                  className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div
                    className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center mb-6 border ${colors.border} group-hover:scale-110 transition-transform duration-500 shadow-lg`}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="text-2xl mb-3 font-bold text-white tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed text-sm mb-4">{card.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-500 border border-slate-700">
                      {card.stats}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-16 p-6 rounded-2xl bg-slate-900/40 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-bold mb-1">Need Help?</h4>
              <p className="text-slate-400 text-sm">
                Contact the platform administrator or refer to the documentation.
              </p>
            </div>
            <a
              href="#"
              className="px-6 py-3 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all font-medium"
            >
              View Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
