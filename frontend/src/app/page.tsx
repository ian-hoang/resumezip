"use client"

import { useEffect } from "react"
import { getRedirectResult } from "firebase/auth"
import { auth } from "@/lib/firebaseClient"
import dynamic from "next/dynamic"

const Hero = dynamic(() => import("@/components/home/Hero"), { ssr: true })
const Features = dynamic(() => import("@/components/home/Features"), { ssr: true })
const HowItWorks = dynamic(() => import("@/components/home/HowItWorks"), { ssr: true })

export default function Home() {
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // console.log("✅ Logged in as:", result.user.email)
        } else {
          // console.log("🕵️ No user from redirect")
        }
      })
      .catch((error) => {
        // console.error("❌ Error in getRedirectResult:", error.message)
      })
  }, [])

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      <main className="flex-grow">
        <Hero />
        <Features />
        <HowItWorks />
      </main>
    </div>
  )
}
