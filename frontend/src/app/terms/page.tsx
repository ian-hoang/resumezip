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
                Review our terms and privacy policy below (they’re not too boring, I promise).
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
                    <h3 className="text-xl font-semibold mb-2">1. What You're Signing Up For</h3>
                    <p>
                      By accessing or using resumezip.io, you agree to be bound by these Terms of Service. 
                      If you do not agree with it, please do not use the site.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">2. What We Actually Do</h3>
                    <p>
                    We help you build resumes that look like you spent hours on them (even if you didn’t). 
                    You enter your info, we send it through our LaTeX templates (and some enhancements by this thingy called AI), 
                    and out comes a professional-looking PDF. All for free!
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">3. Resume Storage: Here Today, Gone Tomorrow</h3>
                    <p>
                    When you generate a resume, it gets stored temporarily on our AWS S3 server. It self-destructs after 24 hours. 
                    We don’t keep backups (unlike your ex), so if you love it, download it!
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">4. Third Parties stuff</h3>
                    <p>
                    We use Firebase to log you in and some LLMs to enhance your resume descriptions. We tried to impose fair rate limits on these AI APIs, 
                    so please don’t try to jail break them or go wild with requests (please). Help us keep things smooth for everyone.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">5. The Legal Boring Bit</h3>
                    <p>
                    No guarantees. Stuff might break. Everything's free so no refunds lol. 
                    We're not responsible for your resume's success or failure. Use this with confidence, wish yall all the best!
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
                    <h3 className="text-xl font-semibold mb-2">1. What We Know About You</h3>
                    <p>
                    When you create an account, we collect your email address and basic authentication details. 
                    We also store the resume stuff you type in (you know, jobs, skills, world domination plans) and some basic logs to keep the app running smoothly.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">2. Why We Use That Info</h3>
                    <p>
                    We use your input to build cool LaTeX resumes and make your descriptions sound fancy using AI. 
                    Your account helps you come back later without starting from scratch. That’s it, nothing sus.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">3. Where Your Resume Goes</h3>
                    <p>
                    Once you hit “Compile” your PDF gets uploaded to a secure AWS S3 bucket in the cloud. It stays there for 24 hours, then poof, it’s auto-deleted. 
                    You can always recompile it later using your saved info.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">4. Data Sharing and Selling</h3>
                    <p>
                      I don’t even know how to sell data. Your resume isn’t for sale, and neither are you.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Common FAQs Section */}
        {activeTab === "faq" && (
          <section id="faq" className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8 border-b border-gray-300">
            <div className="container mx-auto max-w-4xl">
              <div className="bg-white rounded-xl shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <HelpCircle className="h-8 w-8 text-blue-500" />
                  <h2 className="text-3xl font-bold">Common FAQs</h2>
                </div>

                <div className="space-y-6 text-gray-700">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Q: Is resumezip.io really free?</h3>
                    <p>
                    Yes! 100% free to use. No sign-up fees, no upsells, no "you have to pay $10/month (outrageous amount btw) to continue".
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Q: How long is my resume stored?</h3>
                    <p>
                    Resumes are kept for 24 hours on secure AWS servers, then automatically deleted.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">Q: Can I get feedback on my resume?</h3>
                    <p>
                    We currently enhance your descriptions using some LLMs APIs. Full feedback features are in progress (pinky promise).
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">Q: Do you share or sell my data?</h3>
                    <p>
                    Again, I don't even know how to sell data. Your data stays private. Period!!
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-2">Q: Do I need an account?</h3>
                    <p>
                    Yes but just your Google or Github account. No need to create a new password or remember another login.                     </p>
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
                Questions About Our <span className="text-blue-500">Terms and Privacy</span>?
              </h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
                If you have any questions or concerns about our Terms of Service or Privacy Policy, please don't
                hesitate to contact us.
              </p>
            </div>

            <div className="flex justify-center mt-8 ">
              <Link href="/contact">
                <button className="cursor-pointer inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300">
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
