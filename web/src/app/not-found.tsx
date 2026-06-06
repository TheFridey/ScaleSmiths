import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <div className="font-syne text-[80px] font-extrabold text-t3 leading-none mb-4">404</div>
      <h1 className="font-syne text-2xl font-bold mb-3">Page not found.</h1>
      <p className="font-dm text-t2 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" prefetch={false} className="btn-primary font-dm text-sm">Back to home</Link>
    </div>
  )
}
