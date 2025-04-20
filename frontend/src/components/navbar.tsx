"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { auth } from "@/lib/firebaseClient"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const [mobilePricingOpen, setMobilePricingOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
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
          <Link href="/templates" className="ml-2 text-sm font-medium underline flex items-center">
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
              <div className="absolute left-0 top-full w-64 pt-2 hidden group-hover:block">
                <div className="bg-[#2a2f3d] rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-200 mb-2">Resume Tools</h3>
                    <div className="space-y-2">
                      <Link href="/create/dashboard" className="flex items-start p-2 rounded-md hover:bg-gray-700/50 transition-colors">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Resume Builder</div>
                          <div className="text-xs text-gray-400">Create professional resumes</div>
                        </div>
                      </Link>
                      <Link href="/templates" className="flex items-start p-2 rounded-md hover:bg-gray-700/50 transition-colors">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Templates</div>
                          <div className="text-xs text-gray-400">Browse resume templates</div>
                        </div>
                      </Link>
                      <Link href="/feed" className="flex items-start p-2 rounded-md hover:bg-gray-700/50 transition-colors">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Resume Feed (coming soon) </div>
                          <div className="text-xs text-gray-400">Upload and get feedback for your resume from others</div>
                        </div>
                      </Link>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 p-2">
                    <Link href="/all-products" className="flex items-center justify-between p-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      View all products
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <Link
              href="/create/dashboard"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              Dashboard
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              Contact
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              About
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {!loading && (
              user ? (
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors cursor-pointer"
                >
                  Log Out
                </button>
              ) : (
                <Link href="/signin">
                  <button className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer">
                    Sign In
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                </Link>
                
              )
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
                <button 
                  onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                >
                  Products
                  <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${mobileProductsOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileProductsOpen && (
                  <div className="mt-2 pl-4 border-l border-gray-700 space-y-2">
                    <Link
                      href="/resume-builder"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Resume Builder
                    </Link>
                    <Link
                      href="/resume-templates"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Templates
                    </Link>
                    <Link
                      href="/resume-checker"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Resume Checker
                    </Link>
                    <Link
                      href="/all-products"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      View all products
                    </Link>
                  </div>
                )}
              </div>
              <div className="py-2">
                <button 
                  onClick={() => setMobilePricingOpen(!mobilePricingOpen)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                >
                  Pricing
                  <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${mobilePricingOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobilePricingOpen && (
                  <div className="mt-2 pl-4 border-l border-gray-700 space-y-2">
                    <Link
                      href="/pricing/individual"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Individual
                    </Link>
                    <Link
                      href="/pricing/teams"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Teams
                    </Link>
                    <Link
                      href="/pricing/enterprise"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Enterprise
                    </Link>
                    <Link
                      href="/compare-plans"
                      className="block py-2 text-sm text-gray-400 hover:text-white"
                      onClick={toggleMenu}
                    >
                      Compare all plans
                    </Link>
                  </div>
                )}
              </div>
              <Link
                href="/contact"
                className="block py-2 text-sm font-medium text-gray-300 hover:text-white cursor-pointer"
                onClick={toggleMenu}
              >
                Contact
              </Link>
              <div className="pt-3 border-t border-gray-800">
                {!loading && (
                  user ? (
                    <button
                      onClick={() => {
                        setShowLogoutModal(true)
                        setIsMenuOpen(false)
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
                  )
                )}
              </div>
            </div>
          </div>
        )}
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-[#1f232e] rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4 text-white">
              <h2 className="text-lg font-semibold mb-4">Log Out</h2>
              <p className="text-sm mb-6">Are you sure you want to log out?</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="cursor-pointer px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await signOut(auth)
                    localStorage.removeItem("allResumes")
                    setShowLogoutModal(false)
                    router.push("/")
                  }}
                  className="cursor-pointer px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-sm"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
