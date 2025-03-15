"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

interface Project {
  id: number,
  projectName: string,
  techStack: string,
  projectDate: string,
  projectGithub: string,
  additionalLink: string,
  projectDescription: string
}
export default function TechnicalProjectsForm() {
  const { formData, updateFormData } = useResumeContext();
  const [projects, setProjects] = useState<Project[]>(formData?.projectsSection ?? []);

  const addProject = () => {
    const newId = projects.length > 0 ? Math.max(...projects.map((proj) => proj.id)) + 1 : 1
    const newProject = { id: newId, projectName: "", techStack: "", projectDate: "", projectGithub: "", additionalLink: "", projectDescription: "" }
    const updatedProjects = [...projects, newProject]
    setProjects(updatedProjects)
    updateFormData("projectsSection", updatedProjects) // Update the projects section
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
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Technical Projects</h2>

        {projects.map((project) => (
          <div key={project.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Project #{project.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeProject(project.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor={`projectName-${project.id}`} className="text-sm font-medium">
                    Project Name
                  </label>
                  <input
                    id={`projectName-${project.id}`}
                    value={project.projectName}
                    onChange={(e) => updateProject(project.id, "projectName", e.target.value)}
                    placeholder="Project Name"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`techStack-${project.id}`} className="text-sm font-medium">
                    Technical Stack
                  </label>
                  <input
                    id={`techStack-${project.id}`}
                    value={project.techStack}
                    onChange={(e) => updateProject(project.id, "techStack", e.target.value)}
                    placeholder="Technologies used"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`projectDate-${project.id}`} className="text-sm font-medium">
                    Date
                  </label>
                  <input
                    id={`projectDate-${project.id}`}
                    value={project.projectDate}
                    onChange={(e) => updateProject(project.id, "projectDate", e.target.value)}
                    placeholder="Date of project"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`projectGithub-${project.id}`} className="text-sm font-medium">
                    GitHub Link
                  </label>
                  <input
                    id={`projectGithub-${project.id}`}
                    value={project.projectGithub}
                    onChange={(e) => updateProject(project.id, "projectGithub", e.target.value)}
                    placeholder="GitHub Link"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`additionalLink-${project.id}`} className="text-sm font-medium">
                    Website Link
                  </label>
                  <input
                    id={`additionalLink-${project.id}`}
                    value={project.additionalLink}
                    onChange={(e) => updateProject(project.id, "additionalLink", e.target.value)}
                    placeholder="Website link"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`projectDescription-${project.id}`} className="text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    id={`projectDescription-${project.id}`}
                    value={project.projectDescription}
                    onChange={(e) => updateProject(project.id, "projectDescription", e.target.value)}
                    placeholder="Project description"
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addProject}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </button>
      </div>
    </div>
  )
}