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
      <div className="bg-gradient-to-r from-[#212A31] to-[#124E66] shadow-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/20 text-[#D3D9D4] font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> PERSONAL INFO
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Profile</h2>
            <p className="text-[#D3D9D4]/80 mt-2">Add your personal and contact information</p>
          </div>
          <div className="bg-[#124E66]/20 p-3 rounded-full">
            <UserCircle className="h-10 w-10 text-[#D3D9D4]" />
          </div>
        </div>
      </div>

      <div className="h-full bg-white p-8 shadow-xl space-y-8 mb-8 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#124E66] to-[#748D92]"></div>

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

