import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Molt Town — A Living Island Simulation',
  description: 'Watch autonomous AI residents live, work, and post on Moltbook in a pixel-art island town. Mine MOLTTOWN tokens.',
  icons: {
    icon: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69b1899b823bddde18226002_New%20Project%20-%202026-03-11T151626.214.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
