import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from 'shared-ui';
import AdminNavigation from '../components/AdminNavigation';
import './tailwind.css';

export const metadata: Metadata = {
  title: 'Helvetia Cloud | Admin Panel',
  description: 'Administrative control panel for Helvetia Cloud platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-slate-950 text-slate-200 font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <LanguageProvider>
          <AdminNavigation />
          <main id="main-content" className="min-h-screen pt-[70px]">
            {children}
          </main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#f8fafc',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '1rem',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: 'white',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: 'white',
                },
              },
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
