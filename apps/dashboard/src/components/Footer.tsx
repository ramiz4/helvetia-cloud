'use client';

import { ExternalLink, Mail, ShieldCheck, Twitter } from 'lucide-react';
import Image from 'next/image';
import { GithubIcon } from './icons/GithubIcon';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/10 bg-slate-900/50 backdrop-blur-md pt-16 pb-8 mt-auto">
      <div className="container px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <Image
                  src="/logo.png"
                  alt="Helvetia Cloud Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-display">
                HELVETIA
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              The modern Platform-as-a-Service for developers who want the power of Kubernetes with
              the simplicity of Heroku. Hosted entirely in Switzerland.
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
                className="text-slate-500 hover:text-white transition-colors"
                title="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="mailto:support@helvetia.cloud"
                className="text-slate-500 hover:text-white transition-colors"
                title="Email"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
              Product
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a href="/" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/deployments"
                  className="text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Deployments
                </a>
              </li>
              <li>
                <a href="/new" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  New Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
              Resources
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a
                  href="#"
                  className="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2"
                >
                  Documentation <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Changelog
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Status
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
              Legal & Swiss Made
            </h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <div className="flex items-center gap-2 text-indigo-400/80 font-medium">
                  <ShieldCheck size={16} />
                  <span>DSGVO / GDPR Compliant</span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-base">🇨🇭</span>
                  <span>Hosted in Switzerland</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© {currentYear} Helvetia Cloud. Open source under MIT License.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              All systems operational
            </span>
            <span>Version 1.0.0-beta</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
