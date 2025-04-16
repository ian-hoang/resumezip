package main

// ResumeData holds the main resume structure
type ResumeData struct {
	ID              string           `json:"id"`
	Profile         ProfileStruct    `json:"profileSection"`
	Educations      []Education      `json:"educationSection"`
	WorkExperiences []WorkExperience `json:"workExperienceSection"`
	Projects        []Project        `json:"projectsSection"`
	Skills          []Skill          `json:"skillsSection"`
	Leaderships     []Leadership     `json:"leadershipExperienceSection"`
	Volunteerships  []Volunteership  `json:"volunteerExperienceSection"`
	Awards          []Award          `json:"awardsSection"`
	Order           []string         `json:"sectionOrder"`
	Headings        HeadingsStruct   `json:"sectionHeadings"`
	Template        string           `json:"selectedTemplate"`
}

type ProfileStruct struct {
	Name     string `json:"fullName"`
	Phone    string `json:"phoneNumber"`
	Email    string `json:"email"`
	LinkedIn string `json:"linkedin"`
	Github   string `json:"profileGithub"`
	Website  string `json:"personalWebsite"`
}

type HeadingsStruct struct {
	EduHeading   string `json:"edu"`
	WorkHeading  string `json:"work"`
	ProjHeading  string `json:"projects"`
	SkillHeading string `json:"skills"`
	LeadHeading  string `json:"leadership"`
	VolHeading   string `json:"volunteer"`
	AwardHeading string `json:"awards"`
}

// Education structure for each education entry
type Education struct {
	ID          int    `json:"id"`
	School      string `json:"schoolName"`
	Location    string `json:"schoolLocation"`
	Degree      string `json:"degree"`
	GPA         string `json:"gpa"`
	StartDate   string `json:"schoolStartDate"`
	EndDate     string `json:"schoolEndDate"`
	Coursework  string `json:"coursework"`
	Involvement string `json:"involvement"`
}

// WorkExperience structure for each work experience entry
type WorkExperience struct {
	ID          int      `json:"id"`
	CompanyName string   `json:"companyName"`
	Location    string   `json:"workLocation"`
	Role        string   `json:"workRole"`
	Description []string `json:"workDescription"`
	StartDate   string   `json:"workStartDate"`
	EndDate     string   `json:"workEndDate"`
}

// Skill structure for each skill entry
type Skill struct {
	ID      int    `json:"id"`
	Name    string `json:"skillName"`
	Details string `json:"skillDetails"`
}

// Project structure for each project entry
type Project struct {
	ID          int      `json:"id"`
	Name        string   `json:"projectName"`
	TechStack   string   `json:"techStack"`
	Date        string   `json:"projectDate"`
	Github      string   `json:"projectGithub"`
	Website     string   `json:"additionalLink"`
	Description []string `json:"projectDescription"`
}

// Volunteership structure for each volunteer experience entry
type Volunteership struct {
	ID           int      `json:"id"`
	Organization string   `json:"volunteerOrg"`
	Location     string   `json:"volunteerLocation"`
	Role         string   `json:"volunteerRole"`
	StartDate    string   `json:"volunteerStartDate"`
	EndDate      string   `json:"volunteerEndDate"`
	Description  []string `json:"volunteerDescription"`
}

// Leadership structure for each leadership experience entry
type Leadership struct {
	ID           int      `json:"id"`
	Organization string   `json:"leadershipOrg"`
	Location     string   `json:"leadershipLocation"`
	Role         string   `json:"leadershipRole"`
	StartDate    string   `json:"leadershipStartDate"`
	EndDate      string   `json:"leadershipEndDate"`
	Description  []string `json:"leadershipDescription"`
}

// Award structure for each award entry
type Award struct {
	ID           int    `json:"id"`
	Name         string `json:"awardName"`
	Organization string `json:"awardOrg"`
	Date         string `json:"awardDate"`
}
