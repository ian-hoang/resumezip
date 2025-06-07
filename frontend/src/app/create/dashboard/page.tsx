"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Sparkles } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebaseClient"
import { syncAllResumesToLocalStorage } from "@/lib/sync"
import ResumeCard from "@/components/dashboard/ResumeCard"
import CreateResumeModal from "@/components/dashboard/CreateResumeModal"
import DeleteResumeModal from "@/components/dashboard/DeleteResumeModal"

export default function DashboardPage() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newResumeName, setNewResumeName] = useState("")
  const [selectedTag, setSelectedTag] = useState("personal")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const { resumes, deleteResume, createNewResume, setResumes, setCurrentResumeId } = useResumeContext()
  const [loading, setLoading] = useState(true)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [resumeToDelete, setResumeToDelete] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/signin")
        return
      }
    
      const resumeMap = await syncAllResumesToLocalStorage(user.uid)
      setResumes(resumeMap)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleCreateResume = async () => {
    setIsModalOpen(false)
    const newId = await createNewResume(newResumeName, selectedTag)
    router.push(`/create/new/${newId}`)
  }

  const handleEditResume = useCallback((id: string) => {
    setCurrentResumeId(id);
    router.push(`/create/new/${id}`);
  }, [router, setCurrentResumeId]);

  const handleDeleteResume = useCallback(() => {
    if (resumeToDelete) {
      deleteResume(resumeToDelete.id);
      setResumeToDelete(null); // Assuming this state remains here
    }
  }, [resumeToDelete, deleteResume]);

  if (loading) {
    return <div className="text-white p-4">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f1efed]">
      {/* Header Section */}
      <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 font-semibold text-sm mb-3">
                <Sparkles className="h-4 w-4 mr-2" /> RESUME MANAGEMENT
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Your <span className="text-blue-500">Resumes</span>
              </h1>
              <p className="mt-3 text-gray-300 max-w-2xl">
                Manage all your resume versions in one place. Create, edit, and download your professional documents.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="cursor-pointer inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300 shadow-sm"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create New Resume
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard Content */}
      <section className="py-12 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(resumes).map((resume: any) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onDelete={(resume) => {
                  setResumeToDelete(resume)
                  setIsDeleteModalOpen(true)
                }}
                onEdit={handleEditResume}
              />
            ))}

            {/* Add New Resume Card */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex flex-col items-center justify-center text-center p-6 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group h-full"
            >
              <div className="h-12 w-12 rounded-full bg-[#f1efed] flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                <Plus className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-bold cursor-pointer text-lg text-gray-900 mb-2">Create New Resume</h3>
              <p className="text-gray-500 text-sm">Start building a new professional resume</p>
            </button>
          </div>
        </div>
      </section>

      {/* Create Resume Modal */}
      <CreateResumeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateResume}
        newResumeName={newResumeName}
        setNewResumeName={setNewResumeName}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
      />

      {/* Delete Resume Modal */}
      <DeleteResumeModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setResumeToDelete(null)
        }}
        onDelete={handleDeleteResume}
        resumeTitle={resumeToDelete?.resumeTitle || ""}
      />
    </div>
  )
}
