package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"text/template"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
)

var tmpl *template.Template

func init() {

	// Load the .env file, for local development
	// err := godotenv.Load()
	// if err != nil {
	// 	log.Fatal("Error loading .env file")
	// }

	// Debug: Print environment variables
	awsAccessKeyID := os.Getenv("AWS_ACCESS_KEY_ID")
	awsSecretAccessKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	awsRegion := os.Getenv("AWS_REGION")

	log.Printf("AWS_ACCESS_KEY_ID: %s", awsAccessKeyID)
	log.Printf("AWS_SECRET_ACCESS_KEY: %s", awsSecretAccessKey)
	log.Printf("AWS_REGION: %s", awsRegion)
}

func handleResumeSubmission(c *gin.Context) {
	var resume ResumeData

	// Bind JSON request to struct
	if err := c.ShouldBindJSON(&resume); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	sanitizeResume(&resume)
	log.Printf("Resume data: %+v", resume)

	var err error
	if resume.Template == "jake" {
		log.Printf("Template: %s", resume.Template)
		tmpl, err = template.ParseFiles("templates/overleaf2.tex")
		if err != nil {
			log.Fatalf("Failed to parse LaTeX template: %v", err)
		}
	} else if resume.Template == "modernjack" {
		log.Printf("Template: %s", resume.Template)
		tmpl, err = template.ParseFiles("templates/overleaf1.tex")
		if err != nil {
			log.Fatalf("Failed to parse LaTeX template: %v", err)
		}
	} else if resume.Template == "levelsfyi" {
		log.Printf("Template: %s", resume.Template)
		tmpl, err = template.ParseFiles("templates/overleaf3.tex")
		if err != nil {
			log.Fatalf("Failed to parse LaTeX template: %v", err)
		}
	} else if resume.Template == "referme" {
		log.Printf("Template: %s", resume.Template)
		tmpl, err = template.ParseFiles("templates/overleaf4.tex")
		if err != nil {
			log.Fatalf("Failed to parse LaTeX template: %v", err)
		}
	} else {
		log.Printf("Template: %s", resume.Template)
		tmpl, err = template.ParseFiles("templates/overleaf2.tex")
		if err != nil {
			log.Fatalf("Failed to parse LaTeX template: %v", err)
		}
	}
	pdfPath, err := generatePDF(resume)
	if err != nil {
		log.Printf("Failed to generate PDF: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	// Upload PDF to S3 (overwrite if it already exists)
	bucketName := "resume-generator-pdfs"        // Replace with your bucket name
	objectKey := "resumes/" + resume.ID + ".pdf" // Unique key for each resume
	pdfURL, err := uploadPDFToS3(pdfPath, bucketName, objectKey)
	if err != nil {
		log.Printf("Failed to upload PDF to S3: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload PDF to S3"})
		return
	}

	// Delete local files
	texFilePath := "templates/generated_resume_" + resume.ID + ".tex"
	tempFiles := listTemporaryFiles(strings.TrimSuffix(pdfPath, ".pdf"))
	allFiles := append([]string{pdfPath, texFilePath}, tempFiles...)
	err = deleteLocalFiles(allFiles...)
	if err != nil {
		log.Printf("Failed to delete local files: %v", err)
	}

	// Return the S3 URL and resume ID to the frontend
	c.JSON(http.StatusOK, gin.H{
		"pdf_url":   pdfURL,
		"resume_id": resume.ID, // Send the generated ID back to the frontend
	})
}

// generatePDF generates a PDF from the resume data
func generatePDF(resume ResumeData) (string, error) {
	// Generate .tex file
	texFilePath := "templates/generated_resume_" + resume.ID + ".tex"
	texFile, err := os.Create(texFilePath)
	if err != nil {
		return "", err
	}
	defer texFile.Close()

	// Execute template
	err = tmpl.Execute(texFile, resume)
	if err != nil {
		return "", err
	}

	// Compile .tex to PDF
	pdfFilePath := "templates/generated_resume_" + resume.ID + ".pdf"
	cmd := exec.Command("pdflatex", "-output-directory", "templates", texFilePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		return "", err
	}

	return pdfFilePath, nil
}

// uploadPDFToS3 uploads a file to AWS S3
func uploadPDFToS3(filePath string, bucketName string, objectKey string) (string, error) {
	awsAccessKeyID := os.Getenv("AWS_ACCESS_KEY_ID")
	awsSecretAccessKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	awsRegion := os.Getenv("AWS_REGION")
	if awsAccessKeyID == "" || awsSecretAccessKey == "" || awsRegion == "" {
		log.Fatal("AWS credentials and region must be set in environment variables")
	}
	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(awsRegion),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(awsAccessKeyID, awsSecretAccessKey, "")),
	)
	if err != nil {
		return "", err
	}

	// Create S3 client
	client := s3.NewFromConfig(cfg)

	// Open the file
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Upload the file to S3
	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
		Body:   file,
	})
	if err != nil {
		return "", err
	}

	// Generate the S3 object URL
	objectURL := "https://" + bucketName + ".s3.amazonaws.com/" + objectKey
	return objectURL, nil
}

// deleteLocalFiles deletes files from the local filesystem
func deleteLocalFiles(filePaths ...string) error {
	for _, filePath := range filePaths {
		err := os.Remove(filePath)
		if err != nil {
			return err
		}
	}
	return nil
}

// listTemporaryFiles lists temporary files generated by pdflatex
func listTemporaryFiles(basePath string) []string {
	extensions := []string{".aux", ".log", ".out"}
	var files []string

	for _, ext := range extensions {
		filePath := basePath + ext
		if _, err := os.Stat(filePath); err == nil {
			files = append(files, filePath)
		}
	}

	return files
}
