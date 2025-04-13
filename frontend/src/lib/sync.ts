import { supabase } from "@/lib/supabaseClient"

export async function syncAllResumesToLocalStorage(uid: string) {
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

  // Build dictionary: resumeId => resumeObject
  const resumeMap: Record<string, any> = {}

  for (const resume of resumes) {
    if (resume.id) {
      const key = keyMap[resume.id] || resume.id
      resumeMap[key] = resume
    }
  }

  localStorage.setItem("allResumes", JSON.stringify(resumeMap))
  console.log("✅ Resumes synced to localStorage")
}