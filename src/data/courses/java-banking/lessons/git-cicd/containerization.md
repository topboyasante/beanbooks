---
id: "containerization"
moduleId: "git-cicd"
title: "Containerization"
description: "Package and deploy banking applications with Docker and docker-compose."
order: 4
---

## Banking Scenario

JavaBank is preparing to launch a new loan origination service. The development team builds and tests it on macOS with Java 17, but the staging server runs Ubuntu with Java 11 pre-installed. During the first staging deployment, the application crashes with cryptic class version errors. The operations team spends two days troubleshooting environment differences. Meanwhile, the QA team cannot reproduce a critical bug because their local setup uses a different PostgreSQL version than production.

The engineering director decides to containerize all services. With Docker, every environment -- developer laptops, CI pipelines, staging, and production -- runs the exact same image. No more "it works on my machine." In banking, where consistency and reproducibility are regulatory requirements, containers have become the standard for packaging and deploying applications.

## Content

### What Containers Solve

A container packages your application with its entire runtime environment: the OS layer, Java version, dependencies, and configuration. Unlike virtual machines, containers share the host kernel and start in seconds. This solves the fundamental problem of environment inconsistency and makes deployments predictable and repeatable.

### Dockerfile Anatomy

A Dockerfile is a recipe for building a container image. Each instruction creates a layer:

```bash
# Dockerfile for JavaBank Loan Service
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/loan-service.jar app.jar
RUN addgroup -S javabank && adduser -S javabank -G javabank
USER javabank
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

- `FROM` -- base image (use slim/alpine variants for smaller images)
- `WORKDIR` -- sets the working directory inside the container
- `COPY` -- copies files from host to container
- `RUN` -- executes commands during build
- `EXPOSE` -- documents which port the app listens on
- `CMD` -- the command to run when the container starts

### Multi-Stage Builds

Banking applications should use multi-stage builds to keep production images small and secure. The build stage compiles the code; the runtime stage contains only the JRE and the JAR:

```bash
# Stage 1: Build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

This produces an image that is hundreds of megabytes smaller than one that includes Maven and the full JDK, reducing the attack surface for security.

### The .dockerignore File

Similar to `.gitignore`, the `.dockerignore` file excludes files from the build context:

```bash
.git
.idea
target
*.md
.env
docker-compose.yml
```

### Docker Compose for Local Development

Banking services rarely run alone. A typical setup includes the application, a database, and a cache. Docker Compose defines all services in one file:

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/loandb
      - SPRING_REDIS_HOST=cache
    depends_on:
      - db
      - cache

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: loandb
      POSTGRES_USER: javabank
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

One command -- `docker-compose up` -- starts the entire stack. Every developer gets an identical local environment.

### Docker Networking

In Compose, services communicate by name. The `app` service connects to `db:5432` and `cache:6379` -- Docker creates a virtual network and handles DNS resolution automatically. This mirrors how services communicate in production via service discovery.

### Container Registries and Cloud Deployment

After building an image, you push it to a **container registry** (Docker Hub, AWS ECR, Google GCR) so deployment systems can pull it. In production, banking applications typically run on **Kubernetes**, which orchestrates containers at scale:

- **Pod** -- the smallest deployable unit (one or more containers)
- **Service** -- a stable network endpoint for a set of pods
- **Deployment** -- manages pod replicas, rolling updates, and rollbacks

Kubernetes ensures your loan service stays available even if individual containers fail, and it enables zero-downtime deployments that banking SLAs demand.

## Why It Matters

Containerization eliminates environment inconsistency, the single most common source of deployment failures. In banking, where downtime has direct financial impact and regulatory consequences, containers provide the guarantee that tested code runs identically in every environment. Understanding Docker, multi-stage builds, and Compose is essential for any developer building modern financial applications -- and Kubernetes knowledge is increasingly expected for senior roles in the industry.

## Questions

Q: What is the primary advantage of multi-stage Docker builds for banking applications?
A) They allow running multiple applications in one container
B) They produce smaller, more secure images by separating build tools from runtime
C) They eliminate the need for a Dockerfile
D) They make containers run faster than virtual machines
Correct: B

