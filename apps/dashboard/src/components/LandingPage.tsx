'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Box, Cpu, GitBranch, Globe, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from 'shared-ui';
import CookieBanner from './CookieBanner';

export default function LandingPage() {
  const { t } = useLanguage();

  const features = [
    {
      icon: <Zap size={24} />,
      title: t.features.zeroDowntime.title,
      description: t.features.zeroDowntime.desc,
    },
    {
      icon: <GitBranch size={24} />,
      title: t.features.gitIntegrated.title,
      description: t.features.gitIntegrated.desc,
    },
    {
      icon: <Shield size={24} />,
      title: t.features.secure.title,
      description: t.features.secure.desc,
    },
    {
      icon: <Globe size={24} />,
      title: t.features.global.title,
      description: t.features.global.desc,
    },
    {
      icon: <Cpu size={24} />,
      title: t.features.resource.title,
      description: t.features.resource.desc,
    },
    {
      icon: <Box size={24} />,
      title: t.features.container.title,
      description: t.features.container.desc,
    },
  ];

  return (
    <div className="relative overflow-hidden dark:bg-slate-950 bg-slate-50">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[1000px] h-[1000px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="min-h-[90vh] flex items-center justify-center text-center p-8 relative">
        <div className="max-w-[800px] z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-6 inline-block">
              {t.hero.badge}
            </span>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.1] mb-6 font-bold italic">
              <span className="bg-linear-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t.hero.titleLine1}
              </span>
              <br />
              <span className="text-indigo-500 font-extrabold drop-shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                {t.hero.titleLine2}
              </span>
            </h1>
            <p className="text-xl text-slate-700 dark:text-slate-200 mb-4 leading-relaxed font-semibold">
              {t.hero.subtitle}
            </p>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              {t.hero.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold cursor-pointer transition-all border border-transparent shadow-[0_8px_32px_rgba(99,102,241,0.3)] bg-indigo-500 text-white hover:bg-indigo-400 hover:-translate-y-1 active:scale-95 text-lg"
              >
                {t.hero.ctaPrimary} <ArrowRight size={20} className="ml-2" />
              </Link>
              <a
                href="https://github.com/ramiz4/helvetia-cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold cursor-pointer transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 active:scale-95 text-lg"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container max-w-7xl mx-auto px-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:-translate-y-2 transition-all duration-500 group shadow-xl dark:shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-8 border border-indigo-100 dark:border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 shadow-lg">
                  {feature.icon}
                </div>
                <h3 className="text-2xl mb-4 font-bold text-slate-900 dark:text-white tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">{feature.description}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="container max-w-7xl mx-auto px-8 pb-32">
        <div className="p-16 rounded-[40px] bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-slate-200 dark:border-white/10 text-center relative overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0%,transparent_70%)]" />
          <div className="relative z-10">
            <h2 className="text-5xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white">
              {t.ctaSection.title}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-12 text-xl max-w-2xl mx-auto">
              {t.ctaSection.subtitle}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-10 py-5 rounded-2xl font-bold cursor-pointer transition-all border border-transparent shadow-[0_8px_32px_rgba(99,102,241,0.3)] bg-indigo-500 text-white hover:bg-indigo-400 hover:-translate-y-1 active:scale-95 text-xl"
            >
              {t.ctaSection.button} <ArrowUpRight size={22} className="ml-2" />
            </Link>
          </div>
        </div>
      </section>

      <CookieBanner title={t.cookie.title} text={t.cookie.text} acceptText={t.cookie.accept} />
    </div>
  );
}
