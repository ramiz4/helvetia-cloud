import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from 'shared-ui';
import CookieBannerWrapper from '../components/CookieBannerWrapper';
import Footer from '../components/Footer';
import Navigation from '../components/Navigation';
import { TermsAcceptanceWrapper } from '../components/TermsAcceptanceWrapper';
import { OrganizationProvider } from '../lib/OrganizationContext';
import QueryProvider from '../lib/QueryProvider';
import { ThemeProvider } from '../lib/ThemeContext';
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
        className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans antialiased min-h-screen transition-colors duration-300"
        suppressHydrationWarning
      >
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              <OrganizationProvider>
                <TermsAcceptanceWrapper>
                  <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
                    <Navigation />
                    <main
                      id="main-content"
                      className="container mx-auto px-6 pt-24 pb-12 grow animate-fade-in"
                    >
                      {children}
                    </main>
                    <Footer />
                  </div>
                </TermsAcceptanceWrapper>
              </OrganizationProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  className:
                    'bg-slate-50/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-50 ' +
                    'backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 ' +
                    'rounded-2xl',
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
              <CookieBannerWrapper />
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
