"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Code, Calendar, Github, Globe, Layers, Rocket } from "lucide-react"
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
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Technical Projects</h2>
            <p className="text-blue-100 mt-1">Add your technical projects and contributions</p>
          </div>
          <div className="">
            <Code className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No technical projects added yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your technical projects to showcase your skills, contributions, and achievements.
          </p>
          <button
            onClick={addProject}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="mr-2 h-4 w-4" /> Add First Project
          </button>
        </div>
      ) : (
        <>
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {project.projectName ? project.projectName : `Project Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeProject(project.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
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

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer"
              onClick={addProject}
              aria-label="Add project entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Project
            </button>
          </div>
        </>
      )}
    </div>
  )
}