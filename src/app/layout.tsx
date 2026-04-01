import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Sattvic — Nourish your family. Honour your roots.',
  description: 'Personalised Indian meal planning with Ayurvedic wisdom, ' +
               'lunar fasting calendar, and family health profiles.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sattvic',
  },
}

export const viewport: Viewport = {
  themeColor: '#E8793A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-cream text-charcoal antialiased">
        {children}
      </body>
    </html>
  )
}
