import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { FormProvider } from "@/context/ResumeContext";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ResumeZip - AI-Powered Resume Builder",
  description: "Create professional resumes with AI at no cost",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/zap.svg" type="image/svg+xml" />
      </head>
      <body className={inter.className}>
        <Navbar />
        <FormProvider>{children}</FormProvider>
        <Footer />
      </body>
    </html>
  )
}

