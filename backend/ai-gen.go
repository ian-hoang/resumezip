package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Request body structure
type RequestBody struct {
	JobDesc string `json:"jobDesc"` // Receives job description from frontend
}

// Response body structure
type ResponseBody struct {
	OptimizedText string `json:"optimizedText"` // Sends the optimized text back to frontend
}

// DeepSeek API request structure
type DeepSeekRequest struct {
	Model    string              `json:"model"`
	Messages []map[string]string `json:"messages"`
}

// DeepSeek API response structure
type DeepSeekResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Handler for improving the job description
func improveJobDescHandler(c *gin.Context) {
	var reqBody RequestBody
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	optimizedText, err := callDeepSeekAPI(reqBody.JobDesc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call DeepSeek API"})
		return
	}

	response := ResponseBody{OptimizedText: optimizedText}
	c.JSON(http.StatusOK, response)
}

// Call DeepSeek API to improve the job description
func callDeepSeekAPI(jobDesc string) (string, error) {
	apiURL := "https://api.deepseek.com/v1/chat/completions"

	// Prepare the request payload
	requestData := DeepSeekRequest{
		Model: "deepseek-chat",
		Messages: []map[string]string{
			{"role": "system", "content": "You are a technical recruiter at Google. Improve this job description while keeping the exact format (spaces, bullet points, structure)."},
			{"role": "user", "content": jobDesc},
		},
	}

	jsonData, _ := json.Marshal(requestData)

	// Create POST request
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	// Set required headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sk-9fedd71d5bfc4b15bd7783c6b22d706e")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Unmarshal the JSON response
	var deepSeekResp DeepSeekResponse
	if err := json.Unmarshal(body, &deepSeekResp); err != nil {
		return "", err
	}

	return deepSeekResp.Choices[0].Message.Content, nil
}
