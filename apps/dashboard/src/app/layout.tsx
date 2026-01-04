import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helvetia Cloud | Platform-as-a-Service',
  description: 'Automated deployment platform for web applications.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning={true}>
        <div className="container">
          <header>
            <div className="logo">HELVETIA CLOUD</div>
            <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <a href="/" style={{ color: 'var(--text-secondary)' }}>
                Dashboard
              </a>
              <a href="/new" className="btn btn-primary">
                New Service
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
