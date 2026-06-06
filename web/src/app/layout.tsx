import type { Metadata } from "next"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { SmoothScroll } from "@/components/SmoothScroll"
import { ScrollProgress } from "@/components/ScrollProgress"
import { PageTransition } from "@/components/PageTransition"
import { Cursor } from "@/components/Cursor"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.io"),
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
    url: "https://scalesmiths.io",
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
              "@type": "Organization",
              "@id": "https://scalesmiths.io/#org",
              "name": "ScaleSmiths",
              "url": "https://scalesmiths.io",
              "description": "Strategy-led web development and digital infrastructure agency based in Hucknall, Nottinghamshire, UK.",
              "slogan": "Forge Your Digital Edge",
              "foundingDate": "2026",
              "founders": [{ "@type": "Person", "name": "Rhys" }, { "@type": "Person", "name": "Trevor Newton-Bradley" }],
              "address": { "@type": "PostalAddress", "addressLocality": "Hucknall", "addressRegion": "Nottinghamshire", "postalCode": "NG15", "addressCountry": "GB" },
              "areaServed": [{ "@type": "Country", "name": "United Kingdom" }],
              "serviceType": ["Web Development", "Digital Strategy", "E-Commerce Development", "SaaS Development"],
              "priceRange": "£4500–£35000+"
            }),
          }}
        />
      </head>
      <body className="bg-bg text-t1 font-dm">
        <Cursor />
        <ScrollProgress />
        <SmoothScroll>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-acc focus:text-white focus:rounded-md">
            Skip to content
          </a>
          <Nav />
          <PageTransition>
            <main id="main">{children}</main>
          </PageTransition>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  )
}
