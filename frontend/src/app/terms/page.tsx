"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"

export default function PolicyPage() {
  const [activeSection, setActiveSection] = useState("privacy")

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Our Policies</h1>
        <p className="text-gray-600">
          We are committed to transparency and protecting your rights. Please review our policies to understand how we
          operate and safeguard your information.
        </p>
      </div>

      {/* Simple Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200">
        <button
          onClick={() => handleSectionChange("privacy")}
          className={`px-4 py-2 font-medium text-sm cursor-pointer ${
            activeSection === "privacy"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-blue-600"
          }`}
        >
          Privacy Policy
        </button>
        <button
          onClick={() => handleSectionChange("terms")}
          className={`px-4 py-2 font-medium text-sm cursor-pointer ${
            activeSection === "terms" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-600"
          }`}
        >
          Terms of Service
        </button>
        <button
          onClick={() => handleSectionChange("faq")}
          className={`px-4 py-2 font-medium text-sm cursor-pointer ${
            activeSection === "faq" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-600"
          }`}
        >
          FAQ
        </button>
      </div>

      {/* Content Sections */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        {activeSection === "privacy" && <PrivacyPolicyContent />}
        {activeSection === "terms" && <TermsOfServiceContent />}
        {activeSection === "faq" && <FAQContent />}
      </div>

      {/* Contact Support */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Still have questions?</h3>
            <p className="text-sm text-gray-600">Contact us for more information about our policies.</p>
          </div>
          <a
            href="mailto:resumezipio@gmail.com"  // Replace with your actual email
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}

function PrivacyPolicyContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h2>
        <p className="text-sm text-gray-500">Last updated: March 26, 2025</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-900">Introduction</h3>
        <p className="text-gray-700">
          This Privacy Policy describes how we collect, use, and disclose your personal information when you use our
          services, including our website and applications.
        </p>
      </div>

      {/* Using native details/summary for expandable sections */}
      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Information We Collect
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          We do not collect or store any personal data on our servers. When you use our service, you provide information to generate your resume. 
          This data is processed in real-time and temporarily stored on your local storage for functionality purposes.
          </p>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          How We Use Your Information
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">We use the information we collect for your resume generation:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your input is processed to generate a LaTeX-based resume.</li>
            <li>The generated PDF is temporarily stored on our server and deleted automatically after 48 hours.</li>
            <li>Some data are saved in your browser's local storage to enhance user experience, but we do not access or transmit this data.</li>
            <li>We do not use, sell, or share your data for any purpose beyond generating your resume.</li>
          </ul>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Data Retention and Deletion
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">We do not store any user-provided information permanently:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li> The generated resume link will expire and the file will be deleted from our servers within 48 hours. </li>
            <li> Since users do not create accounts, no persistent data is retained. </li>
            <li> Data stored in your browser’s local storage can be manually cleared at any time. </li>
          </ul>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Security Measures
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          We take reasonable precautions to protect your data. All sensitive data transmitted between your browser and our servers is encrypted using SSL/TLS technology. 
          However, as we do not store any personal information long-term, there is almost no risk of data exposure.
          </p>
        </div>
      </details>
    </div>
  )
}

function TermsOfServiceContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h2>
        <p className="text-sm text-gray-500">Last updated: March 26, 2025</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-900">Agreement to Terms</h3>
        <p className="text-gray-700">
        By using ResumeZip.io, you agree to these Terms of Service. If you do not agree, please do not use our service.
        </p>
      </div>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Description of Service
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          Our website provides a free resume generation service where users input their information to create a resume. 
          The generated resume is stored temporarily and deleted within 48 hours.
          </p>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          User Responsibilities
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <ul className="list-disc pl-5 space-y-2">
            <li> You agree to provide accurate and lawful information. </li>
            <li> You understand that we do not store or retain your data beyond 48 hours, except for temporary storage in your browser’s local storage. </li>
            <li> You acknowledge that the resume link provided will expire after 48 hours and cannot be retrieved. </li>
          </ul>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Limitation of Liability
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <ul className="list-disc pl-5 space-y-2">
            <li> We provide this service "as is" without any warranties or guarantees. </li>
            <li> We are not responsible for any data loss or issues arising from the temporary nature of our service. </li>
            <li> We do not assume liability for any misuse of the generated resumes. </li>
          </ul>
        </div>
      </details>
    </div>
  )
}

function FAQContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Frequently Asked Questions</h2>
        <p className="text-sm text-gray-500">Common questions about our policies and services</p>
      </div>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Do I need to create an account?
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">No, you can use our service completely free without signing up or logging in.</p>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Is my data stored permanently?
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          No, we do not store any user data permanently. Your input is processed in real-time, and the generated resume PDF is stored temporarily on Amazon S3 for 48 hours before being automatically deleted. 
          Some data may be saved in your browser’s local storage for functionality purposes, but we do not access or store it on our servers.
          </p>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          Is this service free?
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          Yes, our resume generation service is completely free.
          </p>
        </div>
      </details>

      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          What should I do if I encounter an issue?
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          If you experience any problems, please contact us at resumezipio@gmail.com for assistance.
          </p>
        </div>
      </details>


      <details className="group border-b border-gray-200 pb-2">
        <summary className="list-none flex justify-between items-center cursor-pointer py-2 font-medium text-gray-900">
          How can I support this website?
          <span className="transition-transform group-open:rotate-180">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>
        <div className="mt-2 text-gray-700 text-sm">
          <p className="mb-2">
          If you find this service useful and would like to support us, you can make a donation to help with cloud maintenance costs and future improvements. Donate{" "}
            <a href="https://www.paypal.com/paypalme/QuangDatHoang104" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" >
              here
            </a>.
          </p>
        </div>
      </details>
      
    </div>
  )
}

