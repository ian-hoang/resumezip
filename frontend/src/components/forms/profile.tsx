"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"

interface Profile {
  fullName: string;
  phoneNumber: string;
  email: string;
  linkedin: string;
  profileGithub: string;
  personalWebsite: string;
}

export default function ProfileForm() {
  const { formData, updateFormData } = useResumeContext();
  const [profile, setProfile] = useState<Profile>({
    fullName: formData?.profileSection?.fullName || "",
    phoneNumber: formData?.profileSection?.phoneNumber || "",
    email: formData?.profileSection?.email || "",
    linkedin: formData?.profileSection?.linkedin || "",
    profileGithub: formData?.profileSection?.profileGithub || "",
    personalWebsite: formData?.profileSection?.personalWebsite || "",
  });

  const updateProfile = (field: string, value: string) => {
    const updatedProfile = { ...profile, [field]: value }
    setProfile(updatedProfile)
    updateFormData("profileSection", updatedProfile) // Update the profile section
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold mb-4">Profile</h2>

      <div className="grid grid-cols-1 gap-4">
        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium">
            Full Name
          </label>
          <input
            id="fullName"
            value={profile.fullName}
            onChange={(e) => updateProfile("fullName", e.target.value)}
            placeholder="Your full name"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <label htmlFor="phoneNumber" className="text-sm font-medium">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            type="tel"
            value={profile.phoneNumber}
            onChange={(e) => updateProfile("phoneNumber", e.target.value)}
            placeholder="Your phone number"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            value={profile.email}
            onChange={(e) => updateProfile("email", e.target.value)}
            placeholder="Email address"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>

        {/* LinkedIn */}
        <div className="space-y-2">
          <label htmlFor="linkedin" className="text-sm font-medium">
            LinkedIn
          </label>
          <input
            id="linkedin"
            value={profile.linkedin}
            onChange={(e) => updateProfile("linkedin", e.target.value)}
            placeholder="LinkedIn profile URL"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>

        {/* Website */}
        <div className="space-y-2">
          <label htmlFor="personalWebsite" className="text-sm font-medium">
            Personal Website
          </label>
          <input
            id="personalWebsites"
            value={profile.personalWebsite}
            onChange={(e) => updateProfile("personalWebsite", e.target.value)}
            placeholder="Personal website or portfolio"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>

        {/* GitHub */}
        <div className="space-y-2">
          <label htmlFor="profileGithub" className="text-sm font-medium">
            GitHub Link
          </label>
          <input
            id="profileGithub"
            value={profile.profileGithub}
            onChange={(e) => updateProfile("profileGithub", e.target.value)}
            placeholder="GitHub profile URL"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>
      </div>
    </div>
  )
}
