"use client"

import type React from "react"

import { type FC, useState } from "react"
import { FileText, WandSparkles, Loader2 } from "lucide-react"

interface FormDescriptionProps {
  title: string
  placeholderText: string
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

const FormDescription: FC<FormDescriptionProps> = ({ title, placeholderText, id, value, onChange }) => {
  const [loading, setLoading] = useState(false)

  const normalizeText = (text: string) => {
    return text
      .split("\n")
      .map((line) => {
        if (line.trim()) {
          if (line === "•") {
            return line
          }
          if (/^•([^\s]|$)/.test(line)) {
            return line.replace(/^•/, "• ")
          }
          return line.startsWith("• ") ? line : `• ${line}`
        }
        return line
      })
      .join("\n")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const textarea = e.target as HTMLTextAreaElement
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const newText = normalizeText(value)

      const updatedValue =
        newText.substring(0, start) + (newText[start - 1] === "\n" ? "" : "\n• ") + newText.substring(end)

      onChange({
        target: { value: updatedValue },
      } as React.ChangeEvent<HTMLTextAreaElement>)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 3
      }, 0)
    }
  }

  const onAiFinish = async () => {
    if (!value.trim()) return

    setLoading(true)

    try {
      const response = await fetch("https://api.resumezip.io/improve-job-desc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDesc: value }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch AI response")
      }

      const data = await response.json()
      onChange({ target: { value: data.optimizedText } } as React.ChangeEvent<HTMLTextAreaElement>)
    } catch (error) {
      console.error("Error optimizing text:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-2 group">
      <div className="flex items-center gap-2">
        <div className="text-[#124E66] group-hover:text-[#124E66] transition-colors duration-300">
          <FileText className="h-5 w-5" />
        </div>
        <label
          htmlFor={id}
          className="text-sm font-bold text-[#212A31] group-hover:text-[#124E66] transition-colors duration-300"
        >
          {title}
        </label>
      </div>
      <textarea
        id={id}
        value={normalizeText(value)}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        className="w-full min-h-[120px] rounded-lg border-2 border-[#748D92]/30 bg-[#D3D9D4]/10 px-4 py-3 text-[#212A31] placeholder:text-[#2E3944]/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#124E66] focus:border-[#124E66] focus:ring-offset-1 transition-all duration-300 resize-none"
      />

      {/* AI Button with Loading Spinner */}
      <button
        onClick={onAiFinish}
        disabled={loading}
        className={`absolute bottom-3 right-3 flex items-center gap-1.5 bg-[#124E66] hover:bg-[#124E66]/90 text-[#D3D9D4] text-xs font-bold px-3 py-1.5 rounded-md shadow-md transition-all duration-300 ${
          loading ? "opacity-75 cursor-not-allowed" : "hover:-translate-y-0.5 hover:shadow-lg active:scale-105"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <WandSparkles className="h-4 w-4" />
            Zip It
          </>
        )}
      </button>
    </div>
  )
}

export default FormDescription
