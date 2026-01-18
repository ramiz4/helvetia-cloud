'use client';

import { useLanguage } from 'shared-ui';
import { ShieldCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            {t.privacy.title}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {t.privacy.lastUpdated}: {t.privacy.effectiveDate}
        </p>
      </div>

      {/* Introduction */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.intro.title}
        </h2>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            {t.privacy.intro.welcome}
          </p>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              {t.privacy.intro.dataControllerTitle}
            </h3>
            <div className="text-slate-700 dark:text-slate-300 space-y-2">
              <p>{t.privacy.intro.companyName}</p>
              <p>{t.privacy.intro.address}</p>
              <p>{t.privacy.intro.email}: support@helvetia.cloud</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data We Collect */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.dataCollected.title}
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.privacy.dataCollected.accountInfo.title}
            </h3>
            <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
              {t.privacy.dataCollected.accountInfo.items.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.privacy.dataCollected.serviceData.title}
            </h3>
            <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
              {t.privacy.dataCollected.serviceData.items.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.privacy.dataCollected.technical.title}
            </h3>
            <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
              {t.privacy.dataCollected.technical.items.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How We Use Data */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.dataUse.title}
        </h2>
        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
          {t.privacy.dataUse.items.map((item: string, idx: number) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Data Storage & Processing */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.dataStorage.title}
        </h2>
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6 mb-4">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed flex items-center gap-2">
            <span className="text-2xl">🇨🇭</span>
            {t.privacy.dataStorage.swissHosting}
          </p>
        </div>
        <div className="space-y-4 text-slate-700 dark:text-slate-300">
          <p>{t.privacy.dataStorage.retention}</p>
          <p>{t.privacy.dataStorage.security}</p>
        </div>
      </section>

      {/* Data Sharing */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.dataSharing.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300 mb-4">
          {t.privacy.dataSharing.intro}
        </p>
        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
          {t.privacy.dataSharing.items.map((item: string, idx: number) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6 mt-4">
          <p className="text-slate-700 dark:text-slate-300 font-semibold">
            {t.privacy.dataSharing.noSelling}
          </p>
        </div>
      </section>

      {/* User Rights (GDPR) */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.userRights.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300 mb-4">
          {t.privacy.userRights.intro}
        </p>
        <div className="space-y-4">
          {t.privacy.userRights.rights.map((right: { title: string; description: string }, idx: number) => (
            <div key={idx} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {right.title}
              </h3>
              <p className="text-slate-700 dark:text-slate-300">{right.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-slate-700 dark:text-slate-300">
            {t.privacy.userRights.exercise}
          </p>
        </div>
      </section>

      {/* Cookies & Tracking */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.cookies.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300 mb-4">
          {t.privacy.cookies.intro}
        </p>
        <div className="space-y-4">
          {t.privacy.cookies.types.map((type: { name: string; description: string }, idx: number) => (
            <div key={idx}>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {type.name}
              </h3>
              <p className="text-slate-700 dark:text-slate-300">{type.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Children's Privacy */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.children.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300">
          {t.privacy.children.content}
        </p>
      </section>

      {/* International Data Transfers */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.international.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300">
          {t.privacy.international.content}
        </p>
      </section>

      {/* Changes to Privacy Policy */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.changes.title}
        </h2>
        <p className="text-slate-700 dark:text-slate-300">
          {t.privacy.changes.content}
        </p>
      </section>

      {/* Contact & Complaints */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          {t.privacy.contact.title}
        </h2>
        <div className="space-y-4 text-slate-700 dark:text-slate-300">
          <p>{t.privacy.contact.intro}</p>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
            <p className="font-semibold mb-2">{t.privacy.contact.email}: support@helvetia.cloud</p>
            <p>{t.privacy.contact.address}</p>
          </div>
          <p>{t.privacy.contact.complaint}</p>
        </div>
      </section>

      {/* Compliance Badges */}
      <div className="flex flex-wrap gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            GDPR Compliant
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            DSGVO Compliant
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
          <span className="text-xl">🇨🇭</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Swiss Data Protection Law
          </span>
        </div>
      </div>
    </div>
  );
}
