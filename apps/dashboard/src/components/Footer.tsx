'use client';

import { ExternalLink, Mail, ShieldCheck, Twitter } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from 'shared-ui';
import { GithubIcon } from './icons/GithubIcon';

export default function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 backdrop-blur-md pt-16 pb-8 mt-auto">
      <div className="container px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <Image
                  src="/logo.png"
                  alt={t.nav.logoAlt}
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                {t.nav.brand}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {t.footer.brandDesc}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/ramiz4/helvetia-cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-white transition-colors"
                title="GitHub"
              >
                <GithubIcon size={20} />
              </a>
              <a
                href="#"
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="mailto:support@helvetia.cloud"
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Email"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-6">
              {t.footer.product}
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link
                  href="/deployments"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.nav.deployments}
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.pricing}
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-6">
              {t.footer.resources}
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
                >
                  {t.footer.documentation} <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.blog}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.changelog}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.status}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-6">
              {t.footer.legalSwiss}
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.termsOfService}
                </a>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {t.footer.privacyPolicy}
                </Link>
              </li>
              <li>
                <div className="flex items-center gap-2 text-indigo-400/80 font-medium">
                  <ShieldCheck size={16} />
                  <span>{t.footer.gdprCompliant}</span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-base">🇨🇭</span>
                  <span>{t.footer.hostedInSwiss}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>{t.footer.rights.replace('{year}', currentYear.toString())}</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {t.common.allSystemsOperational}
            </span>
            <span>{t.common.version} 1.0.0-beta</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
