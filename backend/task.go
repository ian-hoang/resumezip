package main

// import (
// 	"context"
// 	"encoding/json"
// 	"fmt"
// 	"log"
// 	"time"

// 	"github.com/hibiken/asynq"
// 	"github.com/redis/go-redis/v9"
// )

// // Task Payload
// type ResumeTaskPayload struct {
// 	ResumeData ResumeData `json:"resume_data"`
// 	TaskID     string     `json:"task_id"`
// }

// // Redis Client for storing task statuses
// var redisClient = redis.NewClient(&redis.Options{
// 	Addr: "localhost:6379", // Change if Redis is running on a different host
// })

// // Enqueue Resume Generation Job
// func enqueueResumeGenerationTask(resume ResumeData) (string, error) {
// 	taskID := fmt.Sprintf("task:%d", time.Now().UnixNano()) // Unique task ID
// 	log.Printf("Task ID: %v", taskID)
// 	payload, err := json.Marshal(ResumeTaskPayload{ResumeData: resume, TaskID: taskID})
// 	if err != nil {
// 		return "", err
// 	}

// 	// Create Asynq client
// 	client := asynq.NewClient(asynq.RedisClientOpt{Addr: "localhost:6379"})
// 	defer client.Close()

// 	task := asynq.NewTask("resume:generate", payload)
// 	info, err := client.Enqueue(task, asynq.MaxRetry(3), asynq.Timeout(60*time.Second))
// 	if err != nil {
// 		return "", err
// 	}

// 	// Store initial status in Redis
// 	redisClient.Set(context.Background(), taskID, "processing", 0)

// 	log.Printf("Enqueued task: %s", info.ID)
// 	return taskID, nil
// }

// // Poll for task status
// func getTaskStatus(taskID string) (string, error) {
// 	status, err := redisClient.Get(context.Background(), taskID).Result()
// 	if err == redis.Nil {
// 		return "not_found", nil
// 	} else if err != nil {
// 		return "", err
// 	}
// 	return status, nil
// }
