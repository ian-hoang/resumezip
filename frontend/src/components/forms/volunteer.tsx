"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Building, MapPin, User, Calendar } from "lucide-react";
import FormLabel from "../form-label";
import FormDescription from "../form-description";

interface VolunteerExperience {
  id: number;
  volunteerOrg: string;
  volunteerLocation: string;
  volunteerRole: string;
  volunteerStartDate: string;
  volunteerEndDate: string;
  volunteerDescription: string;
}

export default function VolunteerExperienceForm() {
  const { formData, updateFormData } = useResumeContext();
  const [volunteerExperiences, setVolunteerExperiences] = useState<VolunteerExperience[]>(formData?.volunteerExperienceSection ?? []);

  const addVolunteerExperience = () => {
    const newId = volunteerExperiences.length > 0 ? Math.max(...volunteerExperiences.map((exp) => exp.id)) + 1 : 1;
    const newExperience: VolunteerExperience = { id: newId, volunteerOrg: "", volunteerLocation: "", volunteerRole: "", volunteerStartDate: "", volunteerEndDate: "", volunteerDescription: "" };
    const updatedExperiences = [...volunteerExperiences, newExperience];
    setVolunteerExperiences(updatedExperiences);
    updateFormData("volunteerExperienceSection", updatedExperiences);
  };

  const removeVolunteerExperience = (id: number) => {
    const updatedExperiences = volunteerExperiences
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }));
    setVolunteerExperiences(updatedExperiences);
    updateFormData("volunteerExperienceSection", updatedExperiences);
  };

  const updateVolunteerExperience = (id: number, field: string, value: string | string[]) => {
    const updatedExperiences = volunteerExperiences.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    setVolunteerExperiences(updatedExperiences);
    updateFormData("volunteerExperienceSection", updatedExperiences);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Volunteer Experience</h2>

        {volunteerExperiences.map((experience) => (
          <div key={experience.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Volunteer Experience #{experience.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeVolunteerExperience(experience.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">

                <FormLabel 
                  icon={Building} 
                  title="Organization" 
                  placeholderText="Organization Name" 
                  id={`volunteerOrg-${experience.id}`}
                  value={experience.volunteerOrg}
                  onChange={(e) => updateVolunteerExperience(experience.id, "volunteerOrg", e.target.value)}
                />

                <FormLabel
                  icon={MapPin}
                  title="Location"
                  placeholderText="Location"
                  id={`volunteerLocation-${experience.id}`}
                  value={experience.volunteerLocation}
                  onChange={(e) => updateVolunteerExperience(experience.id, "volunteerLocation", e.target.value)}
                />
                <FormLabel
                  icon={User}
                  title="Role"
                  placeholderText="Your Role"
                  id={`volunteerRole-${experience.id}`}
                  value={experience.volunteerRole}
                  onChange={(e) => updateVolunteerExperience(experience.id, "volunteerRole", e.target.value)}
                />

                <FormDescription
                  id={`volunteerDescription-${experience.id}`}
                  title="Volunteer Description"
                  placeholderText="Describe your responsibilities and contributions"
                  value={experience.volunteerDescription}
                  onChange={(e) => updateVolunteerExperience(experience.id, "volunteerDescription", e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormLabel
                    icon={Calendar}
                    title="Start Date"
                    placeholderText="Start Date"
                    id={`volunteerStartDate-${experience.id}`}
                    value={experience.volunteerStartDate}
                    onChange={(e) => updateVolunteerExperience(experience.id, "volunteerStartDate", e.target.value)}
                  />
                  
                  <FormLabel
                    icon={Calendar}
                    title="End Date"
                    placeholderText="End Date"
                    id={`volunteerEndDate-${experience.id}`}
                    value={experience.volunteerEndDate}
                    onChange={(e) => updateVolunteerExperience(experience.id, "volunteerEndDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addVolunteerExperience}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Volunteer Experience
        </button>
      </div>
    </div>
  )
}
