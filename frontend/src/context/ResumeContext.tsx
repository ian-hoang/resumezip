"use client";
import React, { createContext, useState, useEffect } from "react";

const ResumeContext = createContext<any>(null);

export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  const [formData, setFormData] = useState<any>(() => {
    // Load the data from LocalStorage, if available
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("resumeData");
      return savedData ? JSON.parse(savedData) : {};
    }
    return {}; // Return empty object if no localStorage available
  });

  useEffect(() => {
    // Save form data to LocalStorage every time it changes
    if (typeof window !== "undefined") {
      localStorage.setItem("resumeData", JSON.stringify(formData));
    }
  }, [formData]);

  // Function to update specific sections of the form data
  const updateFormData = (section: string, data: any) => {
    setFormData((prevData: any) => ({
      ...prevData,
      [section]: data, // Update specific section of the data
    }));
  };

  return (
    <ResumeContext.Provider value={{ formData, updateFormData }}>
      {children}
    </ResumeContext.Provider>
  );
};

export const useResumeContext = () => React.useContext(ResumeContext);
