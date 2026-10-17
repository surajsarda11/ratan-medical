import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ratan Medical Hall | Booking & Settlement Manager',
  description: 'Internal medicine booking, purchase reconciliation and customer settlement manager for Ratan Medical Hall.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
