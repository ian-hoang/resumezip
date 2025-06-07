import Link from "next/link"
import { Clock, Edit, Download, Trash2 } from "lucide-react"
import { memo, useCallback } from "react"

interface ResumeCardProps {
  resume: {
    id: string
    resumeTitle: string
    updatedAt: string
    resumeTag: "Personal" | "Professional" | "Academic"
  }
  onDelete: (resume: any) => void
  onEdit: (id: string) => void
}

const getTagColor = (type: string) => {
  switch (type) {
    case "Professional":
      return "bg-blue-100 text-blue-600"
    case "Academic":
      return "bg-green-100 text-green-600"
    case "Personal":
    default:
      return "bg-purple-100 text-purple-600"
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
}

const ResumeCard = memo(function ResumeCard({ resume, onDelete, onEdit }: ResumeCardProps) {
  const handleEdit = useCallback(() => {
    onEdit(resume.id)
  }, [onEdit, resume.id])

  const handleDelete = useCallback(() => {
    onDelete(resume)
  }, [onDelete, resume])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{resume.resumeTitle}</h3>
            <div className="flex items-center text-gray-500 text-sm">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              <span>Updated: {formatDate(resume.updatedAt)}</span>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getTagColor(resume.resumeTag)}`}>
            {resume.resumeTag}
          </span>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleEdit}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            <Edit className="mr-1.5 h-4 w-4" />
            Edit
          </button>
          <div className="flex items-center gap-3">
            <a
              href={`https://resume-generator-pdfs.s3.amazonaws.com/resumes/${resume.id}.pdf`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Download resume"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={handleDelete}
              className="cursor-pointer inline-flex items-center text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
              aria-label="Delete resume"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ResumeCard 