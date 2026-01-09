import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import Footer from '../components/Footer';
import Navigation from '../components/Navigation';
import { LanguageProvider } from '../lib/LanguageContext';
import QueryProvider from '../lib/QueryProvider';
import './tailwind.css';

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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-950 text-slate-200 font-sans antialiased min-h-screen">
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <LanguageProvider>
          <QueryProvider>
            <div className="flex flex-col min-h-screen bg-slate-950">
              <Navigation />
              <main
                id="main-content"
                className="container mx-auto px-6 pt-24 pb-12 grow animate-fade-in"
              >
                {children}
              </main>
              <Footer />
            </div>
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
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
