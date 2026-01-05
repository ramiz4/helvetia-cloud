'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Box, Cpu, GitBranch, Globe, Shield, Zap } from 'lucide-react';
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
    <div className="landing-page">
      {/* Hero Section */}
      <section className="min-h-[80vh] flex items-center justify-center text-center p-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] blur-[60px] -z-10" />

        <div className="max-w-[800px] z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="status-badge status-active mb-6 inline-block">{t.hero.badge}</span>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.1] mb-6 font-bold italic">
              <span className="bg-linear-to-br from-white to-slate-400 bg-clip-text text-transparent">
                {t.hero.titleLine1}
              </span>
              <br />
              <span className="text-primary">{t.hero.titleLine2}</span>
            </h1>
            <p className="text-xl text-(--text-primary) mb-4 leading-relaxed font-semibold">
              {t.hero.subtitle}
            </p>
            <p className="text-lg text-(--text-secondary) mb-10 leading-relaxed max-w-2xl mx-auto">
              {t.hero.description}
            </p>
            <div className="flex gap-4 justify-center">
              <a href="/login" className="btn btn-primary px-8 py-3 text-[1.1rem]">
                {t.hero.ctaPrimary} <ArrowRight size={20} />
              </a>
              <a
                href="https://github.com/ramiz4/helvetia-cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost px-8 py-3 text-[1.1rem]"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, idx) => (
            <div key={idx} className="card glass p-8">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl mb-3">{feature.title}</h3>
              <p className="text-(--text-secondary) leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="container pb-16">
        <div className="card bg-linear-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 py-16 px-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl mb-4">{t.ctaSection.title}</h2>
            <p className="text-(--text-secondary) mb-8 text-[1.1rem]">{t.ctaSection.subtitle}</p>
            <a href="/login" className="btn btn-primary">
              {t.ctaSection.button} <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-(--border-light) py-8 text-center text-(--text-muted) text-sm">
        <div className="container">
          <p>
            {t.footer.rights.replace('{year}', new Date().getFullYear().toString())}{' '}
            <span>🇨🇭 Hosted in Switzerland</span>
          </p>
        </div>
      </footer>

      <CookieBanner title={t.cookie.title} text={t.cookie.text} acceptText={t.cookie.accept} />
    </div>
  );
}
