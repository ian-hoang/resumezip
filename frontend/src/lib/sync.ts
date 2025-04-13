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

  // Build dictionary: resumeId => resumeObject
  const resumeMap: Record<string, any> = {}

  for (const resume of resumes) {
    if (resume.id) {
      resumeMap[resume.id] = resume
    }
  }

  localStorage.setItem("allResumes", JSON.stringify(resumeMap))
  console.log("✅ Resumes synced to localStorage")
}