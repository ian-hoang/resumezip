import { memo, useCallback } from "react"

interface DeleteResumeModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  resumeTitle: string
}

const DeleteResumeModal = memo(function DeleteResumeModal({
  isOpen,
  onClose,
  onDelete,
  resumeTitle,
}: DeleteResumeModalProps) {
  const handleDelete = useCallback(() => {
    onDelete()
  }, [onDelete])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Delete Resume</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete <strong>{resumeTitle}</strong>? This action cannot be undone.
          </p>
        </div>

        <div className="p-6 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="cursor-pointer px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
})

export default DeleteResumeModal 