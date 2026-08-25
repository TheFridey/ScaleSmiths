import type { Metadata } from "next"
import { MotionProvider } from "@/components/MotionProvider"
import { SiteChrome } from "@/components/SiteChrome"
import { WebVitalsReporter } from "@/components/WebVitalsReporter"
import { CookiePreferences } from "@/components/CookiePreferences"
import { founders } from "@/lib/founders"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk"),
  title: {
    default: "ScaleSmiths | Business Growth & Engineering Company",
    template: "%s | ScaleSmiths",
  },
  description:
    "ScaleSmiths is a founder-led business growth and engineering company that identifies constraints, builds the right digital solution and supports ongoing improvement.",
  keywords: [
    "web development Nottingham",
    "web agency UK",
    "e-commerce development",
    "Next.js agency",
    "digital infrastructure",
    "web design Hucknall",
    "SEO agency Nottingham",
    "custom web app development UK",
    "business automation consultancy",
    "digital growth partnership",
  ],
  authors: [{ name: "ScaleSmiths" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://scalesmiths.co.uk",
    siteName: "ScaleSmiths",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: "Conversion websites, SEO, e-commerce, custom web apps and automation for ambitious UK businesses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: "Conversion websites, SEO, e-commerce, custom web apps and automation for ambitious UK businesses.",
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
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["Organization", "ProfessionalService"],
              "@id": "https://scalesmiths.co.uk/#org",
              "name": "ScaleSmiths",
              "url": "https://scalesmiths.co.uk",
              "description": "ScaleSmiths is a founder-led business growth and engineering company based in Hucknall, Nottingham. We identify commercial constraints, build the right websites, custom systems and automation, and support ongoing improvement.",
              "slogan": "Forge Your Digital Edge",
              "founder": founders.map((founder) => ({
                "@type": "Person",
                "@id": `https://scalesmiths.co.uk/about#${founder.slug}`,
                "name": founder.name,
                "jobTitle": founder.role.text,
                "url": "https://scalesmiths.co.uk/about",
              })),
              "address": { "@type": "PostalAddress", "addressLocality": "Hucknall", "addressRegion": "Nottinghamshire", "postalCode": "NG15", "addressCountry": "GB" },
              "geo": { "@type": "GeoCoordinates", "latitude": 53.0386, "longitude": -1.2042 },
              "areaServed": [
                { "@type": "City", "name": "Nottingham" },
                { "@type": "City", "name": "Hucknall" },
                { "@type": "AdministrativeArea", "name": "Nottinghamshire" },
                { "@type": "AdministrativeArea", "name": "East Midlands" },
                { "@type": "Country", "name": "United Kingdom" }
              ],
              "knowsAbout": ["Web Design", "Web Development", "E-Commerce Development", "Next.js Development", "AI Implementation", "Business Automation", "Conversion Optimisation", "SEO"],
              "serviceType": ["Business Growth Consultancy", "Web Design", "Web Development", "E-Commerce Development", "Custom Systems Engineering", "AI Implementation", "Business Automation", "Digital Growth Partnership"],
            }),
          }}
        />
      </head>
      <body className="bg-bg text-t1 font-dm">
        <WebVitalsReporter />
        <MotionProvider>
          <SiteChrome>{children}</SiteChrome>
          <CookiePreferences />
        </MotionProvider>
      </body>
    </html>
  )
}
