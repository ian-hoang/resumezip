import { supabase } from "@/lib/supabaseClient"
import { useResumeContext } from "@/context/ResumeContext"

export async function syncAllResumesToLocalStorage(uid: string) {
  const { setResumes } = useResumeContext();
  const { data: resumes, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("uid", uid)

  if (error) {
    console.error("❌ Failed to fetch resumes:", error.message)
    return
  }

  const keyMap: Record<string, string> = {
    education_section: "educationSection",
    profile_section: "profileSection",
    resume_title: "resumeTitle",
    awards_section: "awardsSection",
    work_section: "workExperienceSection",
    skills_section: "skillsSection",
    volunteer_section: "volunteerExperienceSection",
    leadership_section: "leadershipExperienceSection",
    projects_section: "projectsSection",
    created_at: "updatedAt",
    selected_template: "selectedTemplate",
    resume_tag: "resumeTag",
    section_order: "sectionOrder",
    headings: "headings",
  }

  const resumeMap: Record<string, any> = {}

  for (const resume of resumes) {
    if (resume.id) {
      const transformedResume: Record<string, any> = {}

      for (const key in resume) {
        const newKey = keyMap[key] || key
        transformedResume[newKey] = resume[key]
      }
      resumeMap[resume.id] = transformedResume
    }
  }

  localStorage.setItem("allResumes", JSON.stringify(resumeMap))
  setResumes(resumeMap)
  console.log("✅ Resumes synced to localStorage with mapped field names")
}
