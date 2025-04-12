"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Send, Mail, User, MessageSquare, Sparkles, CheckCircle } from "lucide-react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // In a real application, you would send the form data to your backend
      // const response = await fetch('/api/contact', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // })

      // if (!response.ok) throw new Error('Failed to submit form')

      setIsSubmitted(true)
      setFormData({ name: "", email: "", subject: "", message: "" })
    } catch (err) {
      setError("There was an error submitting your message. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Section - Dark Theme */}
      <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[url('/dots-pattern.png')] bg-repeat opacity-20"></div>
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
              Contact <span className="text-blue-500">Us</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl font-medium">
              Have questions or feedback? We'd love to hear from you. Fill out the form below and our team will get back
              to you as soon as possible.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8 flex-grow">
        <div className="container mx-auto max-w-3xl">
          {isSubmitted ? (
            <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Message Sent Successfully!</h2>
              <p className="text-gray-600 mb-8">
                Thank you for reaching out. We've received your message and will get back to you shortly.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300 shadow-sm"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-200">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mb-4">
                  <Sparkles className="h-4 w-4 mr-2" /> GET IN TOUCH
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Send us a message</h2>
                <p className="mt-2 text-gray-600">We'll respond to your inquiry as soon as possible.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Your Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Subject Field */}
                <div className="space-y-2">
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="" disabled>
                      Select a subject
                    </option>
                    <option value="general">General Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="feedback">Feedback</option>
                    <option value="partnership">Partnership Opportunity</option>
                  </select>
                </div>

                {/* Message Field */}
                <div className="space-y-2">
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                    Your Message
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      placeholder="Type your message here..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    ></textarea>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="cursor-pointer w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-6 py-3 transition-colors duration-300 shadow-sm disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Email Contact Information */}
          <div className="mt-12">
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Email Us</h3>
              <p className="text-gray-600 mb-4">
                For any inquiries, you can reach our support team directly via email.
              </p>
              <a
                href="mailto:resumezipio@gmail.com"
                className="inline-flex items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 px-6 py-3 text-base font-medium transition-colors duration-300"
              >
                resumezipio@gmail.com
              </a>
            </div>
          </div>

          {/* FAQ Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
                Want to know how your privacy is protected?{" "}
              <Link href="/terms" className="text-blue-600 hover:underline font-medium">
                Check our terms and privacy
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
