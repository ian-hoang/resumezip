// eslint-disable-next-line @typescript-eslint/no-unused-vars
"use client";
import React, { createContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabaseClient"

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
        setResumes(parsed);
        // optional: auto-select the first resume if you want
        const firstId = Object.keys(parsed)[0];
        setCurrentResumeId(firstId || null);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("allResumes", JSON.stringify(resumes));
    }
  }, [resumes]);

  const createNewResume = (title: string, tag: string): string => {
    const newId = uuidv4();
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
    };
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

  if (error) {
    console.error("❌ Failed to delete resume:", error)
  } else {
    console.log("✅ Resume deleted:", id)
  }
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
      formData: currentResumeId ? resumes[currentResumeId] : {},
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