import type { Metadata } from "next"
import { Inter, Syne } from "next/font/google"
import { MotionProvider } from "@/components/MotionProvider"
import { SiteChrome } from "@/components/SiteChrome"
import { WebVitalsReporter } from "@/components/WebVitalsReporter"
import { CookiePreferences } from "@/components/CookiePreferences"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { JsonLd } from "@/components/JsonLd"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildOrganizationSchema, buildWebsiteSchema } from "@/lib/structured-data"
import "./globals.css"

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["500", "600", "700", "800"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
})

const siteUrl = siteBaseUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ScaleSmiths | Digital Growth, Websites & Custom Systems",
    template: "%s | ScaleSmiths",
  },
  description:
    "ScaleSmiths helps ambitious businesses find growth constraints, build the right digital solution, and keep improving through websites, local growth, custom systems, automation and ongoing digital partnership.",
  keywords: [
    "digital growth partnership",
    "web development Nottingham",
    "web design Hucknall",
    "local business growth",
    "custom web app development UK",
    "e-commerce development",
    "Next.js agency",
    "digital infrastructure",
    "SEO agency Nottingham",
    "business automation consultancy",
  ],
  authors: [{ name: "ScaleSmiths" }],
  // Site-wide defaults only. Page titles, descriptions and URLs come from each route (see
  // lib/page-metadata.ts) so inner pages never inherit the homepage's social copy or URL.
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "ScaleSmiths",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: "/brand/scalesmiths-mark.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable}`}>
      <head>
        <JsonLd data={[buildOrganizationSchema(siteUrl), buildWebsiteSchema(siteUrl)]} />
      </head>
      <body className="bg-bg text-t1 font-dm antialiased">
        <GoogleAnalytics />
        <WebVitalsReporter />
        <MotionProvider>
          <SiteChrome>{children}</SiteChrome>
          <CookiePreferences />
        </MotionProvider>
      </body>
    </html>
  )
}
