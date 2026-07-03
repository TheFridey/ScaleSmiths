import type { Metadata } from "next"
import { SmoothScroll } from "@/components/SmoothScroll"
import { ScrollProgress } from "@/components/ScrollProgress"
import { Cursor } from "@/components/Cursor"
import { SiteChrome } from "@/components/SiteChrome"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk"),
  title: {
    default: "ScaleSmiths | Strategy-Led Web Development | Hucknall, UK",
    template: "%s | ScaleSmiths",
  },
  description:
    "ScaleSmiths builds websites, e-commerce platforms and custom digital infrastructure for growth-focused businesses across the UK. Based in Hucknall, Nottinghamshire.",
  keywords: [
    "web development Nottingham",
    "web agency UK",
    "e-commerce development",
    "Next.js agency",
    "digital infrastructure",
    "web design Hucknall",
  ],
  authors: [{ name: "ScaleSmiths" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://scalesmiths.co.uk",
    siteName: "ScaleSmiths",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description:
      "Strategy-led web development for ambitious UK businesses. Foundation from £4,500.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: "Strategy-led web development for ambitious UK businesses.",
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
              "description": "ScaleSmiths is a web design and web development agency and AI implementation & business automation consultancy based in Hucknall, Nottingham. We build websites, e-commerce platforms and automation systems engineered to generate enquiries, sales and recurring revenue.",
              "slogan": "Forge Your Digital Edge",
              "foundingDate": "2026",
              "founders": [{ "@type": "Person", "name": "Rhys" }, { "@type": "Person", "name": "Trevor Newton-Bradley" }],
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
              "serviceType": ["Web Design Agency", "Web Development Agency", "E-Commerce Development", "AI Implementation Consultancy", "Business Automation Consultancy", "SaaS Development"],
              "priceRange": "£4500–£35000+"
            }),
          }}
        />
      </head>
      <body className="bg-bg text-t1 font-dm">
        <Cursor />
        <ScrollProgress />
        <SmoothScroll>
          <SiteChrome>{children}</SiteChrome>
        </SmoothScroll>
      </body>
    </html>
  )
}
