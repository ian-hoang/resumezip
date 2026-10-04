"use client";
import React, { createContext, useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid"
import { DEFAULT_TEMPLATE } from "@/lib/templates"

const ResumeContext = createContext<any>(null);

export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  const [resumes, setResumes] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);

  // localStorage is the only copy of the user's resumes, so read it before
  // ever writing to it, and pick up changes made in other tabs.
  useEffect(() => {
    const read = (saved: string | null) => {
      try {
        if (saved) setResumes(JSON.parse(saved));
      } catch (error) {
        console.error("Couldn't read saved resumes:", error);
      }
    };
    read(localStorage.getItem("allResumes"));
    setLoaded(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "allResumes") read(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const formData = useMemo(() => {
    return currentResumeId ? resumes[currentResumeId] || {} : {};
  }, [currentResumeId, resumes]);

  // Save to localStorage on change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("allResumes", JSON.stringify(resumes));
    }
  }, [resumes, loaded]);

  // Resumes only live in this browser's localStorage; there are no accounts.
  const createNewResume = (title: string, tag: string, template: string = DEFAULT_TEMPLATE): string => {
    const newId = uuidv4();

    const newResumeData = {
      id: newId,
      resumeTag: tag,
      resumeTitle: title,
      updatedAt: new Date().toISOString(),
      profileSection: {},
      headings: {},
      selectedTemplate: template,
      educationSection: [],
      workExperienceSection: [],
      projectsSection: [],
      volunteerExperienceSection: [],
      skillsSection: [],
      leadershipExperienceSection: [],
      awardsSection: [],
      sectionOrder: ["Education", "Work", "Skills", "Projects", "Volunteership", "Leadership", "Awards"],
    };

    setResumes(prev => ({ ...prev, [newId]: newResumeData }));
    setCurrentResumeId(newId);
    return newId;
  };

  const deleteResume = (id: string) => {
    setResumes(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    if (currentResumeId === id) {
      setCurrentResumeId(null);
    }
  };

  const updateFormData = (section: string, data: any) => {
    if (!currentResumeId) return;
    setResumes(prev => prev[currentResumeId] ? {
      ...prev,
      [currentResumeId]: {
        ...prev[currentResumeId],
        [section]: data,
        updatedAt: new Date().toISOString(),
      }
    } : prev);
  };

  return (
    <ResumeContext.Provider value={{
      resumes,
      loaded,
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