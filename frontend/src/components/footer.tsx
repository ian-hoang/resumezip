"use client"
import Link from "next/link";

export default function Footer() {
    return (
        <footer className="border-t border-gray-200 py-6 md:py-8">
            <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-8">
                <p className="text-center text-sm leading-loose text-gray-500">© 2025 resumezip.io. All rights reserved.</p>
                <div className="flex gap-4">
                    <Link href="/terms" className="text-sm text-gray-500 hover:underline">
                    Terms and Privacy
                    </Link>
                </div>
            </div>
        </footer>     
    )
}