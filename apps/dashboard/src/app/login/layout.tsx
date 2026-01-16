import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | Helvetia Cloud - Swiss Cloud Security',
  description:
    'Sign in to Helvetia Cloud, the premium Platform-as-a-Service hosted 100% in Switzerland. Deploy with confidence using enterprise-grade security and privacy.',
  keywords: [
    'helvetia cloud login',
    'swiss cloud hosting',
    'secure platform',
    'github oauth',
    'swiss hosting',
    'cloud platform',
  ],
  openGraph: {
    title: 'Login | Helvetia Cloud',
    description: 'Sign in to the premium Platform-as-a-Service hosted in Switzerland',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Login | Helvetia Cloud',
    description: 'Sign in to the premium Platform-as-a-Service hosted in Switzerland',
  },
  robots: {
    index: false, // Don't index login pages for security
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
