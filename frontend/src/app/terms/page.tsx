"use client"

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, FileText } from "lucide-react";

export default function TermsAndPrivacy() {
  const [activeTab, setActiveTab] = useState("terms"); // Track active tab (terms or privacy)

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      <main className="flex-grow">
        {/* Header Section - Dark Theme */}
        <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="flex flex-col items-center text-center gap-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Terms & <span className="text-blue-500">Privacy</span>
              </h1>
              <p className="text-lg text-gray-300 max-w-3xl font-medium">
                We're committed to transparency and protecting your data.
                <br />
                Please review our terms and privacy policy below.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Link href="/" className="text-gray-300 hover:text-white flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Home</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs - Light Theme */}
        <section className="bg-[#f1efed] py-8 px-4 md:px-6 lg:px-8 border-b border-gray-300">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setActiveTab("terms")}
                className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-medium ${
                  activeTab === "terms"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                } hover:bg-blue-500 transition-colors duration-300`}
              >
                <FileText className="h-5 w-5 mr-2" />
                Terms of Service
              </button>
              <button
                onClick={() => setActiveTab("privacy")}
                className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-medium ${
                  activeTab === "privacy"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                } hover:bg-blue-500 transition-colors duration-300`}
              >
                <Lock className="h-5 w-5 mr-2" />
                Privacy Policy
              </button>
            </div>
          </div>
        </section>

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
