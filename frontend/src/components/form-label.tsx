"use client"

import type React from "react"
import type { FC } from "react"
import type { LucideIcon } from "lucide-react"

interface FormLabelProps {
  icon: LucideIcon
  title: string
  placeholderText: string
  type?: string
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const FormLabel: FC<FormLabelProps> = ({ 
  icon: Icon, 
  title, 
  placeholderText, 
  type = "text", 
  id, 
  value, 
  onChange 
}) => {
  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex items-center gap-2">
        <div className="text-[#124E66] group-hover:text-[#124E66] transition-colors duration-300">
          <Icon className="h-5 w-5" />
        </div>
        <label htmlFor={id} className="text-sm font-bold text-[#212A31] group-hover:text-[#124E66] transition-colors duration-300">
          {title}
        </label>
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholderText}
        className="w-full rounded-lg border-2 border-[#748D92]/30 bg-[#D3D9D4]/10 px-4 py-2.5 text-[#212A31] placeholder:text-[#2E3944]/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#124E66] focus:border-[#124E66] focus:ring-offset-1 transition-all duration-300"
      />
    </div>
  )
}

export default FormLabel
