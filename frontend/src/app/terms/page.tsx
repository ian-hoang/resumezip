"use client"

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, FileText, HelpCircle } from "lucide-react";

export default function TermsAndPrivacy() {
  const [activeTab, setActiveTab] = useState("terms"); // Track active tab (terms or privacy)
  const tabs = [
    { id: "terms", label: "Terms of Services", icon: <FileText className="h-5 w-5 mr-2" /> },
    { id: "privacy", label: "Privacy Policy", icon: <Lock className="h-5 w-5 mr-2" /> },
    { id: "faq", label: "Common FAQs", icon: <HelpCircle className="h-5 w-5 mr-2" /> },
  ]

  return (
    <div className="flex flex-col bg-[#f1efed] min-h-screen overflow-hidden">
      <main className="flex-grow">
        {/* Header Section - Dark Theme */}
        <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors group"
              >
                <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to home
              </Link>
            </div>
            <div className="flex flex-col items-center text-center gap-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Terms & <span className="text-blue-500">Privacy</span>
              </h1>
              <p className="text-lg text-gray-300 max-w-3xl font-medium">
                We're committed to transparency and protecting your data.
                <br />
                Please review our terms and privacy policy below.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-center mt-8">
          <div className="bg-[#f1efed] inline-flex p-2 border border-gray-300 rounded-full">
            <div className="flex flex-wrap justify-center gap-1 md:gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Terms of Service Section */}
        {activeTab === "terms" && (
          <section id="terms" className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8 border-b border-gray-300">
            <div className="container mx-auto max-w-4xl">
              <div className="bg-white rounded-xl shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <h2 className="text-3xl font-bold">Terms of Service</h2>
                </div>

                <div className="space-y-6 text-gray-700">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h3>
                    <p>
                      By accessing or using the AI Resume Builder service, you agree to be bound by these Terms of
                      Service. If you do not agree to these terms, please do not use our service.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">2. Description of Service</h3>
                    <p>
                      AI Resume Builder provides tools and resources to help users create professional resumes. We offer
                      various templates, AI-powered suggestions, and export capabilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Privacy Policy Section */}
        {activeTab === "privacy" && (
          <section id="privacy" className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8 border-b border-gray-300">
            <div className="container mx-auto max-w-4xl">
              <div className="bg-white rounded-xl shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="h-8 w-8 text-blue-500" />
                  <h2 className="text-3xl font-bold">Privacy Policy</h2>
                </div>

                <div className="space-y-6 text-gray-700">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h3>
                    <p>
                      By accessing or using the AI Resume Builder service, you agree to be bound by these Terms of
                      Service. If you do not agree to these terms, please do not use our service.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">2. Description of Service</h3>
                    <p>
                      AI Resume Builder provides tools and resources to help users create professional resumes. We offer
                      various templates, AI-powered suggestions, and export capabilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contact Section - Light Theme */}
        <section className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">
                Questions About Our <span className="text-blue-500">Terms or Privacy</span>?
              </h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
                If you have any questions or concerns about our Terms of Service or Privacy Policy, please don't
                hesitate to contact us.
              </p>
            </div>

            <div className="flex justify-center mt-8 ">
              <Link href="/contact">
                <button className="cursor-pointer inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300">
                  Contact Support
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
