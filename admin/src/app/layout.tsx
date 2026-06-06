import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "ScaleSmiths Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-t1">{children}</body>
    </html>
  )
}
