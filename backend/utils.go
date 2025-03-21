package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Custom unmarshaler for WorkExperience
func (we *WorkExperience) UnmarshalJSON(data []byte) error {
	// Define a temporary struct to parse the raw JSON
	type Alias WorkExperience
	temp := &struct {
		Description string `json:"workDescription"` // Parse description as a string
		*Alias
	}{
		Alias: (*Alias)(we),
	}

	// Unmarshal the raw JSON into the temporary struct
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}
	// Split the description string into an array of strings
	descriptions := strings.Split(temp.Description, "\n")
	fmt.Println("Initial Descriptions:", descriptions)

	// Filter out empty strings
	var filteredDescriptions []string
	for _, desc := range descriptions {
		trimmedDesc := strings.TrimSpace(desc) // Remove leading/trailing whitespace
		if trimmedDesc != "" {                 // Remove empty lines
			// Remove "•" or "• " prefix if present
			trimmedDesc = strings.TrimPrefix(trimmedDesc, "•")
			trimmedDesc = strings.TrimPrefix(trimmedDesc, "• ")
			fmt.Println("Trimmed Description:", trimmedDesc)
			filteredDescriptions = append(filteredDescriptions, trimmedDesc)
		}
	}

	fmt.Println("Filtered Descriptions:", filteredDescriptions)

	// Assign the filtered descriptions
	we.Description = filteredDescriptions

	return nil
}

