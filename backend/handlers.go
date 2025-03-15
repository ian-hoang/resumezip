package main

import (
	"log"
	"net/http"
	"os"
	"os/exec"
	"text/template"

	"github.com/gin-gonic/gin"
)

// handleResumeSubmission processes incoming resume JSON data
func handleResumeSubmission(c *gin.Context) {
	var resume ResumeData

	// Bind JSON request to struct
	if err := c.ShouldBindJSON(&resume); err != nil {
		log.Printf("Failed to decode JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	sanitizeResume(&resume)

	// Read LaTeX template from file
	tmpl, err := template.ParseFiles("templates/overleaf1.tex")
	if err != nil {
		log.Printf("Failed to parse LaTeX template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read template"})
		return
	}

	// Open file to write the LaTeX output
	texFilePath := "templates/generated_resume.tex"
	texFile, err := os.Create(texFilePath)
	if err != nil {
		log.Printf("Failed to create LaTeX file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate LaTeX file"})
		return
	}
	defer texFile.Close()

	// Execute the template with the resume data
	err = tmpl.Execute(texFile, resume)
	if err != nil {
		log.Printf("Failed to generate LaTeX: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate LaTeX"})
		return
	}

	cmd := exec.Command("pdflatex", "-output-directory", "templates", texFilePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		log.Printf("Failed to generate PDF: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	// Respond with success message
	c.JSON(http.StatusOK, gin.H{"message": "Resume generated successfully, .tex file created"})
}

func getResumePDF(c *gin.Context) {
	filePath := "templates/generated_resume.pdf" // Ensure this is the correct path

	// Check if the file exists before serving
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "PDF not found"})
		return
	}
	c.Header("Access-Control-Allow-Origin", "http://localhost:3000")

	// Serve the file
	c.File(filePath)
}
