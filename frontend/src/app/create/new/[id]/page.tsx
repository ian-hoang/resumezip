"use client"

import Link from "next/link"
import { ArrowLeft, Sparkles, Loader2, ArrowRight, GripVertical, FileText } from "lucide-react"
import WorkExperienceForm from "@/components/forms/workExp"
import EducationForm from "@/components/forms/education"
import TechnicalProjectsForm from "@/components/forms/projects"
import VolunteerForm from "@/components/forms/volunteer"
import LeadershipForm from "@/components/forms/leadership"
import ProfileForm from "@/components/forms/profile"
import AwardsForm from "@/components/forms/awards"
import TechnicalSkillsForm from "@/components/forms/skills"
import TemplatesForm from "@/components/forms/templates"
import { useState, useEffect } from "react"
import { useResumeContext } from "@/context/ResumeContext"
import PDFViewer from "@/components/pdfViewer"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { v4 as uuidv4 } from "uuid"
import { motion } from "framer-motion"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebaseClient"
import { supabase } from "@/lib/supabaseClient"

const defaultSections = ["Education", "Work", "Skills", "Projects", "Volunteership", "Leadership", "Awards"]

export default function NewResumePage() {
  const [activeSection, setActiveSection] = useState<string>("Profile")
  const { setCurrentResumeId, formData, updateFormData } = useResumeContext()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isDataReady = formData && formData.sectionOrder && formData.id
  const [sections, setSections] = useState<string[]>(defaultSections)
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()

  const { id } = useParams();

  useEffect(() => {
    if (id) {
      setCurrentResumeId(id as string);
    }
    setIsClient(true);
  }, [id]);

  useEffect(() => {
    if (!formData.id) return // Don't proceed if id isn't ready
    const resumeId = formData.id
    const timestamp = new Date().getTime()
    const pdfUrl = `https://resume-generator-pdfs.s3.amazonaws.com/resumes/${resumeId}.pdf?timestamp=${timestamp}`
    setPdfUrl(pdfUrl)
  }, [formData.id])


  // useEffect(() => {
  //   const unsubscribe = onAuthStateChanged(auth, (user) => {
  //     if (!user) {
  //       router.push("/signin")
  //     }
  //     setLoading(false)
  //   })

  //   return () => unsubscribe()
  // }, [router])

  useEffect(() => {
    if (formData.sectionOrder && Array.isArray(formData.sectionOrder)) {
      setSections(formData.sectionOrder)
    }
  }, [formData.sectionOrder])

  // if (!isClient || !isDataReady) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-[#f1efed] text-gray-700 transition-opacity duration-500">
  //       <div className="flex items-center gap-2 animate-fadeIn">
  //         <Loader2 className="animate-spin w-5 h-5" />
  //         <span>Loading resume editor...</span>
  //       </div>
  //     </div>
  //   )
  // }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const user = auth.currentUser
      if (!user) {
        console.error("No user logged in")
        return
      }

      let id = formData.id
      if (!id) {
        id = uuidv4()
        updateFormData("id", id)
      }

      const { error, data } = await supabase.from("resumes").upsert([
        {
          id: formData.id || id,
          uid: user.uid,
          resume_title: formData.resumeTitle || "Untitled Resume",
          resume_tag: formData.resumeTag || "personal",
          selected_template: formData.selectedTemplate || "jack",
          profile_section: formData.profileSection ?? null,
          education_section: formData.educationSection ?? null,
          work_section: formData.workExperienceSection ?? null,
          skills_section: formData.skillsSection ?? null,
          projects_section: formData.projectsSection ?? null,
          volunteer_section: formData.volunteerExperienceSection ?? null,
          leadership_section: formData.leadershipExperienceSection ?? null,
          awards_section: formData.awardsSection ?? null,
          headings: formData.headings ?? null,
          section_order: formData.sectionOrder ?? defaultSections,
        }
      ])
      
      if (error) {
        console.error("Insert error:", error)
      } else {
        // console.log("✅ Supabase insert success:", data)
      }      

      const payload = {
        id,
        profileSection: formData.profileSection,
        educationSection: formData.educationSection,
        workExperienceSection: formData.workExperienceSection,
        projectsSection: formData.projectsSection,
        skillsSection: formData.skillsSection,
        leadershipExperienceSection: formData.leadershipExperienceSection,
        volunteerExperienceSection: formData.volunteerExperienceSection,
        awardsSection: formData.awardsSection,
        sectionOrder: ["Profile", ...sections], // Include the current section order
        sectionHeadings: formData.headings,
        selectedTemplate: formData.selectedTemplate,
      }

      console.log("Submitting payload:", payload)

      const response = await fetch("https://api.resumezip.io/api/resume", {
      // const response = await fetch("http://localhost:8080/api/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error("Failed to submit resume data")

      const responseData = await response.json()
      const timestamp = new Date().getTime()
      const updatedPdfUrl = `${responseData.pdf_url}?timestamp=${timestamp}`
      setPdfUrl(updatedPdfUrl)
    } catch (error) {
      console.error("Error submitting resume:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const reorderedSections = Array.from(sections)
    const [movedSection] = reorderedSections.splice(result.source.index, 1)
    reorderedSections.splice(result.destination.index, 0, movedSection)

    setSections(reorderedSections)
    updateFormData("sectionOrder", reorderedSections)
  }

  const renderForm = () => {
    switch (activeSection) {
      case "Work":
        return <WorkExperienceForm />
      case "Education":
        return <EducationForm />
      case "Projects":
        return <TechnicalProjectsForm />
      case "Profile":
        return <ProfileForm />
      case "Volunteership":
        return <VolunteerForm />
      case "Leadership":
        return <LeadershipForm />
      case "Awards":
        return <AwardsForm />
      case "Skills":
        return <TechnicalSkillsForm />
      case "Templates":
        return <TemplatesForm />
      default:
        return <ProfileForm />
    }
  }

  return (
    <div className="bg-[#f1efed]">
      <main className="container mx-auto max-w-7xl py-8 min-h-screen">
        <div className="mb-6">
          <Link
            href="/create/dashboard"
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to options
          </Link>
        </div>

        <div className="flex gap-2">
          {/* Left Sidebar (Fixed Navigation) */}
          <div className="w-48 flex-shrink-0">
            <div className="sticky top-24 rounded-xl shadow-sm p-3 border border-gray-200 bg-white">
              <div className="flex items-center gap-2 mb-4 p-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <h1 className="text-lg font-bold text-gray-900">Sections</h1>
              </div>

              {/* Fixed Profile Section */}
              <div
                onClick={() => setActiveSection("Profile")}
                className={`cursor-pointer flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                  activeSection === "Profile"
                    ? "bg-blue-100 text-blue-600 shadow-sm transition-all duration-500"
                    : "text-gray-700 hover:text-blue-600 transition-all duration-500"
                } mb-1`}
              >
                Profile
              </div>

              {/* Draggable Other Sections */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sections">
                  {(provided) => (
                    <nav {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                      {sections.map((section, index) => (
                        <Draggable key={section} draggableId={section} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center px-3 py-2 rounded-full text-sm cursor-pointer ${
                                activeSection === section
                                  ? "bg-blue-100 text-blue-600 shadow-sm transition-all duration-500"
                                  : "text-gray-700 hover:text-blue-600 transition-all duration-500"
                              }`}
                              onClick={() => setActiveSection(section)}
                            >
                              <div {...provided.dragHandleProps} className="mr-2">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              {section}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </nav>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Templates Section */}
              <div
                onClick={() => setActiveSection("Templates")}
                className={`mt-6 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all duration-300 focus:outline-none cursor-pointer ${
                  activeSection === "Templates"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                <FileText className="h-4 w-4" />
                Templates
              </div>
            </div>
          </div>

          {/* Center and Right Sections (Resizable) */}
          <PanelGroup direction="horizontal" className="flex-1 min-h-0">
            <Panel defaultSize={45} minSize={38} className="min-h-0 space-y-6">
              <div
                className="bg-white rounded-lg border border-gray-200 overflow-y-auto scrollbar-hidden shadow-sm flex flex-col"
                style={{ height: "600px" }}
              >
                <div className="flex-1">{renderForm()}</div>
              </div>
              <div className="flex justify-center w-full">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#1f232e] text-[#f1efed] 
                   font-bold rounded-xl transition-all duration-300 cursor-pointer
                   transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Compiling Resume...</span>
                    </>
                  ) : (
                    <>
                      <span>Compile Resume</span>
                      <motion.div
                        className="ml-1"
                        initial={{ x: 0 }}
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </motion.div>
                    </>
                  )}
                </button>
              </div>
            </Panel>

            <PanelResizeHandle
              className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors rounded-full mx-1"
              style={{ height: "600px" }}
            />

            <Panel defaultSize={55} minSize={40} className="">
              <div className="sticky top-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <PDFViewer pdfData={pdfUrl} />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </main>
    </div>
  )
}
