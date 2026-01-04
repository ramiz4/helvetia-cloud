'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Box, Shield, Zap, Globe, GitBranch, Cpu, ArrowUpRight } from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: <Zap size={24} />,
      title: 'Zero Downtime',
      description: 'Deploy updates without dropping a single active connection. Seamless transitions every time.'
    },
    {
      icon: <GitBranch size={24} />,
      title: 'Git Integrated',
      description: 'Push to your branch and watch it deploy automatically. Full support for GitHub webhooks.'
    },
    {
      icon: <Shield size={24} />,
      title: 'Secure by Design',
      description: 'Isolated build environments and strict resource limits keep your applications safe.'
    },
    {
      icon: <Globe size={24} />,
      title: 'Global Edge',
      description: 'Ready for global scale with integrated custom domain support and edge routing.'
    },
    {
      icon: <Cpu size={24} />,
      title: 'Resource Control',
      description: 'Fine-grained control over CPU and memory allocation for each of your services.'
    },
    {
      icon: <Box size={24} />,
      title: 'Container Native',
      description: 'Built on top of Docker for maximum compatibility and portability.'
    }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Gradients */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: -1
        }} />

        <div style={{ maxWidth: '800px', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="status-badge status-active" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
              v1.0 Public Beta
            </span>
            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              lineHeight: 1.1,
              marginBottom: '1.5rem',
              backgroundImage: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Deploy with<br />
              <span style={{ color: '#6366f1', WebkitTextFillColor: '#6366f1' }}>Complete Confidence</span>
            </h1>
            <p style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              marginBottom: '2.5rem',
              lineHeight: 1.6
            }}>
              Helvetia Cloud is the modern Platform-as-a-Service for developers who want
              the power of Kubernetes with the simplicity of Heroku.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a href="/login" className="btn btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1.1rem' }}>
                Get Started <ArrowRight size={20} />
              </a>
              <a href="https://github.com/ramiz4/helvetia-cloud" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '0.8rem 2rem', fontSize: '1.1rem' }}>
                View Source
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container" style={{ paddingBottom: '6rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}
        >
          {features.map((feature, idx) => (
            <div key={idx} className="card glass" style={{ padding: '2rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{feature.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="container" style={{ paddingBottom: '4rem' }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          padding: '4rem 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Ready to deploy?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>
              Join thousands of developers building on Helvetia Cloud.
            </p>
            <a href="/login" className="btn btn-primary">
              Start Deploys Now <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <footer style={{
        borderTop: '1px solid var(--border-light)',
        padding: '2rem 0',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.9rem'
      }}>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Helvetia Cloud. Open source under MIT License.</p>
        </div>
      </footer>
    </div>
  );
}
