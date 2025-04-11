"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import FormLabel from "../form-label"
import { User, Phone, Mail, Linkedin, Github, Globe, UserCircle, Sparkles } from "lucide-react"

interface Profile {
  fullName: string
  phoneNumber: string
  email: string
  linkedin: string
  profileGithub: string
  personalWebsite: string
}

export default function ProfileForm() {
  const { formData, updateFormData } = useResumeContext()
  const [profile, setProfile] = useState<Profile>({
    fullName: formData?.profileSection?.fullName || "",
    phoneNumber: formData?.profileSection?.phoneNumber || "",
    email: formData?.profileSection?.email || "",
    linkedin: formData?.profileSection?.linkedin || "",
    profileGithub: formData?.profileSection?.profileGithub || "",
    personalWebsite: formData?.profileSection?.personalWebsite || "",
  })

  const updateProfile = (field: string, value: string) => {
    const updatedProfile = { ...profile, [field]: value }
    setProfile(updatedProfile)
    updateFormData("profileSection", updatedProfile)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-[#1f232e] text-white p-8 relative overflow-hidden rounded-t-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-blue-400 font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> PERSONAL INFO
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Profile</h2>
            <p className="text-gray-300 mt-2">Add your personal and contact information</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">
            <UserCircle className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      <div className="h-full bg-white p-8 shadow-sm space-y-8 mb-8 relative border border-gray-200 border-t-0 rounded-b-lg">
        {/* Full Name */}
        <FormLabel
          icon={User}
          title="Full Name"
          placeholderText="Your full name"
          id="fullName"
          value={profile.fullName}
          onChange={(e) => updateProfile("fullName", e.target.value)}
        />

        {/* Phone Number */}
        <FormLabel
          icon={Phone}
          title="Phone Number"
          placeholderText="Your phone number"
          id="phoneNumber"
          value={profile.phoneNumber}
          onChange={(e) => updateProfile("phoneNumber", e.target.value)}
        />

        {/* Email */}
        <FormLabel
          icon={Mail}
          title="Email"
          placeholderText="Your email address"
          id="email"
          value={profile.email}
          onChange={(e) => updateProfile("email", e.target.value)}
        />

        {/* LinkedIn */}
        <FormLabel
          icon={Linkedin}
          title="LinkedIn"
          placeholderText="Your LinkedIn profile URL"
          id="linkedin"
          value={profile.linkedin}
          onChange={(e) => updateProfile("linkedin", e.target.value)}
        />

        {/* GitHub */}
        <FormLabel
          icon={Github}
          title="GitHub"
          placeholderText="Your GitHub profile URL"
          id="profileGithub"
          value={profile.profileGithub}
          onChange={(e) => updateProfile("profileGithub", e.target.value)}
        />

        {/* Personal Website */}
        <FormLabel
          icon={Globe}
          title="Website"
          placeholderText="Your personal website"
          id="personalWebsite"
          value={profile.personalWebsite}
          onChange={(e) => updateProfile("personalWebsite", e.target.value)}
        />
      </div>
    </div>
  )
}
