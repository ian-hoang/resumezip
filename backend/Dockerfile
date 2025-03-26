ARG TARGETARCH=amd64

# Use the official Golang image as the base image
FROM golang:1.24-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy the Go module files
COPY go.mod go.sum ./

# Download Go dependencies
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the Go application
RUN go build -o resume-generator .

# Use a lightweight Alpine image for the final stage
FROM alpine:latest

# Install dependencies for pdflatex (and any other required tools)
RUN apk add --no-cache texlive-full

# Set the working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/resume-generator .

# Copy the LaTeX template directory
COPY templates ./templates

# Expose the port the server will run on
EXPOSE 8080

# Command to run the application
CMD ["./resume-generator"]