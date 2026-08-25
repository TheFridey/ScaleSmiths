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
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://scalesmiths.co.uk",
    siteName: "ScaleSmiths",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: "Strategy, websites, custom systems and ongoing digital growth for ambitious businesses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: "Strategy, websites, custom systems and ongoing digital growth for ambitious businesses.",
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
              "description": "ScaleSmiths is a founder-led digital growth and engineering company based in Hucknall, Nottingham. We help businesses identify growth constraints, build websites and custom systems, automate workflows, and manage ongoing digital improvement.",
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
              "knowsAbout": ["Digital Growth Strategy", "Web Design", "Web Development", "E-Commerce Development", "AI Implementation", "Business Automation", "Conversion Optimisation", "SEO"],
              "serviceType": ["Digital Growth Partnership", "Web Design", "Web Development", "E-Commerce Development", "AI Implementation Consultancy", "Business Automation Consultancy", "SaaS Development"],
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
