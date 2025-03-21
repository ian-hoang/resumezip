package main

// import (
// 	"context"
// 	"encoding/json"
// 	"fmt"

// 	"github.com/hibiken/asynq"
// )

// func resumeTaskHandler(ctx context.Context, task *asynq.Task) error {
// 	var payload ResumeTaskPayload
// 	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
// 		fmt.Printf("Failed to parse task payload: %v, payload: %+v\n", err, payload)
// 		return err
// 	}
// 	fmt.Println("Task received, processing...")

// 	// Generate PDF
// 	pdfPath, err := generatePDF(payload.ResumeData)
// 	if err != nil {
// 		fmt.Printf("Failed to generate PDF: %v\n", err)
// 		redisClient.Set(ctx, payload.TaskID, "failed", 0)
// 		return err
// 	}

// 	fmt.Println("PDF generated at:", pdfPath)

// 	// Upload to S3
// 	bucketName := "resume-generator-pdfs"
// 	objectKey := "resumes/" + payload.ResumeData.ID + ".pdf"
// 	pdfURL, err := uploadPDFToS3(pdfPath, bucketName, objectKey)
// 	if err != nil {
// 		fmt.Printf("Failed to upload PDF to S3: %v\n", err)
// 		redisClient.Set(ctx, payload.TaskID, "failed", 0)
// 		return err
// 	}

// 	fmt.Println("PDF uploaded to S3 successfully:", pdfURL)

// 	// Update status in Redis
// 	redisClient.Set(ctx, payload.TaskID, pdfURL, 0)
// 	fmt.Println("Task completed successfully.")
// 	return nil
// }
