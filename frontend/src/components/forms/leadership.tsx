"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

interface LeadershipExperience {
  id: number;
  leadershipOrg: string;
  leadershipLocation: string;
  leadershipRole: string;
  leadershipStartDate: string;
  leadershipEndDate: string;
  leadershipDescription: string;
}

export default function LeadershipExperienceForm() {
  const { formData, updateFormData } = useResumeContext();
  const [leadershipExperiences, setLeadershipExperiences] = useState<LeadershipExperience[]>(formData?.leadershipExperienceSection ?? []);

  const addLeadershipExperience = () => {
    const newId = leadershipExperiences.length > 0 ? Math.max(...leadershipExperiences.map((exp) => exp.id)) + 1 : 1;
    const newExperience: LeadershipExperience = { id: newId, leadershipOrg: "", leadershipLocation: "", leadershipRole: "", leadershipStartDate: "", leadershipEndDate: "", leadershipDescription: "" };
    const updatedExperiences = [...leadershipExperiences, newExperience];
    setLeadershipExperiences(updatedExperiences);
    updateFormData("leadershipExperienceSection", updatedExperiences);
  };

  const removeLeadershipExperience = (id: number) => {
    const updatedExperiences = leadershipExperiences
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }));
    setLeadershipExperiences(updatedExperiences);
    updateFormData("leadershipExperienceSection", updatedExperiences);
  };

  const updateLeadershipExperience = (id: number, field: string, value: string | string[]) => {
    const updatedExperiences = leadershipExperiences.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    setLeadershipExperiences(updatedExperiences);
    updateFormData("leadershipExperienceSection", updatedExperiences);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Leadership Experience</h2>

        {leadershipExperiences.map((experience) => (
          <div key={experience.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Leadership Experience #{experience.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeLeadershipExperience(experience.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor={`leadershipOrg-${experience.id}`} className="text-sm font-medium">
                    Organization
                  </label>
                  <input
                    id={`leadershipOrg-${experience.id}`}
                    value={experience.leadershipOrg}
                    onChange={(e) => updateLeadershipExperience(experience.id, "leadershipOrg", e.target.value)}
                    placeholder="Organization Name"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`leadershipLocation-${experience.id}`} className="text-sm font-medium">
                    Location
                  </label>
                  <input
                    id={`leadershipLocation-${experience.id}`}
                    value={experience.leadershipLocation}
                    onChange={(e) => updateLeadershipExperience(experience.id, "leadershipLocation", e.target.value)}
                    placeholder="Location"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`leadershipRole-${experience.id}`} className="text-sm font-medium">
                    Role
                  </label>
                  <input
                    id={`leadershipRole-${experience.id}`}
                    value={experience.leadershipRole}
                    onChange={(e) => updateLeadershipExperience(experience.id, "leadershipRole", e.target.value)}
                    placeholder="Your Role"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`leadershipDescription-${experience.id}`} className="text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    id={`leadershipDescription-${experience.id}`}
                    value={experience.leadershipDescription || ''}
                    onChange={(e) => updateLeadershipExperience(experience.id, "leadershipDescription", e.target.value)}
                    placeholder="Describe your responsibilities and contributions"
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor={`leadershipStartDate-${experience.id}`} className="text-sm font-medium">
                      Start Date
                    </label>
                    <input
                      id={`leadershipStartDate-${experience.id}`}
                      value={experience.leadershipStartDate || ''}
                      onChange={(e) => updateLeadershipExperience(experience.id, "leadershipStartDate", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={`leadershipEndDate-${experience.id}`} className="text-sm font-medium">
                      End Date
                    </label>
                    <input
                      id={`leadershipEndDate-${experience.id}`}
                      value={experience.leadershipEndDate || ''}
                      onChange={(e) => updateLeadershipExperience(experience.id, "leadershipEndDate", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addLeadershipExperience}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Leadership Experience
        </button>
      </div>
    </div>
  )
}
