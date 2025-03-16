"use client"

import { useResumeContext } from "@/context/ResumeContext";
import { useState } from "react";
import { Plus, Trash2, GraduationCap, MapPin, Award, BarChart, Calendar, BookOpen, Users } from "lucide-react"
import FormLabel from "../form-label";


interface Education {
  id: number;
  schoolName: string;
  schoolLocation: string;
  degree: string;
  gpa: string;
  schoolStartDate: string;
  schoolEndDate: string;
  coursework: string;
  involvement: string;
}
export default function EducationForm() {
  const { formData, updateFormData } = useResumeContext();
  const [educationList, setEducationList] = useState<Education[]>(formData?.educationSection || []);

  const addEducation = () => {
    const newId = educationList.length > 0 ? Math.max(...educationList.map((edu) => edu.id)) + 1 : 1;
    const newEducation = { id: newId, schoolName: "", schoolLocation: "", degree: "", gpa: "", schoolStartDate: "", schoolEndDate: "", coursework: "", involvement: ""};
    const updatedEducation = [...educationList, newEducation];
    setEducationList(updatedEducation);
    updateFormData("educationSection", updatedEducation);
  };

  const removeEducation = (id: number) => {
    const updatedEducation = educationList
      .filter((edu) => edu.id !== id)
      .map((edu, index) => ({ ...edu, id: index + 1 }));
    
    setEducationList(updatedEducation);
    updateFormData("educationSection", updatedEducation);
  };

  const updateEducation = (id: number, field: string, value: string) => {
    const updatedEducation = educationList.map((edu) =>
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    setEducationList(updatedEducation);
    updateFormData("educationSection", updatedEducation);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Education</h2>

        {educationList.map((edu) => (
          <div key={edu.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Education #{edu.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeEducation(edu.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
                <FormLabel
                  icon={GraduationCap}
                  title="School Name"
                  placeholderText="Stanford University"
                  id={`schoolName-${edu.id}`}
                  value={edu.schoolName || ""}
                  onChange={(e) => updateEducation(edu.id, "schoolName", e.target.value)}
                />

                <FormLabel
                  icon={MapPin}
                  title="Location"
                  placeholderText="Stanford, CA"
                  id={`schoolLocation-${edu.id}`}
                  value={edu.schoolLocation || ""}
                  onChange={(e) => updateEducation(edu.id, "schoolLocation", e.target.value)}
                />

                <FormLabel
                  icon={Award}
                  title="Degree"
                  placeholderText="B.S. in Computer Science"
                  id={`degree-${edu.id}`}
                  value={edu.degree || ""}
                  onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                />

                <FormLabel
                  icon={BarChart}
                  title="GPA"
                  placeholderText="3.9 / 4.0"
                  id={`gpa-${edu.id}`}
                  value={edu.gpa || ""}
                  onChange={(e) => updateEducation(edu.id, "gpa", e.target.value)}
                />

                <FormLabel
                  icon={BookOpen}
                  title="Relevant Coursework"
                  placeholderText="Data Structures & Algorithms, Computer Networking,..."
                  id={`coursework-${edu.id}`}
                  value={edu.coursework || ""}
                  onChange={(e) => updateEducation(edu.id, "coursework", e.target.value)}
                />

                <FormLabel
                  icon={Users}
                  title="Involvement"
                  placeholderText="Association for Computing Machinery, Google Developer Student Club,..."
                  id={`involvement-${edu.id}`}
                  value={edu.involvement || ""}
                  onChange={(e) => updateEducation(edu.id, "involvement", e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormLabel
                    icon={Calendar}
                    title="Start Date"
                    placeholderText="Sep 2024"
                    id={`schoolStartDate-${edu.id}`}
                    value={edu.schoolStartDate || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolStartDate", e.target.value)}
                  />
                  
                  <FormLabel
                    icon={Calendar}
                    title="End Date"
                    placeholderText="Jun 2028"
                    id={`schoolEndDate-${edu.id}`}
                    value={edu.schoolEndDate || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolEndDate", e.target.value)}
                  />
                </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addEducation}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Education
        </button>
      </div>
    </div>
  );
}