func (p *Project) UnmarshalJSON(data []byte) error {
	type Alias Project
	temp := &struct {
		Description string `json:"projectDescription"` // Parse description as a string
		*Alias
	}{
		Alias: (*Alias)(p),
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	descriptions := strings.Split(temp.Description, "\n")

	// Filter out empty strings
	var filteredDescriptions []string
	for _, desc := range descriptions {
		if strings.TrimSpace(desc) != "" { // Remove whitespace-only entries
			filteredDescriptions = append(filteredDescriptions, desc)
		}
	}
	// Assign the filtered descriptions
	p.Description = filteredDescriptions
	return nil
}

func (v *Volunteership) UnmarshalJSON(data []byte) error {
	type Alias Volunteership
	temp := &struct {
		Description string `json:"volunteerDescription"` // Parse description as a string
		*Alias
	}{
		Alias: (*Alias)(v),
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}
	descriptions := strings.Split(temp.Description, "\n")
	// Filter out empty strings
	var filteredDescriptions []string
	for _, desc := range descriptions {
		if strings.TrimSpace(desc) != "" { // Remove whitespace-only entries
			filteredDescriptions = append(filteredDescriptions, desc)
		}
	}
	// Assign the filtered descriptions
	v.Description = filteredDescriptions
	return nil
}

func (l *Leadership) UnmarshalJSON(data []byte) error {
	type Alias Leadership
	temp := &struct {
		Description string `json:"leadershipDescription"` // Parse description as a string
		*Alias
	}{
		Alias: (*Alias)(l),
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}
	descriptions := strings.Split(temp.Description, "\n")
	// Filter out empty strings
	var filteredDescriptions []string
	for _, desc := range descriptions {
		if strings.TrimSpace(desc) != "" { // Remove whitespace-only entries
			filteredDescriptions = append(filteredDescriptions, desc)
		}
	}
	// Assign the filtered descriptions
	l.Description = filteredDescriptions

	return nil
}

// Escape special LaTeX characters
func escapeLaTeX(s string) string {
	replacer := strings.NewReplacer(
		"\\", "\\textbackslash{}",
		"#", "\\#",
		"$", "\\$",
		"%", "\\%",
		"&", "\\&",
		"_", "\\_",
		"{", "\\{",
		"}", "\\}",
		"~", "\\textasciitilde{}",
		"^", "\\textasciicircum{}",
	)
	return replacer.Replace(s)
}

// Sanitize resume data for LaTeX
func sanitizeResume(resume *ResumeData) {
	resume.Profile.Name = escapeLaTeX(resume.Profile.Name)
	resume.Profile.Email = escapeLaTeX(resume.Profile.Email)
	resume.Profile.Phone = escapeLaTeX(resume.Profile.Phone)
	resume.Profile.LinkedIn = escapeLaTeX(resume.Profile.LinkedIn)
	resume.Profile.Github = escapeLaTeX(resume.Profile.Github)
	resume.Profile.Website = escapeLaTeX(resume.Profile.Website)

	for i := range resume.Educations {
		resume.Educations[i].School = escapeLaTeX(resume.Educations[i].School)
		resume.Educations[i].Location = escapeLaTeX(resume.Educations[i].Location)
		resume.Educations[i].Degree = escapeLaTeX(resume.Educations[i].Degree)
		resume.Educations[i].GPA = escapeLaTeX(resume.Educations[i].GPA)
		resume.Educations[i].StartDate = escapeLaTeX(resume.Educations[i].StartDate)
		resume.Educations[i].EndDate = escapeLaTeX(resume.Educations[i].EndDate)
		resume.Educations[i].Coursework = escapeLaTeX(resume.Educations[i].Coursework)
		resume.Educations[i].Involvement = escapeLaTeX(resume.Educations[i].Involvement)
	}

	for i := range resume.WorkExperiences {
		resume.WorkExperiences[i].CompanyName = escapeLaTeX(resume.WorkExperiences[i].CompanyName)
		resume.WorkExperiences[i].Location = escapeLaTeX(resume.WorkExperiences[i].Location)
		resume.WorkExperiences[i].Role = escapeLaTeX(resume.WorkExperiences[i].Role)
		resume.WorkExperiences[i].StartDate = escapeLaTeX(resume.WorkExperiences[i].StartDate)
		resume.WorkExperiences[i].EndDate = escapeLaTeX(resume.WorkExperiences[i].EndDate)
		for j := range resume.WorkExperiences[i].Description {
			resume.WorkExperiences[i].Description[j] = escapeLaTeX(resume.WorkExperiences[i].Description[j])
		}
	}

	for i := range resume.Skills {
		resume.Skills[i].Name = escapeLaTeX(resume.Skills[i].Name)
		resume.Skills[i].Details = escapeLaTeX(resume.Skills[i].Details)
	}

	for i := range resume.Projects {
		resume.Projects[i].Name = escapeLaTeX(resume.Projects[i].Name)
		resume.Projects[i].TechStack = escapeLaTeX(resume.Projects[i].TechStack)
		resume.Projects[i].Github = escapeLaTeX(resume.Projects[i].Github)
		resume.Projects[i].Website = escapeLaTeX(resume.Projects[i].Website)
		for j := range resume.Projects[i].Description {
			resume.Projects[i].Description[j] = escapeLaTeX(resume.Projects[i].Description[j])
		}
	}

	for i := range resume.Volunteerships {
		resume.Volunteerships[i].Organization = escapeLaTeX(resume.Volunteerships[i].Organization)
		resume.Volunteerships[i].Location = escapeLaTeX(resume.Volunteerships[i].Location)
		resume.Volunteerships[i].Role = escapeLaTeX(resume.Volunteerships[i].Role)
		resume.Volunteerships[i].StartDate = escapeLaTeX(resume.Volunteerships[i].StartDate)
		resume.Volunteerships[i].EndDate = escapeLaTeX(resume.Volunteerships[i].EndDate)
		for j := range resume.Volunteerships[i].Description {
			resume.Volunteerships[i].Description[j] = escapeLaTeX(resume.Volunteerships[i].Description[j])
		}
	}

	for i := range resume.Leaderships {
		resume.Leaderships[i].Organization = escapeLaTeX(resume.Leaderships[i].Organization)
		resume.Leaderships[i].Location = escapeLaTeX(resume.Leaderships[i].Location)
		resume.Leaderships[i].Role = escapeLaTeX(resume.Leaderships[i].Role)
		resume.Leaderships[i].StartDate = escapeLaTeX(resume.Leaderships[i].StartDate)
		resume.Leaderships[i].EndDate = escapeLaTeX(resume.Leaderships[i].EndDate)
		for j := range resume.Leaderships[i].Description {
			resume.Leaderships[i].Description[j] = escapeLaTeX(resume.Leaderships[i].Description[j])
		}
	}

	for i := range resume.Awards {
		resume.Awards[i].Name = escapeLaTeX(resume.Awards[i].Name)
		resume.Awards[i].Organization = escapeLaTeX(resume.Awards[i].Organization)
		resume.Awards[i].Date = escapeLaTeX(resume.Awards[i].Date)
	}
}
