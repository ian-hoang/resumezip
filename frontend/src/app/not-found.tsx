import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f5f5] px-4">
      <div className="text-center max-w-md">
        <h1 className="text-[180px] font-light text-[#1a1a2e] leading-none">404</h1>
        <p className="text-[#333] text-lg mb-8 mt-4">
          The page you were looking for doesn't exist. You may have mistyped the address or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base text-white hover:bg-blue-500 transition-colors duration-300"
        >
          GO TO HOMEPAGE
        </Link>
      </div>
    </div>
  )
}
