'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Box, Cpu, GitBranch, Globe, Shield, Zap } from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: <Zap size={24} />,
      title: 'Zero Downtime',
      description:
        'Deploy updates without dropping a single active connection. Seamless transitions every time.',
    },
    {
      icon: <GitBranch size={24} />,
      title: 'Git Integrated',
      description:
        'Push to your branch and watch it deploy automatically. Full support for GitHub webhooks.',
    },
    {
      icon: <Shield size={24} />,
      title: 'Secure by Design',
      description:
        'Isolated build environments and strict resource limits keep your applications safe.',
    },
    {
      icon: <Globe size={24} />,
      title: 'Global Edge',
      description: 'Ready for global scale with integrated custom domain support and edge routing.',
    },
    {
      icon: <Cpu size={24} />,
      title: 'Resource Control',
      description: 'Fine-grained control over CPU and memory allocation for each of your services.',
    },
    {
      icon: <Box size={24} />,
      title: 'Container Native',
      description: 'Built on top of Docker for maximum compatibility and portability.',
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
            <span className="status-badge status-active mb-6 inline-block">v1.0 Public Beta</span>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.1] mb-6 bg-linear-to-br from-white to-slate-400 bg-clip-text text-transparent italic font-bold">
              Deploy with
              <br />
              <span className="text-primary">Complete Confidence</span>
            </h1>
            <p className="text-xl text-(--text-secondary) mb-10 leading-relaxed">
              Helvetia Cloud is the modern Platform-as-a-Service for developers who want the power
              of Kubernetes with the simplicity of Heroku.
            </p>
            <div className="flex gap-4 justify-center">
              <a href="/login" className="btn btn-primary px-8 py-3 text-[1.1rem]">
                Get Started <ArrowRight size={20} />
              </a>
              <a
                href="https://github.com/ramiz4/helvetia-cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost px-8 py-3 text-[1.1rem]"
              >
                View Source
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
            <h2 className="text-4xl mb-4">Ready to deploy?</h2>
            <p className="text-(--text-secondary) mb-8 text-[1.1rem]">
              Join thousands of developers building on Helvetia Cloud.
            </p>
            <a href="/login" className="btn btn-primary">
              Start Deploys Now <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-(--border-light) py-8 text-center text-(--text-muted) text-sm">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Helvetia Cloud. Open source under MIT License.</p>
        </div>
      </footer>
    </div>
  );
}
