package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORS middleware to handle cross-origin requests
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Define allowed origins
		allowedOrigins := []string{
			"https://resumezip.io",
			"https://www.resumezip.io",
			"http://localhost:3000",
		}

		// Get the Origin header from the request
		origin := c.Request.Header.Get("Origin")

		// Check if the request's origin is allowed
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				// Set the Access-Control-Allow-Origin header
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		// Set the other CORS-related headers
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		c.Header("Access-Control-Allow-Credentials", "true")

		// If the method is OPTIONS, return a no content response for preflight checks
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		// Proceed with the request
		c.Next()
	}
}

// HealthCheckHandler returns a simple 200 OK status for health check
func healthCheckHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
	})
}

// StartServer initializes and starts the Gin server
func StartServer() {
	// Create a Gin router with default middleware
	r := gin.Default()

	// Apply CORS middleware to the router
	r.Use(corsMiddleware())

	// Define routes
	r.POST("/api/resume", handleResumeSubmission)      // Route for resume submission
	r.POST("/improve-job-desc", improveJobDescHandler) // Route for improving job descriptions using Together AI

	// Add a health check endpoint (this will be used by ALB)
	r.GET("/health", healthCheckHandler) // Health check route

	// Define server port
	port := ":8080"
	log.Printf("Server running on port %s...", port)

	// Start the server and handle any errors
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
