// app/create/new/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Loader2, ArrowRight, GripVertical } from "lucide-react";
import WorkExperienceForm from "@/components/forms/workExp";
import EducationForm from "@/components/forms/education";
import TechnicalProjectsForm from "@/components/forms/projects";
import VolunteerForm from "@/components/forms/volunteer";
import LeadershipForm from "@/components/forms/leadership";
import ProfileForm from "@/components/forms/profile";
import AwardsForm from "@/components/forms/awards";
import TechnicalSkillsForm from "@/components/forms/skills";
import { useState, useEffect } from "react";
import { useResumeContext } from "@/context/ResumeContext";
import PDFViewer from "@/components/pdfViewer";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { v4 as uuidv4 } from "uuid";
import { motion } from "framer-motion";
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

const defaultSections = [
  "Education",
  "Work",
  "Skills",
  "Projects",
  "Volunteership",
  "Leadership",
  "Awards"
];

export default function NewResumePage() {
  const [activeSection, setActiveSection] = useState<string>("Profile");
  const { formData, updateFormData } = useResumeContext();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<string[]>(formData.sectionOrder || defaultSections);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Prevent server-side rendering of drag-and-drop component
  }

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let id = formData.id;
      if (!id) {
        id = uuidv4();
        updateFormData("id", id);
      }
  
      const payload = {
        id,
        profileSection: formData.profileSection,
        educationSection: formData.educationSection,
        workExperienceSection: formData.workExperienceSection,
        projectsSection: formData.projectsSection,
        skillsSection: formData.skillsSection,
        leadershipExperienceSection: formData.leadershipExperienceSection,
        volunteerExperienceSection: formData.volunteerExperienceSection,
        awardsSection: formData.awardsSection,
        sectionOrder: ["Profile", ...sections] // Include the current section order
      };

      console.log("Submitting payload:", payload);

      // const response = await fetch("https://api.resumezip.io/api/resume", {
      const response = await fetch("http://localhost:8080/api/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) throw new Error("Failed to submit resume data");
  
      const responseData = await response.json();
      const timestamp = new Date().getTime();
      const updatedPdfUrl = `${responseData.pdf_url}?timestamp=${timestamp}`;
      setPdfUrl(updatedPdfUrl);
    } catch (error) {
      console.error("Error submitting resume:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const reorderedSections = Array.from(sections);
    const [movedSection] = reorderedSections.splice(result.source.index, 1);
    reorderedSections.splice(result.destination.index, 0, movedSection);
    
    setSections(reorderedSections);
    updateFormData("sectionOrder", reorderedSections);
  };

  const renderForm = () => {
    switch (activeSection) {
      case "Work": return <WorkExperienceForm />;
      case "Education": return <EducationForm />;
      case "Projects": return <TechnicalProjectsForm />;
      case "Profile": return <ProfileForm />;
      case "Volunteership": return <VolunteerForm />;
      case "Leadership": return <LeadershipForm />;
      case "Awards": return <AwardsForm />;
      case "Skills": return <TechnicalSkillsForm />;
      default: return <ProfileForm />;
    }
  };

  return (
    <main className="container mx-auto max-w-7xl py-8 px-1">
      <div className="mb-6">
        <Link href="/create" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to options
        </Link>
      </div>

      <div className="flex gap-1">
        {/* Left Sidebar (Fixed Navigation) */}
        <div className="w-42 flex-shrink-0 pr-4">
          <div className="sticky top-24">
            <h1 className="text-lg font-semibold mb-4">Sections</h1>
            
            {/* Fixed Profile Section */}
            <div
              onClick={() => setActiveSection("Profile")}
              className={`flex items-center px-3 py-2 rounded-md text-sm cursor-pointer transition ${
                activeSection === "Profile" 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              } mb-2`}
            >
              Profile
            </div>

            {/* Draggable Other Sections */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <nav 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-1"
                  >
                    {sections.map((section, index) => (
                      <Draggable key={section} draggableId={section} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center px-3 py-2 rounded-md text-sm cursor-pointer transition ${
                              activeSection === section 
                                ? "bg-blue-600 text-white" 
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                            onClick={() => setActiveSection(section)}
                          >
                            <div {...provided.dragHandleProps} className="mr-2">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            {section}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </nav>
                )}
              </Droppable>
            </DragDropContext>

            <button className="mt-4 w-full flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <Plus className="mr-2 h-4 w-4" /> Add Section
            </button>
          </div>
        </div>

        {/* Center and Right Sections (Resizable) */}
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={45} minSize={30} className="space-y-8 pr-1">
            <div className="bg-white rounded-lg border border-gray-300 overflow-y-auto shadow-md scrollbar-hidden" style={{ maxHeight: "calc(100vh - 200px)", height: "600px" }}>
              {renderForm()}
            </div>
            <div className="flex justify-center w-full">
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="w-full flex items-center gap-2 px-6 py-2 mb-4 bg-gray-900 hover:bg-gray-800 text-white 
                 border border-gray-700 rounded-lg shadow-md transition-all 
                 hover:shadow-gray-500/30 focus:outline-none focus:ring-2 cursor-pointer
                disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Compiling...</span>
                  </>
                ) : (
                  <>
                    <span>Compile Resume</span>
                    <motion.div
                      className="ml-2"
                      initial={{ x: 0 }}
                      animate={{ x: [0, 5, 0] }}
                      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  </>
                )}
              </button>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors rounded-full" style={{ maxHeight: "calc(100vh - 200px)", height: "600px" }} />

          <Panel defaultSize={55} minSize={40} className="pl-1">
            <div className="sticky top-0 bg-gray-300 rounded-lg shadow-md">
              <PDFViewer pdfData={pdfUrl} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </main>
  );
}