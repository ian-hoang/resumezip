"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from 'lucide-react'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b-[3px] border-[#124E66] bg-[#212A31] backdrop-blur-sm shadow-lg">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2 group">
            <Zap className="h-6 w-6 text-[#D3D9D4] transition-colors duration-300" />
            <span className="text-xl font-extrabold text-[#D3D9D4] tracking-tight">Resume<span className="text-[#D3D9D4] transition-colors duration-300">Zip</span></span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 p-4">
            <div className = "class">
              <Link href="/#get-started" className="text-sm font-bold uppercase tracking-wider text-[#D3D9D4] transition-all relative group">
                  Get Started
              </Link>
            </div>
            <Link href="/#features" className="text-sm font-bold uppercase tracking-wider text-[#D3D9D4] transition-all hover:text-[#124E66] relative group">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-[3px] bg-[#124E66] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/#contact" className="text-sm font-bold uppercase tracking-wider text-[#D3D9D4] transition-all hover:text-[#124E66] relative group">
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-[3px] bg-[#124E66] transition-all duration-300 group-hover:w-full"></span>
            </Link>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/create">
            <button className="inline-flex items-center justify-center rounded-md bg-[#124E66] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:bg-[#124E66]/90 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50">
              Create Resume
            </button>
          </Link>
          <button className="inline-flex items-center justify-center rounded-md border-2 border-[#124E66] bg-transparent px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:bg-[#124E66]/20 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer transform hover:scale-105">
            Sign In
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button className="flex items-center justify-center rounded-md p-2 md:hidden text-[#D3D9D4] hover:bg-[#124E66]/20 transition-colors" onClick={toggleMenu}>
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t-2 border-[#124E66] bg-[#212A31]/95 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link href="/#get-started" className="block py-2 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:text-[#124E66] transition-colors" onClick={toggleMenu}>
              Get Started
            </Link>
            <Link href="/#features" className="block py-2 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:text-[#124E66] transition-colors" onClick={toggleMenu}>
              Features
            </Link>
            <Link href="/#contact" className="block py-2 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:text-[#124E66] transition-colors" onClick={toggleMenu}>
              Contact
            </Link>
            <div className="flex flex-col gap-3 pt-3">
            <Link href="/create" onClick={toggleMenu}>
                <button className="w-full inline-flex items-center justify-center rounded-md bg-[#124E66] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:bg-[#124E66]/90 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer shadow-md border-b-[3px] border-[#124E66]/50">
                Create Resume
                </button>
            </Link>
            <button className="w-full inline-flex items-center justify-center rounded-md border-2 border-[#124E66] bg-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D3D9D4] hover:bg-[#124E66]/20 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer">
                Sign In
            </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
