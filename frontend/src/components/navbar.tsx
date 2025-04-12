"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react"
import { auth } from "@/lib/firebaseClient"
import { onAuthStateChanged, signOut, User } from "firebase/auth"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })

    return () => unsubscribe()
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <>
      {/* Announcement Bar */}
      <div className="w-full bg-blue-600 py-2 px-4 text-center text-white">
        <div className="container mx-auto flex items-center justify-center">
          <span className="text-sm font-medium">🎉 New templates are here! Now available on resumezip.io</span>
          <Link href="/api" className="ml-2 text-sm font-medium underline flex items-center">
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-[#1f232e]">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-gray-700 px-4 py-2">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-medium text-white tracking-tight">
                resumezip<span className="text-blue-500">.io</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1">
                Products
                <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </button>
            </div>
            <div className="relative group">
              <button className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1">
                For Business
                <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </button>
            </div>
            <div className="relative group">
              <button className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1">
                For Developers
                <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </button>
            </div>
            <div className="relative group">
              <button className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1">
                Pricing
                <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </button>
            </div>
            <Link
              href="/contact"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              Contact
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            ) : (
              <Link href="/signin">
                <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer">
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="flex items-center justify-center rounded-md p-2 md:hidden text-gray-400 hover:text-white cursor-pointer"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-[#1f232e]">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <div className="py-2">
                <button className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer">
                  Products
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </div>
              <div className="py-2">
                <button className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer">
                  For Business
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </div>
              <div className="py-2">
                <button className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer">
                  For Developers
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </div>
              <div className="py-2">
                <button className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer">
                  Pricing
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </div>
              <Link
                href="/research"
                className="block py-2 text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                onClick={toggleMenu}
              >
                Research
              </Link>
              <div className="py-2">
                <button className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer">
                  Company
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </div>
              <Link
                href="/docs"
                className="block py-2 text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                onClick={toggleMenu}
              >
                Docs
              </Link>
              <Link
                href="/contact"
                className="block py-2 text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                onClick={toggleMenu}
              >
                Contact
              </Link>
              <div className="pt-3 border-t border-gray-800">
                {user ? (
                  <button
                    onClick={() => {
                      handleLogout()
                      toggleMenu()
                    }}
                    className="w-full inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                ) : (
                  <Link href="/signin" onClick={toggleMenu}>
                    <button className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer">
                      Sign In
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
