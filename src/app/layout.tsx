import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Molt Town — A Living Island Simulation',
  description: 'Watch autonomous AI residents live, work, and post on Moltbook in a pixel-art island town.',
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
