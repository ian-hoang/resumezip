import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { FormProvider } from "@/context/ResumeContext";

const inter = Inter({ subsets: ["latin"] })
export const metadata: Metadata = {
  title: "resumezip.io",
  description: "Create professional resumes with AI at no cost",
  openGraph: {
    title: "resumezip.io",
    description: "Create professional resumes with AI at no cost",
    url: "https://resumezip.io", // replace with your actual domain
    siteName: "resumezip.io",
    images: [
      {
        url: "https://resumezip.io/ThreeResumes.png", // full absolute URL to your image
        width: 1200,
        height: 630,
        alt: "A preview image showing how ResumeZip looks",
      },
    ],
    type: "website",
  },
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
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className={inter.className}>
        <Navbar />
        <FormProvider>{children}</FormProvider>
        <Footer />
      </body>
    </html>
  )
}

