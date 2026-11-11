import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Rentora',
  description: 'Rent collection, leases, maintenance and tenant communication in one place.'
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('rentora.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
