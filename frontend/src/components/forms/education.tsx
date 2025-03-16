"use client"

import { useResumeContext } from "@/context/ResumeContext";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Building, MapPin, User } from "lucide-react";
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
                <div className="space-y-2">
                  <label htmlFor={`schoolName-${edu.id}`} className="text-sm font-medium">
                    School Name
                  </label>
                  <input
                    id={`schoolName-${edu.id}`}
                    value={edu.schoolName || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolName", e.target.value)}
                    placeholder="Stanford University"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`schoolLocation-${edu.id}`} className="text-sm font-medium">
                    Location
                  </label>
                  <input
                    id={`schoolLocation-${edu.id}`}
                    value={edu.schoolLocation || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolLocation", e.target.value)}
                    placeholder="Stanford, CA"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`degree-${edu.id}`} className="text-sm font-medium">
                    Degree
                  </label>
                  <input
                    id={`degree-${edu.id}`}
                    value={edu.degree || ""}
                    onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                    placeholder="B.S. in Computer Science"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`gpa-${edu.id}`} className="text-sm font-medium">
                    GPA
                  </label>
                  <input
                    id={`gpa-${edu.id}`}
                    value={edu.gpa || ""}
                    onChange={(e) => updateEducation(edu.id, "gpa", e.target.value)}
                    placeholder="3.9 / 4.0"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`coursework-${edu.id}`} className="text-sm font-medium">
                    Relevant Coursework
                  </label>
                  <input
                    id={`coursework-${edu.id}`}
                    value={edu.coursework || ""}
                    onChange={(e) => updateEducation(edu.id, "coursework", e.target.value)}
                    placeholder="Data Structures & Algorithms, Computer Networking,..."
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`involvement-${edu.id}`} className="text-sm font-medium">
                    Involvement
                  </label>
                  <input
                    id={`involvement-${edu.id}`}
                    value={edu.involvement || ""}
                    onChange={(e) => updateEducation(edu.id, "involvement", e.target.value)}
                    placeholder="Association for Computing Machinery, Google Developer Student Club,..."
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor={`schoolStartDate-${edu.id}`} className="text-sm font-medium">
                      Start Date
                    </label>
                    <input
                      id={`schoolStartDate-${edu.id}`}
                      value={edu.schoolStartDate || ''}
                      onChange={(e) => updateEducation(edu.id, "schoolStartDate", e.target.value)}
                      placeholder="Sep 2024"
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`schoolEndDate-${edu.id}`} className="text-sm font-medium">
                      End Date
                    </label>
                    <input
                      id={`schoolEndDate-${edu.id}`}
                      value={edu.schoolEndDate || ''}
                      onChange={(e) => updateEducation(edu.id, "schoolEndDate", e.target.value)}
                      placeholder="Jun 2028"
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>
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
