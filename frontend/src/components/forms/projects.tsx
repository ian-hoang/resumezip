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
    const updatedProjects = projects.filter((proj) => proj.id !== id).map((proj, index) => ({ ...proj, id: index + 1 }))

    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects)
  }

  const updateProject = (id: number, field: string, value: string) => {
    const updatedProjects = projects.map((proj) => (proj.id === id ? { ...proj, [field]: value } : proj))
    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-[#1f232e] text-white p-8 relative overflow-hidden rounded-t-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-blue-400 font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> PROJECT PORTFOLIO
            </div>

            {isEditingTitle ? (
              <input
                type="text"
                className="text-3xl font-bold text-white tracking-tight bg-transparent border-b-2 border-gray-600 focus:outline-none focus:border-gray-300 px-1 py-0.5 w-full"
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
                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
                <Pencil
                  className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
            <p className="text-gray-300 mt-2">Add your technical projects and contributions</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">
            <Code className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border border-dashed border-gray-300 shadow-sm hover:border-blue-300 transition-all duration-300 group rounded-b-lg">
          <Code className="h-16 w-16 text-gray-400 mx-auto mb-6 group-hover:text-blue-500 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-3">No technical projects added yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Add your technical projects to showcase your skills, contributions, and achievements.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={addProject}
            aria-label="Add project entry"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Project Entry
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-b-lg border border-gray-200 border-t-0">
          <div className="p-6 space-y-6">
            {projects.map((project, index) => (
              <div
                key={project.id}
                className="border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md group"
              >
                <div className="bg-[#f1efed] px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#1f232e] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900">
                        {project.projectName ? project.projectName : `Project Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeProject(project.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
                      aria-label="Remove project entry"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 space-y-6">
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
                className="inline-flex items-center justify-center w-full rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addProject}
                aria-label="Add project entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Project Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
