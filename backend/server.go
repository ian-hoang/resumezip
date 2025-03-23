package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowedOrigins := []string{
			"http://localhost:3000",
			"https://resume-zip-full.vercel.app",
			"https://resumezip.io",
			"https://www.resumezip.io",
		}

		origin := c.Request.Header.Get("Origin")

		// Check if the request's origin is in the allowed list
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

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
	r.Use(corsMiddleware())

	// Route to submit resume data
	r.POST("/api/resume", handleResumeSubmission)

	// Route to improve job description using Together AI
	r.POST("/improve-job-desc", improveJobDescHandler)

	port := ":8080"
	log.Printf("Server running on port %s...", port)
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
