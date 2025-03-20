// app/create/new/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Plus, ArrowRight } from "lucide-react";
import WorkExperienceForm from "@/components/forms/workExp";
import EducationForm from "@/components/forms/education";
import TechnicalProjectsForm from "@/components/forms/projects";
import VolunteerForm from "@/components/forms/volunteer";
import LeadershipForm from "@/components/forms/leadership";
import ProfileForm from "@/components/forms/profile";
import AwardsForm from "@/components/forms/awards";
import TechnicalSkillsForm from "@/components/forms/skills";
import { useState } from "react";
import { useResumeContext } from "@/context/ResumeContext";
import PDFViewer from "@/components/pdfViewer";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { v4 as uuidv4 } from "uuid"; // Import UUID library

export default function NewResumePage() {
  const [activeSection, setActiveSection] = useState<string>("Profile");
  const { formData, updateFormData } = useResumeContext();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {

      let id = formData.id;
      if (!id) {
        id = uuidv4(); // Generate a new ID
        updateFormData("id", id); // Update the context with the new ID
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
      };

      console.log("Submitting payload:", payload);

      const response = await fetch("http://localhost:8080/api/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit resume data");
      }

      const responseData = await response.json();
      console.log("Resume submitted successfully:", responseData);

      // Append a timestamp to the PDF URL to force the browser to fetch the updated file
      const timestamp = new Date().getTime();
      const updatedPdfUrl = `${responseData.pdf_url}?timestamp=${timestamp}`;

      // Set the updated PDF URL
      setPdfUrl(updatedPdfUrl);
      console.log("PDF URL:", pdfUrl);
    } catch (error) {
      console.error("Error submitting resume:", error);
    }
  };

  const handleNavClick = (section: string) => {
    setActiveSection(section);
  };

  const renderForm = () => {
    switch (activeSection) {
      case "Work Experience":
        return <WorkExperienceForm />;
      case "Education":
        return <EducationForm />;
      case "Projects":
        return <TechnicalProjectsForm />;
      case "Profile":
        return <ProfileForm />;
      case "Volunteership":
        return <VolunteerForm />;
      case "Leadership":
        return <LeadershipForm />;
      case "Awards":
        return <AwardsForm />;
      case "Skills":
        return <TechnicalSkillsForm />;
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

      {/* Main Layout: 3 Column - Left (Fixed) | Center | Right */}
      <div className="flex gap-1">
        {/* Left Sidebar (Fixed Navigation) */}
        <div className="w-42 flex-shrink-0 pr-4">
          <div className="sticky top-24">
            <h1 className="text-lg font-semibold mb-4">Sections</h1>
            <nav className="space-y-1">
              {["Profile", "Education", "Work Experience", "Skills", "Projects", "Volunteership", "Leadership", "Awards"].map((section) => (
                <ResumeNavItem
                  key={section}
                  title={section}
                  active={activeSection === section}
                  onClick={() => handleNavClick(section)}
                />
              ))}
            </nav>
            <button className="mt-4 w-full flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <Plus className="mr-2 h-4 w-4" /> Add Section
            </button>
          </div>
        </div>

        {/* Center and Right Sections (Resizable) */}
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Center Form Section */}
          <Panel defaultSize={45} minSize={30} className="space-y-8 pr-1">
            <div className="bg-white rounded-lg border border-gray-300 overflow-y-auto shadow-md scrollbar-hidden" style={{ maxHeight: "calc(100vh - 200px)", height: "600px" }}>
              {renderForm()}
            </div>
            <div className="flex justify-between">
              <button onClick={handleSubmit} className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                Save Draft
              </button>
            </div>
          </Panel>

          {/* Divider between center and right panel */}
          <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors rounded-full" style={{ maxHeight: "calc(100vh - 200px)", height: "600px" }} />

          {/* Right Resume Review Panel */}
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

function ResumeNavItem({ title, active = false, onClick }: { title: string; active?: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-md text-sm cursor-pointer transition ${active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}
    >
      {title}
    </div>
  );
}