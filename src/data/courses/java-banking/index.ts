import type { Course } from "@/types/learning"
import { parseLesson } from "@/lib/parse-lesson"

// Module 1: Java Platform & Setup
import howJavaWorksRaw from "./lessons/java-platform/how-java-works.md?raw"
import yourFirstProgramRaw from "./lessons/java-platform/your-first-program.md?raw"
import devEnvironmentRaw from "./lessons/java-platform/development-environment.md?raw"
import buildToolsRaw from "./lessons/java-platform/build-tools.md?raw"

// Module 2: Java Basics
import variablesRaw from "./lessons/java-basics/variables-and-data-types.md?raw"
import operatorsRaw from "./lessons/java-basics/operators-and-expressions.md?raw"
import controlFlowRaw from "./lessons/java-basics/control-flow.md?raw"
import loopsRaw from "./lessons/java-basics/loops.md?raw"
import arraysRaw from "./lessons/java-basics/arrays.md?raw"

// Module 3: Object-Oriented Programming
import classesRaw from "./lessons/oop/classes-and-objects.md?raw"
import encapsulationRaw from "./lessons/oop/encapsulation.md?raw"
import inheritanceRaw from "./lessons/oop/inheritance.md?raw"
import polymorphismRaw from "./lessons/oop/polymorphism.md?raw"
import interfacesRaw from "./lessons/oop/interfaces.md?raw"
import enumsRecordsRaw from "./lessons/oop/enums-and-records.md?raw"

// Module 4: Advanced Java
import collectionsRaw from "./lessons/advanced-java/collections-framework.md?raw"
import genericsRaw from "./lessons/advanced-java/generics.md?raw"
import lambdasRaw from "./lessons/advanced-java/lambda-expressions.md?raw"
import streamsRaw from "./lessons/advanced-java/streams-api.md?raw"
import exceptionsRaw from "./lessons/advanced-java/exception-handling.md?raw"
import javaIoRaw from "./lessons/advanced-java/java-io.md?raw"

// Module 5: Testing & Best Practices
import junitRaw from "./lessons/testing/junit-basics.md?raw"
import mockitoRaw from "./lessons/testing/mockito.md?raw"
import cleanCodeRaw from "./lessons/testing/clean-code.md?raw"
import debuggingRaw from "./lessons/testing/debugging-and-profiling.md?raw"

// Module 6: Spring Framework
import diRaw from "./lessons/spring/dependency-injection.md?raw"
import springConfigRaw from "./lessons/spring/spring-configuration.md?raw"
import projectAnatomyRaw from "./lessons/spring/spring-boot-project-anatomy.md?raw"
import springMvcRaw from "./lessons/spring/spring-mvc.md?raw"
import layeredArchRaw from "./lessons/spring/layered-architecture.md?raw"
import springDataRaw from "./lessons/spring/spring-data-jpa.md?raw"
import entityRelRaw from "./lessons/spring/entity-relationships.md?raw"
import springSecurityRaw from "./lessons/spring/spring-security.md?raw"

// Module 7: Spring Boot
import bootQuickstartRaw from "./lessons/spring-boot/spring-boot-quickstart.md?raw"
import restApisRaw from "./lessons/spring-boot/building-rest-apis.md?raw"
import validationRaw from "./lessons/spring-boot/validation-and-error-handling.md?raw"
import jwtAuthRaw from "./lessons/spring-boot/jwt-authentication.md?raw"
import dbIntegrationRaw from "./lessons/spring-boot/database-integration.md?raw"
import testingBootRaw from "./lessons/spring-boot/testing-spring-boot.md?raw"
import configSecretsRaw from "./lessons/spring-boot/configuration-and-secrets.md?raw"
import loggingRaw from "./lessons/spring-boot/logging-and-monitoring.md?raw"
import prodReadyRaw from "./lessons/spring-boot/production-readiness.md?raw"

// Module 8: Backend Engineering Patterns
import sqlRaw from "./lessons/backend-patterns/sql-fundamentals.md?raw"
import dbPatternsRaw from "./lessons/backend-patterns/database-patterns.md?raw"
import concurrencyRaw from "./lessons/backend-patterns/concurrency.md?raw"
import cachingRaw from "./lessons/backend-patterns/caching-strategies.md?raw"
import messageQueuesRaw from "./lessons/backend-patterns/message-queues.md?raw"
import edaRaw from "./lessons/backend-patterns/event-driven-architecture.md?raw"
import rateLimitingRaw from "./lessons/backend-patterns/rate-limiting.md?raw"
import apiDesignRaw from "./lessons/backend-patterns/api-design.md?raw"
import resilienceRaw from "./lessons/backend-patterns/resilience-observability.md?raw"
import apiSecurityRaw from "./lessons/backend-patterns/api-security.md?raw"

// Module 9: Capstone
import capProjectSetupRaw from "./lessons/capstone/project-setup.md?raw"
import capDomainModelRaw from "./lessons/capstone/domain-model.md?raw"
import capRestApiRaw from "./lessons/capstone/rest-api-layer.md?raw"
import capBusinessLogicRaw from "./lessons/capstone/business-logic-security.md?raw"
import capTestingRaw from "./lessons/capstone/testing-capstone.md?raw"
import capDeployRaw from "./lessons/capstone/deploy-review.md?raw"

