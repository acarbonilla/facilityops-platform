# FacilityOps Platform

FacilityOps Platform is organized as a separate backend, frontend, shared-contract, documentation, and infrastructure workspace. Task FO-001 establishes the repository structure only; application features and business logic are intentionally excluded.

## Technology Stack

The planned stack indicated by the approved workspace requirements is:

- Backend: Python and Django
- Frontend: Node.js, Next.js, and TypeScript
- Infrastructure: Docker and Nginx
- Automation: GitHub Actions

Runtime versions, packages, databases, authentication, and deployment services will be selected and configured in later tasks.

## Folder Structure

```text
facilityops-platform/
|-- backend/          Python/Django backend workspace
|-- frontend/         Next.js/TypeScript frontend workspace
|-- docs/             Architecture and delivery documentation
|-- infrastructure/   Docker, Nginx, and operational scripts
|-- shared/           Cross-application constants, schemas, types, and utilities
`-- .github/          GitHub workflow definitions
```

## Development Stages

1. Phase 12A, Stage 1: repository foundation
2. Backend and frontend project initialization: to be defined by subsequent tasks
3. Application development, integration, testing, and deployment: to be defined by the approved roadmap

## How to Start

Startup instructions will be added after the backend and frontend runtimes are initialized.

## Roadmap

The implementation roadmap will be documented as subsequent FacilityOps tasks are approved.
