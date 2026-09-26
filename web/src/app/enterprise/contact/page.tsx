import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { EnterpriseEnquiryForm } from "@/components/EnterpriseEnquiryForm"
import { enterpriseContactCopy, metadataForEnterpriseContactPage } from "@/lib/enterprise-contact-page"
import { ENTERPRISE_CONTACT_PATH } from "@/lib/enterprise-enquiry"

export const metadata = metadataForEnterpriseContactPage()

export default function EnterpriseContactPage() {
  return (
    <main className="relative overflow-hidden px-6 py-12 md:px-12 md:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(37,99,235,0.14),_transparent_50%),radial-gradient(ellipse_at_90%_10%,_rgba(15,23,42,0.55),_transparent_45%),linear-gradient(180deg,_rgba(8,8,8,0.2)_0%,_transparent_35%)]"
      />
      <div className="mx-auto max-w-[780px]">
        <PageBreadcrumbs
          className="mb-8"
          items={[
            { name: "Home", path: "/" },
            { name: "Enterprise", path: "/enterprise" },
            { name: "Discovery enquiry", path: ENTERPRISE_CONTACT_PATH },
          ]}
        />
        <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{enterpriseContactCopy.eyebrow}</p>
        <p className="mt-3 font-syne text-[clamp(2.5rem,6vw,3.75rem)] font-extrabold leading-none tracking-[-0.04em] text-t1">
          {enterpriseContactCopy.brand}
        </p>
        <h1 className="mt-5 max-w-[24ch] font-syne text-xl font-bold tracking-[-0.02em] text-t1 md:text-2xl">
          {enterpriseContactCopy.title}
        </h1>
        <p className="mt-3 max-w-[58ch] font-dm text-sm leading-relaxed text-t2 md:text-base">{enterpriseContactCopy.lede}</p>
        <div className="mt-10 border-t border-b1 pt-10">
          <EnterpriseEnquiryForm />
        </div>
      </div>
    </main>
  )
}
