import { X, ChevronDown } from "lucide-react"
import { useRef, useEffect, memo, useCallback } from "react"

interface CreateResumeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  newResumeName: string
  setNewResumeName: (name: string) => void
  selectedTag: string
  setSelectedTag: (tag: string) => void
  isDropdownOpen: boolean
  setIsDropdownOpen: (isOpen: boolean) => void
}

const tags = [
  { id: "personal", name: "Personal" },
  { id: "academic", name: "Academic" },
  { id: "professional", name: "Professional" },
]

const CreateResumeModal = memo(function CreateResumeModal({
  isOpen,
  onClose,
  onSubmit,
  newResumeName,
  setNewResumeName,
  selectedTag,
  setSelectedTag,
  isDropdownOpen,
  setIsDropdownOpen,
}: CreateResumeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleModalClickOutside = useCallback((event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose()
    }
  }, [onClose])

  const handleDropdownClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false)
    }
  }, [setIsDropdownOpen])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewResumeName(e.target.value)
  }, [setNewResumeName])

  const handleTagSelect = useCallback((tagId: string) => {
    setSelectedTag(tagId)
    setIsDropdownOpen(false)
  }, [setSelectedTag, setIsDropdownOpen])

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen(!isDropdownOpen)
  }, [isDropdownOpen, setIsDropdownOpen])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleModalClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleModalClickOutside)
    }
  }, [isOpen, handleModalClickOutside])

  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleDropdownClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleDropdownClickOutside)
    }
  }, [isDropdownOpen, handleDropdownClickOutside])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Create New Resume</h2>
            <button
              onClick={onClose}
              className="cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="resumeName" className="block text-sm font-medium text-gray-700 mb-1">
                Resume Name
              </label>
              <input
                type="text"
                id="resumeName"
                value={newResumeName}
                onChange={handleNameChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter resume name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resume Type</label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={toggleDropdown}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>{tags.find(tag => tag.id === selectedTag)?.name || "Select type"}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleTagSelect(tag.id)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default CreateResumeModal 