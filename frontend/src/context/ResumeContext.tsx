"use client";
import React, { createContext, useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid"
import { DEFAULT_TEMPLATE } from "@/lib/templates"
import type { ResumeContent } from "@/lib/resumeFile"
import { numberDuplicateTitles, uniqueTitle } from "@/lib/resumeTitles"

/** A resume as the editor stores it; its fields are listed in components/editor/sections.ts. */
export type Resume = Record<string, any>;

interface ResumeContextValue {
  /** Every resume saved in this browser, by id. */
  resumes: Record<string, Resume>;
  /** False until the saved resumes have been read from localStorage. */
  loaded: boolean;
  currentResumeId: string | null;
  /** The open resume, or {} when none is open. */
  formData: Resume;
  setCurrentResumeId: (id: string | null) => void;
  createNewResume: (title: string, tag: string, template?: string) => string;
  importResume: (content: ResumeContent, title: string, options?: { keepId?: boolean }) => string;
  replaceResume: (id: string, content: ResumeContent) => void;
  updateFormData: (section: string, data: unknown) => void;
  deleteResume: (id: string) => void;
}

const ResumeContext = createContext<ResumeContextValue | null>(null);

const blankResume = (template: string) => ({
  profileSection: {},
  headings: {},
  selectedTemplate: template,
  educationSection: [],
  workExperienceSection: [],
  projectsSection: [],
  publicationsSection: [],
  volunteerExperienceSection: [],
  skillsSection: [],
  leadershipExperienceSection: [],
  awardsSection: [],
  sectionOrder: ["Education", "Work", "Skills", "Projects", "Publications", "Volunteership", "Leadership", "Awards"],
});

export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  const [resumes, setResumes] = useState<Record<string, Resume>>({});
  const [loaded, setLoaded] = useState(false);
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);

  // localStorage is the only copy of the user's resumes, so read it before
  // ever writing to it, and pick up changes made in other tabs.
  useEffect(() => {
    // On first load, also number any resumes saved with the same name.
    const read = (saved: string | null, numberDuplicates = false) => {
      try {
        if (!saved) return;
        const parsed = JSON.parse(saved);
        setResumes(numberDuplicates ? numberDuplicateTitles(parsed) : parsed);
      } catch (error) {
        console.error("Couldn't read saved resumes:", error);
      }
    };
    read(localStorage.getItem("allResumes"), true);
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
      ...blankResume(template),
      id: newId,
      resumeTag: tag,
      resumeTitle: title,
      updatedAt: new Date().toISOString(),
    };

    // A repeated name gets a number, e.g. "Untitled resume 2".
    setResumes(prev => ({
      ...prev,
      [newId]: { ...newResumeData, resumeTitle: uniqueTitle(title, Object.values(prev).map(r => r?.resumeTitle)) },
    }));
    setCurrentResumeId(newId);
    return newId;
  };

  // Adds a resume opened from a file. A resumezip PDF keeps its resume's id,
  // so opening it again later is recognised as the same resume.
  const importResume = (content: ResumeContent, title: string, { keepId = true } = {}): string => {
    const id = keepId && content.id && !resumes[content.id] ? content.id : uuidv4();
    const resume = {
      ...blankResume(content.selectedTemplate ?? DEFAULT_TEMPLATE),
      ...content,
      id,
      resumeTag: "personal",
      updatedAt: content.updatedAt ?? new Date().toISOString(),
    };
    // Named after the file, numbered if another resume has that name.
    setResumes(prev => ({
      ...prev,
      [id]: { ...resume, resumeTitle: uniqueTitle(title, Object.values(prev).map(r => r?.resumeTitle)) },
    }));
    return id;
  };

  // Replaces a resume's content with a file's, keeping its name and tag.
  const replaceResume = (id: string, content: ResumeContent) => {
    setResumes(prev => prev[id] ? {
      ...prev,
      [id]: { ...prev[id], ...content, id, updatedAt: new Date().toISOString() }
    } : prev);
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

  const updateFormData = (section: string, data: unknown) => {
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
      importResume,
      replaceResume,
      updateFormData,
      deleteResume,
    }}>
      {children}
    </ResumeContext.Provider>
  );
};

export const useResumeContext = () => {
  const context = React.useContext(ResumeContext);
  if (!context) throw new Error("useResumeContext must be used inside FormProvider");
  return context;
};