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

const FormLabel: FC<FormLabelProps> = ({ icon: Icon, title, placeholderText, type = "text", id, value, onChange }) => {
  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex items-center gap-2">
        <div className="text-blue-500">
          <Icon className="h-5 w-5" />
        </div>
        <label htmlFor={id} className="text-sm font-bold text-gray-800">
          {title}
        </label>
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholderText}
        className="cursor-pointer w-full rounded-lg border border-2 border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-blue-500 transition-all duration-300"
      />
    </div>
  )
}

export default FormLabel