// Module 10: Git & CI/CD
import gitFundamentalsRaw from "./lessons/git-cicd/git-fundamentals.md?raw"
import gitWorkflowRaw from "./lessons/git-cicd/git-workflow.md?raw"
import cicdPipelinesRaw from "./lessons/git-cicd/cicd-pipelines.md?raw"
import containerizationRaw from "./lessons/git-cicd/containerization.md?raw"

export const javaBankingCourse: Course = {
  id: "java-banking",
  title: "Java for Banking",
  description:
    "Learn Java backend development through real banking scenarios. Build a digital bank from the ground up while mastering core Java concepts.",
  icon: "landmark",
  scenarioLabel: "Banking Scenario",
  scenarioIcon: "landmark",
  modules: [
    {
      id: "java-platform",
      title: "Java Platform & Setup",
      description:
        "Understand how Java works under the hood — the JVM, compilation pipeline, and development environment.",
      icon: "cpu",
      lessons: [
        parseLesson(howJavaWorksRaw),
        parseLesson(yourFirstProgramRaw),
        parseLesson(devEnvironmentRaw),
        parseLesson(buildToolsRaw),
      ],
    },
    {
      id: "java-basics",
      title: "Java Basics",
      description:
        "Master the fundamentals of Java programming through real-world banking scenarios.",
      icon: "code-2",
      lessons: [
        parseLesson(variablesRaw),
        parseLesson(operatorsRaw),
        parseLesson(controlFlowRaw),
        parseLesson(loopsRaw),
        parseLesson(arraysRaw),
      ],
    },
    {
      id: "oop",
      title: "Object-Oriented Programming",
      description:
        "Design banking systems with classes, inheritance, polymorphism, and interfaces.",
      icon: "boxes",
      lessons: [
        parseLesson(classesRaw),
        parseLesson(encapsulationRaw),
        parseLesson(inheritanceRaw),
        parseLesson(polymorphismRaw),
        parseLesson(interfacesRaw),
        parseLesson(enumsRecordsRaw),
      ],
    },
    {
      id: "advanced-java",
      title: "Advanced Java",
      description:
        "Level up with collections, streams, lambdas, exception handling, and I/O.",
      icon: "rocket",
      lessons: [
        parseLesson(collectionsRaw),
        parseLesson(genericsRaw),
        parseLesson(lambdasRaw),
        parseLesson(streamsRaw),
        parseLesson(exceptionsRaw),
        parseLesson(javaIoRaw),
      ],
    },
    {
      id: "testing",
      title: "Testing & Best Practices",
      description:
        "Write reliable code with JUnit, Mockito, SOLID principles, and debugging techniques.",
      icon: "test-tube",
      lessons: [
        parseLesson(junitRaw),
        parseLesson(mockitoRaw),
        parseLesson(cleanCodeRaw),
        parseLesson(debuggingRaw),
      ],
    },
    {
      id: "spring",
      title: "Spring Framework",
      description:
        "Build enterprise Java applications with dependency injection, MVC, JPA, and security.",
      icon: "leaf",
      lessons: [
        parseLesson(diRaw),
        parseLesson(springConfigRaw),
        parseLesson(projectAnatomyRaw),
        parseLesson(springMvcRaw),
        parseLesson(layeredArchRaw),
        parseLesson(springDataRaw),
        parseLesson(entityRelRaw),
        parseLesson(springSecurityRaw),
      ],
    },
    {
      id: "spring-boot",
      title: "Spring Boot",
      description:
        "Build production-ready banking APIs with Spring Boot, database integration, testing, and deployment.",
      icon: "zap",
      lessons: [
        parseLesson(bootQuickstartRaw),
        parseLesson(restApisRaw),
        parseLesson(validationRaw),
        parseLesson(jwtAuthRaw),
        parseLesson(dbIntegrationRaw),
        parseLesson(testingBootRaw),
        parseLesson(configSecretsRaw),
        parseLesson(loggingRaw),
        parseLesson(prodReadyRaw),
      ],
    },
    {
      id: "backend-patterns",
      title: "Backend Engineering",
      description:
        "Master the patterns and tools that power production banking systems — SQL, caching, messaging, resilience, and API design.",
      icon: "server",
      lessons: [
        parseLesson(sqlRaw),
        parseLesson(dbPatternsRaw),
        parseLesson(concurrencyRaw),
        parseLesson(cachingRaw),
        parseLesson(messageQueuesRaw),
        parseLesson(edaRaw),
        parseLesson(rateLimitingRaw),
        parseLesson(apiDesignRaw),
        parseLesson(resilienceRaw),
        parseLesson(apiSecurityRaw),
      ],
    },
    {
      id: "capstone",
      title: "Capstone: Build JavaBank API",
      description:
        "Tie everything together by building a complete banking REST API with Spring Boot, JPA, security, and testing.",
      icon: "trophy",
      lessons: [
        parseLesson(capProjectSetupRaw),
        parseLesson(capDomainModelRaw),
        parseLesson(capRestApiRaw),
        parseLesson(capBusinessLogicRaw),
        parseLesson(capTestingRaw),
        parseLesson(capDeployRaw),
      ],
    },
    {
      id: "git-cicd",
      title: "Git & CI/CD",
      description:
        "Master version control, team workflows, continuous integration, and container-based deployment.",
      icon: "git-branch",
      lessons: [
        parseLesson(gitFundamentalsRaw),
        parseLesson(gitWorkflowRaw),
        parseLesson(cicdPipelinesRaw),
        parseLesson(containerizationRaw),
      ],
    },
  ],
}