Q: In a docker-compose.yml, how does the app service connect to the database?
A) By using the host machine's IP address
B) By using the service name as the hostname (e.g., db:5432)
C) By sharing the same container
D) By mounting the database files as a volume
Correct: B

Q: What is a Kubernetes Pod?
A) A container registry for storing Docker images
B) A YAML configuration file for Docker
C) The smallest deployable unit, containing one or more containers
D) A virtual machine that runs containers
Correct: C

## Challenge

Simulate a Docker build and deployment process for JavaBank's loan service. Create a class that prints each step: building the Docker image with multi-stage build, listing the image details, running with docker-compose, and pushing to a container registry.

## Starter Code

```java
public class DockerDeployment {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Docker Deployment ===\n");

        String service = "loan-service";
        String version = "1.0.0";
        String registry = "javabank.azurecr.io";
        int buildSizeMB = 342;
        int runtimeSizeMB = 148;

        // Step 1: Multi-stage build
        // Print build stage and runtime stage

        // Step 2: Image details
        // Print image name, size comparison

        // Step 3: Docker Compose
        // Print services starting up

        // Step 4: Push to registry
        // Print tag and push commands
    }
}
```

## Expected Output

```
=== JavaBank Docker Deployment ===

[Step 1] Multi-Stage Build
Stage 1 (build): maven:3.9-eclipse-temurin-17 -- compiling source
Stage 2 (runtime): eclipse-temurin:17-jre-alpine -- packaging JAR only
Build complete: loan-service:1.0.0

[Step 2] Image Details
Image: loan-service:1.0.0
Build stage size: 342 MB
Runtime image size: 148 MB
Size reduction: 194 MB (56%)

[Step 3] Docker Compose Up
Starting loan-service_db_1 (PostgreSQL 16) ... done
Starting loan-service_cache_1 (Redis 7) ... done
Starting loan-service_app_1 (Spring Boot) ... done
All services healthy on http://localhost:8080

[Step 4] Push to Registry
$ docker tag loan-service:1.0.0 javabank.azurecr.io/loan-service:1.0.0
$ docker push javabank.azurecr.io/loan-service:1.0.0
Pushed successfully to javabank.azurecr.io
```

## Hint

Use the variables to calculate the size reduction (buildSizeMB - runtimeSizeMB) and the percentage saved. The percentage is calculated as (reduction * 100 / buildSizeMB). Format the output to read like a real terminal session showing Docker commands and their results.

## Solution

```java
public class DockerDeployment {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Docker Deployment ===\n");

        String service = "loan-service";
        String version = "1.0.0";
        String registry = "javabank.azurecr.io";
        int buildSizeMB = 342;
        int runtimeSizeMB = 148;

        System.out.println("[Step 1] Multi-Stage Build");
        System.out.println("Stage 1 (build): maven:3.9-eclipse-temurin-17 -- compiling source");
        System.out.println("Stage 2 (runtime): eclipse-temurin:17-jre-alpine -- packaging JAR only");
        System.out.println("Build complete: " + service + ":" + version);

        System.out.println("\n[Step 2] Image Details");
        System.out.println("Image: " + service + ":" + version);
        System.out.println("Build stage size: " + buildSizeMB + " MB");
        System.out.println("Runtime image size: " + runtimeSizeMB + " MB");
        int reduction = buildSizeMB - runtimeSizeMB;
        int percent = reduction * 100 / buildSizeMB;
        System.out.println("Size reduction: " + reduction + " MB (" + percent + "%)");

        System.out.println("\n[Step 3] Docker Compose Up");
        System.out.println("Starting " + service + "_db_1 (PostgreSQL 16) ... done");
        System.out.println("Starting " + service + "_cache_1 (Redis 7) ... done");
        System.out.println("Starting " + service + "_app_1 (Spring Boot) ... done");
        System.out.println("All services healthy on http://localhost:8080");

        System.out.println("\n[Step 4] Push to Registry");
        System.out.println("$ docker tag " + service + ":" + version + " " + registry + "/" + service + ":" + version);
        System.out.println("$ docker push " + registry + "/" + service + ":" + version);
        System.out.println("Pushed successfully to " + registry);
    }
}
```
