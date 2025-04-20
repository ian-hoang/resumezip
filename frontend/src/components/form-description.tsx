"use client"

import type React from "react"
import { type FC, useState, useEffect } from "react"
import { FileText, WandSparkles, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient" // make sure this import exists
import { auth } from "@/lib/firebaseClient" // make sure this import exists

interface FormDescriptionProps {
  title: string
  placeholderText: string
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

const DAILY_LIMIT = 5

const FormDescription: FC<FormDescriptionProps> = ({ title, placeholderText, id, value, onChange }) => {
  const [loading, setLoading] = useState(false)
  const [usageLeft, setUsageLeft] = useState(DAILY_LIMIT)

  const getToday = () => new Date().toISOString().split("T")[0]

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

  useEffect(() => {
    const encoded = localStorage.getItem("usageCountObf")
    const today = getToday()

    if (encoded) {
      try {
        const decoded = atob(encoded)
        const [countStr, storedDate] = decoded.split("|")
        if (storedDate === today) {
          const count = parseInt(countStr)
          setUsageLeft(Math.max(DAILY_LIMIT - count, 0))
          return
        }
      } catch (err) {
        console.error("⚠️ Failed to decode usageCountObf:", err)
      }
    }

    // reset usage for today
    const reset = btoa(`0|${today}`)
    localStorage.setItem("usageCountObf", reset)
    setUsageLeft(DAILY_LIMIT)
  }, [])

  const updateUsage = async () => {
    const encoded = localStorage.getItem("usageCountObf")
    const today = getToday()
    let count = 0

    if (encoded) {
      try {
        const [storedCount, storedDate] = atob(encoded).split("|")
        if (storedDate === today) {
          count = parseInt(storedCount)
        }
      } catch (_) {}
    }
 
    const newCount = count + 1
    const newEncoded = btoa(`${newCount}|${today}`)
    localStorage.setItem("usageCountObf", newEncoded)
    setUsageLeft(Math.max(DAILY_LIMIT - newCount, 0))

    const uid = auth.currentUser?.uid
    if (!uid) return

    const { error } = await supabase.from("ai_usage").upsert({
      user_id: uid,
      date_used: today,
      usage_count: newCount,
    })
    if (error) {
      // console.error("❌ Failed to update AI usage:", error.message)
    }
    // console.log("✅ AI usage updated:", newCount)
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
    if (!value.trim() || usageLeft <= 0) return

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

      await updateUsage()
    } catch (error) {
      console.error("Error optimizing text:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-2 group">
      <div className="flex items-center gap-2">
        <div className="text-blue-500">
          <FileText className="h-5 w-5" />
        </div>
        <label htmlFor={id} className="text-sm font-bold text-gray-800">
          {title}
        </label>
      </div>
      <textarea
        id={id}
        value={normalizeText(value)}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        className="cursor-pointer w-full min-h-[120px] rounded-lg border border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-blue-500 transition-all duration-300 resize-none"
      />

      {/* AI Button with usage count */}
      <button
        onClick={onAiFinish}
        disabled={loading || usageLeft <= 0}
        className={`absolute bottom-3 right-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition-all duration-300 ${
          loading || usageLeft <= 0
            ? "opacity-75 cursor-not-allowed"
            : "hover:-translate-y-0.5 hover:shadow-md active:scale-105"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <WandSparkles className="h-4 w-4" />
            Zip It ({usageLeft})
          </>
        )}
      </button>
    </div>
  )
}

export default FormDescription
