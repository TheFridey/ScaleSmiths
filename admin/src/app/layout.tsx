import type { Metadata } from "next"
import "./globals.css"
import { InstallAppProvider } from "@/components/command-centre/InstallAppProvider"
import type { Viewport } from "next"

export const metadata: Metadata = {
  title: { default: "ScaleSmiths Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ScaleSmiths",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/brand/favicon.png", shortcut: "/brand/favicon.png", apple: "/brand/favicon.png" },
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111214",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-t1">
        <InstallAppProvider>{children}</InstallAppProvider>
      </body>
    </html>
  )
}
