"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/100 backdrop-blur">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">ResumeZip</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 p-4 bg-white rounded-lg">
            <Link href="/#get-started" className="text-sm font-medium transition-colors hover:text-blue-600 hover:border-b-1 hover:border-blue-600">
                Get Started
            </Link>
            <Link href="/#features" className="text-sm font-medium transition-colors hover:text-blue-600 hover:border-b-1 hover:border-blue-600">
                Features
            </Link>
            <Link href="/#contact" className="text-sm font-medium transition-colors hover:text-blue-600 hover:border-b-1 hover:border-blue-600">
                Contact
            </Link>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/create">
            <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 cursor-pointer">
              Create Resume
            </button>
          </Link>
          <button className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-300 cursor-pointer">
            Sign In
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button className="flex items-center justify-center rounded-md p-2 md:hidden" onClick={toggleMenu}>
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-b">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link href="/#get-started" className="block py-2 text-sm font-medium" onClick={toggleMenu}>
              Get Started
            </Link>
            <Link href="/#features" className="block py-2 text-sm font-medium" onClick={toggleMenu}>
              Features
            </Link>
            <Link href="/#contact" className="block py-2 text-sm font-medium" onClick={toggleMenu}>
              Contact
            </Link>
            <div className="flex flex-col gap-2 pt-2">
            <Link href="/create" onClick={toggleMenu}>
                <button className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 cursor-pointer">
                Create Resume
                </button>
            </Link>
            <button className="w-full inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 cursor-pointer">
                Sign In
            </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

