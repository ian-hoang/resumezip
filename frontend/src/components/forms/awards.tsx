"use client"

import { useResumeContext } from "@/context/ResumeContext";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface CertificationAward {
  id: number;
  awardName: string;
  awardOrg: string;
  awardDate: string;
}

export default function CertificationAwardsForm() {
  const { formData, updateFormData } = useResumeContext();
  const [certifications, setCertifications] = useState<CertificationAward[]>(
    formData?.awardsSection ?? []
  );

  const addCertification = () => {
    const newId =
      certifications.length > 0
        ? Math.max(...certifications.map((cert) => cert.id)) + 1
        : 1;
    const newCertification: CertificationAward = {
      id: newId,
      awardName: "",
      awardOrg: "",
      awardDate: "",
    };
    const updatedCertifications = [...certifications, newCertification];
    setCertifications(updatedCertifications);
    updateFormData("awardsSection", updatedCertifications);
  };

  const removeCertification = (id: number) => {
    const updatedCertifications = certifications
      .filter((cert) => cert.id !== id)
      .map((cert, index) => ({ ...cert, id: index + 1 }));
    setCertifications(updatedCertifications);
    updateFormData("awardsSection", updatedCertifications);
  };

  const updateCertification = (id: number, field: string, value: string) => {
    const updatedCertifications = certifications.map((cert) =>
      cert.id === id ? { ...cert, [field]: value } : cert
    );
    setCertifications(updatedCertifications);
    updateFormData("awardsSection", updatedCertifications);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Certification & Awards</h2>
        {certifications.map((cert) => (
          <div key={cert.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Certification/Award #{cert.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeCertification(cert.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor={`awardName-${cert.id}`} className="text-sm font-medium">
                  Certification/Award Name
                </label>
                <input
                  id={`awardName-${cert.id}`}
                  value={cert.awardName}
                  onChange={(e) => updateCertification(cert.id, "awardName", e.target.value)}
                  placeholder="Certification or Award Name"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`awardOrg-${cert.id}`} className="text-sm font-medium">
                  Organizer
                </label>
                <input
                  id={`awardOrg-${cert.id}`}
                  value={cert.awardOrg}
                  onChange={(e) => updateCertification(cert.id, "awardOrg", e.target.value)}
                  placeholder="Organization or Issuer"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`awardDate-${cert.id}`} className="text-sm font-medium">
                  Date
                </label>
                <input
                  id={`awardDate-${cert.id}`}
                  value={cert.awardDate}
                  onChange={(e) => updateCertification(cert.id, "awardDate", e.target.value)}
                  placeholder="MM/YYYY"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addCertification}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Certification/Award
        </button>
      </div>
    </div>
  );
}
