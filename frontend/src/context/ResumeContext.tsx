// eslint-disable-next-line @typescript-eslint/no-unused-vars
"use client";
import React, { createContext, useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabaseClient"
import { auth } from "@/lib/firebaseClient"

const ResumeContext = createContext<any>(null);

export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  const [resumes, setResumes] = useState<Record<string, any>>({});
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);

  // Load resumes from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedResumes = localStorage.getItem("allResumes");
      if (savedResumes) {
        const parsed = JSON.parse(savedResumes);
        setResumes(parsed)
      }
    }
  }, []);

  const formData = useMemo(() => {
    return currentResumeId ? resumes[currentResumeId] || {} : {};
  }, [currentResumeId, resumes]);

  // Save to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("allResumes", JSON.stringify(resumes));
    }
  }, [resumes]);

  const createNewResume = async (title: string, tag: string): Promise<string> => {
    const newId = uuidv4();

    const user = auth.currentUser
      if (!user) {
        console.error("No user logged in")
        return ""
      }

    const newResumeData = {
      id: newId,
      resumeTag: tag,
      resumeTitle: title,
      updatedAt: new Date().toISOString(),
      profileSection: {},
      headings: {},
      selectedTemplate: "jake",
      educationSection: [],
      workExperienceSection: [],
      projectsSection: [],
      volunteerExperienceSection: [],
      skillsSection: [],
      leadershipExperienceSection: [],
      awardsSection: [],
      sectionOrder: ["Education", "Work", "Skills", "Projects", "Volunteership", "Leadership", "Awards"],
    };

    const { error, data } = await supabase.from("resumes").upsert([
      {
        id: newId,
        uid: user.uid,
        resume_title: newResumeData.resumeTitle,
        resume_tag: newResumeData.resumeTag,
        selected_template: newResumeData.selectedTemplate,
        profile_section: newResumeData.profileSection,
        education_section: newResumeData.educationSection,
        work_section: newResumeData.workExperienceSection,
        skills_section: newResumeData.skillsSection,
        projects_section: newResumeData.projectsSection,
        volunteer_section: newResumeData.volunteerExperienceSection,
        leadership_section: newResumeData.leadershipExperienceSection,
        awards_section: newResumeData.awardsSection,
        headings: newResumeData.headings,
        section_order: ["Education", "Work", "Skills", "Projects", "Volunteership", "Leadership", "Awards"],
      }
    ])
    setResumes(prev => ({ ...prev, [newId]: newResumeData }));
    setCurrentResumeId(newId);
    return newId;
  };

  const deleteResume = async (id: string) => {
    setResumes(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    if (currentResumeId === id) {
      setCurrentResumeId(null);
    }
    const { error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
  };

  const updateFormData = (section: string, data: any) => {
    if (!currentResumeId) return;
    setResumes(prev => ({
      ...prev,
      [currentResumeId]: {
        ...prev[currentResumeId],
        [section]: data
      }
    }));
  };

  return (
    <ResumeContext.Provider value={{
      resumes,
      currentResumeId,
      formData,
      setCurrentResumeId,
      createNewResume,
      updateFormData,
      deleteResume,
      setResumes
    }}>
      {children}
    </ResumeContext.Provider>
  );
};

export const useResumeContext = () => React.useContext(ResumeContext);