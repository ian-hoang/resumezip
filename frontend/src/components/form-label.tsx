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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600" />
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {title}
        </label>
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholderText}
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 transition-all"
      />
    </div>
  )
}

export default FormLabel

