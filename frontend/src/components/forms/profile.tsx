"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import FormLabel from "../form-label";
import { User, Phone, Mail, Linkedin, Github, Globe, UserCircle, ArrowRight } from "lucide-react"

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

        {/* Website */}
        <FormLabel
          icon={Globe}
          title="Website"
          placeholderText="Your personal website"
          id="personalWebsite"
          value={profile.personalWebsite}
          onChange={(e) => updateProfile("personalWebsite", e.target.value)}
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
      </div>
    </div>
  )
}
