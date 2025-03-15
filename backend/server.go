package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// corsMiddleware configures CORS to allow frontend requests
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		c.Header("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func StartServer() {
	// Initialize Gin router
	r := gin.Default()

	// Apply CORS middleware
	r.Use(corsMiddleware())

	// Route to submit resume data
	r.POST("/api/resume", handleResumeSubmission)

	// Route to fetch the latest generated PDF
	r.GET("/api/resume/pdf", getResumePDF)

	// Start the server
	port := ":8080"
	log.Printf("Server running on port %s...", port)
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
