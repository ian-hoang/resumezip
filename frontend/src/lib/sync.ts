import { supabase } from "@/lib/supabaseClient"

export async function syncAllResumesToLocalStorage(uid: string) {
  // 1. Get all resumes for user
  const { data: resumes, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("uid", uid)

  // 2. Get AI usage for today
  const today = new Date().toISOString().split("T")[0]
  const { data: usage, error: usageError } = await supabase
    .from("ai_usage")
    .select("usage_count")
    .eq("user_id", uid)
    .eq("date_used", today)
    .single()

  if (error) {
    // console.error("❌ Failed to fetch resumes:", error.message)
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
  const encodedCount = btoa(`${usage?.usage_count || 0}|${today}`)
  localStorage.setItem("usageCountObf", encodedCount)
  // console.log("✅ Resumes synced to localStorage with mapped field names")
  return resumeMap;
}
