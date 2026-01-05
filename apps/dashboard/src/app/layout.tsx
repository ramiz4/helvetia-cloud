import type { Metadata } from 'next';
import Navigation from '../components/Navigation';
import { LanguageProvider } from '../lib/LanguageContext';
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>
          <div className="app-shell">
            <Navigation />
            <main className="main-content container animate-fade-in">{children}</main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
