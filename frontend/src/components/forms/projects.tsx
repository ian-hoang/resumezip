"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Code, Calendar, Github, Globe, Layers, Rocket, Pencil, Sparkles } from "lucide-react"
import FormLabel from "../form-label"
import FormDescription from "../form-description"

interface Project {
  id: number
  projectName: string
  techStack: string
  projectDate: string
  projectGithub: string
  additionalLink: string
  projectDescription: string
}

export default function TechnicalProjectsForm() {
  const { formData, updateFormData } = useResumeContext()
  const [projects, setProjects] = useState<Project[]>(formData?.projectsSection || [])
  const [title, setTitle] = useState<string>(formData?.headings?.projects || "Technical Projects")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

  const addProject = () => {
    const newId = projects.length > 0 ? Math.max(...projects.map((proj) => proj.id)) + 1 : 1
    const newProject = {
      id: newId,
      projectName: "",
      techStack: "",
      projectDate: "",
      projectGithub: "",
      additionalLink: "",
      projectDescription: "",
    }
    const updatedProjects = [...projects, newProject]
    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects)
  }

  const removeProject = (id: number) => {
    const updatedProjects = projects
      .filter((proj) => proj.id !== id)
      .map((proj, index) => ({ ...proj, id: index + 1 }))

    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects)
  }

  const updateProject = (id: number, field: string, value: string) => {
    const updatedProjects = projects.map((proj) =>
      proj.id === id ? { ...proj, [field]: value } : proj
    )
    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-[#212A31] to-[#124E66] shadow-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/20 text-[#D3D9D4] font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> PROJECT PORTFOLIO
            </div>

            {isEditingTitle ? (
              <input
                type="text"
                className="text-3xl font-extrabold text-white tracking-tight bg-transparent border-b-2 border-[#748D92] focus:outline-none focus:border-[#D3D9D4] px-1 py-0.5 w-full"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                onBlur={() => {
                  setIsEditingTitle(false)
                  updateFormData("headings", { ...formData.headings, projects: title })
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{title}</h2>
                <Pencil
                  className="h-5 w-5 text-[#748D92] hover:text-[#D3D9D4] cursor-pointer transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
            <p className="text-[#D3D9D4]/80 mt-2">Add your technical projects and contributions</p>
          </div>
          <div className="bg-[#124E66]/20 p-3 rounded-full">
            <Code className="h-10 w-10 text-[#D3D9D4]" />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border-2 border-dashed border-[#748D92]/30 shadow-lg hover:border-[#124E66]/50 transition-all duration-300 group">
          <Code className="h-16 w-16 text-[#748D92]/70 mx-auto mb-6 group-hover:text-[#124E66]/70 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-[#212A31] mb-3">No technical projects added yet</h3>
          <p className="text-[#2E3944] mb-8 max-w-md mx-auto">
            Add your technical projects to showcase your skills, contributions, and achievements.
          </p>
          <button
            onClick={addProject}
            className="inline-flex items-center justify-center rounded-lg bg-[#124E66] px-6 py-3 text-base font-bold text-[#D3D9D4] hover:bg-[#124E66]/90 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Project
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            {projects.map((project, index) => (
              <div
                key={project.id}
                className="bg-[#D3D9D4]/20 border-2 border-[#748D92]/20 rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#124E66]/30 group"
              >
                <div className="bg-gradient-to-r from-[#212A31]/5 to-[#124E66]/10 px-6 py-4 border-b border-[#748D92]/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#124E66] text-[#D3D9D4] w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-[#212A31]">
                        {project.projectName ? project.projectName : `Project Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeProject(project.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-[#748D92] hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
                      aria-label="Remove project entry"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormLabel
                      icon={Rocket}
                      title="Project Name"
                      placeholderText="Project Name"
                      id={`projectName-${project.id}`}
                      value={project.projectName || ""}
                      onChange={(e) => updateProject(project.id, "projectName", e.target.value)}
                    />
                    <FormLabel
                      icon={Calendar}
                      title="Project Duration"
                      placeholderText="June 2023 - August 2023"
                      id={`projectDate-${project.id}`}
                      value={project.projectDate || ""}
                      onChange={(e) => updateProject(project.id, "projectDate", e.target.value)}
                    />
                  </div>

                  <FormLabel
                    icon={Layers}
                    title="Tech Stack"
                    placeholderText="React, Node.js, MongoDB, etc."
                    id={`techStack-${project.id}`}
                    value={project.techStack || ""}
                    onChange={(e) => updateProject(project.id, "techStack", e.target.value)}
                  />

                  <FormLabel
                    icon={Github}
                    title="GitHub Link"
                    placeholderText="https://github.com/username/project"
                    id={`projectGithub-${project.id}`}
                    value={project.projectGithub || ""}
                    onChange={(e) => updateProject(project.id, "projectGithub", e.target.value)}
                  />

                  <FormLabel
                    icon={Globe}
                    title="Website Link"
                    placeholderText="https://project-website.com"
                    id={`additionalLink-${project.id}`}
                    value={project.additionalLink || ""}
                    onChange={(e) => updateProject(project.id, "additionalLink", e.target.value)}
                  />

                  <FormDescription
                    id={`projectDescription-${project.id}`}
                    title="Project Description"
                    placeholderText="Describe your project, its features, and your contributions"
                    value={project.projectDescription || ""}
                    onChange={(e) => updateProject(project.id, "projectDescription", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="text-center pt-4">
              <button
                className="inline-flex items-center justify-center w-full rounded-lg border-2 border-dashed border-[#748D92]/30 bg-[#124E66]/5 px-5 py-3 text-base font-bold text-[#124E66] hover:bg-[#124E66]/10 hover:border-[#124E66]/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addProject}
                aria-label="Add project entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Another Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}