# Architecture Template: [Project Name]

## Version History

| Version | Date   | Author | Changes         |
| ------- | ------ | ------ | --------------- |
| 1.0     | [Date] | [Name] | Initial version |

---

## 1. Overview

### 1.1 System Description

[Brief description of the system architecture and its primary components]

### 1.2 Architecture Style

| Aspect            | Choice                                           | Rationale         |
| ----------------- | ------------------------------------------------ | ----------------- |
| **Pattern**       | [Monolith / Microservices / Serverless / Hybrid] | [Why this choice] |
| **API Style**     | [REST / GraphQL / gRPC / Event-driven]           | [Why this choice] |
| **Data Strategy** | [CQRS / Event Sourcing / Traditional / Hybrid]   | [Why this choice] |

### 1.3 Architecture Diagram

```
[ASCII or Mermaid diagram showing high-level system components]
```

---

## 2. Tech Stack

### 2.1 Languages

| Language           | Version | Purpose                    | Rationale                   |
| ------------------ | ------- | -------------------------- | --------------------------- |
| [e.g., TypeScript] | [5.x]   | [Primary backend/frontend] | [Type safety, ecosystem]    |
| [e.g., Python]     | [3.11+] | [Data processing, ML]      | [Libraries, team expertise] |

### 2.2 Frontend

| Category             | Technology                                   | Version   | Purpose                   |
| -------------------- | -------------------------------------------- | --------- | ------------------------- |
| **Framework**        | [React / Vue / Angular / Next.js]            | [Version] | [Core UI framework]       |
| **State Management** | [Redux / Zustand / Jotai / Context]          | [Version] | [Application state]       |
| **Styling**          | [Tailwind / CSS Modules / Styled Components] | [Version] | [Component styling]       |
| **UI Components**    | [shadcn/ui / MUI / Chakra]                   | [Version] | [Component library]       |
| **Form Handling**    | [React Hook Form / Formik]                   | [Version] | [Form state & validation] |
| **Data Fetching**    | [TanStack Query / SWR / RTK Query]           | [Version] | [Server state management] |
| **Routing**          | [React Router / Next.js App Router]          | [Version] | [Client-side routing]     |
| **Build Tool**       | [Vite / Webpack / Turbopack]                 | [Version] | [Build & bundling]        |

### 2.3 Backend

| Category              | Technology                          | Version   | Purpose                |
| --------------------- | ----------------------------------- | --------- | ---------------------- |
| **Runtime**           | [Node.js / Deno / Bun]              | [Version] | [JavaScript execution] |
| **Framework**         | [Express / Fastify / NestJS / Hono] | [Version] | [HTTP server]          |
| **ORM/Query Builder** | [Prisma / Drizzle / TypeORM / Knex] | [Version] | [Database access]      |
| **Validation**        | [Zod / Yup / Joi / class-validator] | [Version] | [Schema validation]    |
| **Authentication**    | [Passport / Auth.js / Custom JWT]   | [Version] | [User auth]            |
| **API Documentation** | [OpenAPI / Swagger / tRPC]          | [Version] | [API specs]            |
| **Job Queue**         | [BullMQ / Agenda / Custom]          | [Version] | [Background jobs]      |

### 2.4 Mobile (if applicable)

| Category       | Technology                        | Version   | Purpose              |
| -------------- | --------------------------------- | --------- | -------------------- |
| **Framework**  | [React Native / Flutter / Native] | [Version] | [Mobile development] |
| **Navigation** | [React Navigation / Go Router]    | [Version] | [Screen navigation]  |
| **State**      | [Redux / Riverpod / Provider]     | [Version] | [App state]          |

---

## 3. Data Layer

### 3.1 Primary Database

| Attribute              | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| **Type**               | [PostgreSQL / MySQL / MongoDB / etc.]                 |
| **Version**            | [Version number]                                      |
| **Managed Service**    | [RDS / Cloud SQL / PlanetScale / Atlas / Self-hosted] |
| **Connection Pooling** | [PgBouncer / ProxySQL / Built-in]                     |
| **Replication**        | [Read replicas / Multi-region / None]                 |
| **Backup Strategy**    | [Automated daily / Point-in-time / Custom]            |
| **Retention Period**   | [X days/months]                                       |

**Schema Management:**

- Migration Tool: [Prisma Migrate / Flyway / Liquibase / Custom]
- Migration Strategy: [Version controlled / Automated / Manual]

### 3.2 Secondary Databases

| Database        | Type          | Purpose                     | Managed Service                       |
| --------------- | ------------- | --------------------------- | ------------------------------------- |
| [Redis]         | [Key-Value]   | [Caching, Sessions, Queues] | [ElastiCache / Upstash / Self-hosted] |
| [Elasticsearch] | [Search]      | [Full-text search, Logging] | [OpenSearch / Elastic Cloud]          |
| [TimescaleDB]   | [Time-series] | [Metrics, Events]           | [Timescale Cloud / Self-hosted]       |

### 3.3 File Storage

| Provider                 | Purpose                 | Configuration                |
| ------------------------ | ----------------------- | ---------------------------- |
| [S3 / GCS / Azure Blob]  | [User uploads, Assets]  | [Region, Lifecycle policies] |
| [CloudFront / Cloud CDN] | [Static asset delivery] | [Cache TTL, Origins]         |

### 3.4 Data Models (Canonical)

```
[Link to or embed canonical data models that are shared across milestone PRDs]

Example:
User {
  id: UUID (primary key)
  email: string (unique, indexed)
  passwordHash: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## 4. Infrastructure & Hosting

### 4.1 Cloud Provider

| Attribute              | Value                                   |
| ---------------------- | --------------------------------------- |
| **Primary Provider**   | [AWS / GCP / Azure / Vercel / etc.]     |
| **Secondary Provider** | [If multi-cloud]                        |
| **Regions**            | [Primary: us-east-1, DR: us-west-2]     |
| **Account Structure**  | [Single / Multi-account / Organization] |

### 4.2 Compute

| Environment     | Service                             | Configuration           | Scaling              |
| --------------- | ----------------------------------- | ----------------------- | -------------------- |
| **Production**  | [ECS / EKS / Lambda / EC2 / Vercel] | [Instance type, Memory] | [Auto-scaling rules] |
| **Staging**     | [Same as prod / Reduced]            | [Configuration]         | [Scaling rules]      |
| **Development** | [Local / Cloud dev env]             | [Configuration]         | [N/A]                |

### 4.3 Container Orchestration (if applicable)

| Attribute              | Value                                     |
| ---------------------- | ----------------------------------------- |
| **Platform**           | [Kubernetes / ECS / Docker Swarm / Nomad] |
| **Managed Service**    | [EKS / GKE / AKS / Self-managed]          |
| **Version**            | [Kubernetes version]                      |
| **Ingress Controller** | [NGINX / Traefik / AWS ALB]               |
| **Service Mesh**       | [Istio / Linkerd / None]                  |

### 4.4 Networking

| Component         | Configuration                       |
| ----------------- | ----------------------------------- |
| **VPC/VNet**      | [CIDR, Subnets]                     |
| **Load Balancer** | [ALB / NLB / Cloud LB]              |
| **DNS**           | [Route 53 / Cloud DNS / Cloudflare] |
| **CDN**           | [CloudFront / Fastly / Cloudflare]  |
| **SSL/TLS**       | [ACM / Let's Encrypt / Custom]      |

---

## 5. CI/CD Pipeline

### 5.1 Source Control

| Attribute                | Value                                 |
| ------------------------ | ------------------------------------- |
| **Platform**             | [GitHub / GitLab / Bitbucket]         |
| **Repository Structure** | [Monorepo / Polyrepo]                 |
| **Branch Strategy**      | [GitFlow / GitHub Flow / Trunk-based] |
| **Protected Branches**   | [main, develop]                       |
| **Required Reviews**     | [X approvals required]                |

### 5.2 CI Platform

| Attribute            | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Platform**         | [GitHub Actions / GitLab CI / CircleCI / Jenkins] |
| **Build Agent**      | [Hosted / Self-hosted]                            |
| **Parallelization**  | [Matrix builds / Fan-out]                         |
| **Caching Strategy** | [Dependencies / Docker layers / Custom]           |

### 5.3 Pipeline Stages

| Stage                 | Tools                     | Triggers           | Duration  |
| --------------------- | ------------------------- | ------------------ | --------- |
| **Lint & Format**     | [ESLint, Prettier, Biome] | [All PRs]          | [~1 min]  |
| **Type Check**        | [TypeScript, mypy]        | [All PRs]          | [~2 min]  |
| **Unit Tests**        | [Jest, Vitest, pytest]    | [All PRs]          | [~5 min]  |
| **Integration Tests** | [Supertest, pytest]       | [All PRs]          | [~10 min] |
| **E2E Tests**         | [Playwright, Cypress]     | [Merge to main]    | [~15 min] |
| **Security Scan**     | [Snyk, Dependabot, Trivy] | [All PRs]          | [~3 min]  |
| **Build**             | [Docker, Webpack]         | [All PRs]          | [~5 min]  |
| **Deploy Staging**    | [Terraform, CDK]          | [Merge to develop] | [~10 min] |
| **Deploy Production** | [Terraform, CDK]          | [Tag / Manual]     | [~10 min] |

### 5.4 Deployment Strategy

| Environment    | Strategy                        | Rollback                     |
| -------------- | ------------------------------- | ---------------------------- |
| **Staging**    | [Continuous deployment]         | [Automatic on failure]       |
| **Production** | [Blue-green / Canary / Rolling] | [Instant rollback available] |

### 5.5 Infrastructure as Code

| Tool                       | Purpose                       | State Storage                     |
| -------------------------- | ----------------------------- | --------------------------------- |
| [Terraform / Pulumi / CDK] | [Infrastructure provisioning] | [S3 + DynamoDB / Terraform Cloud] |
| [Helm / Kustomize]         | [Kubernetes manifests]        | [Git]                             |

---

## 6. Testing Framework

### 6.1 Test Pyramid

| Level           | Framework                  | Coverage Target      | Purpose                    |
| --------------- | -------------------------- | -------------------- | -------------------------- |
| **Unit**        | [Jest / Vitest / pytest]   | [80%+]               | [Function/component level] |
| **Integration** | [Supertest / pytest-httpx] | [Key flows]          | [API/Service level]        |
| **E2E**         | [Playwright / Cypress]     | [Critical paths]     | [Full user flows]          |
| **Visual**      | [Chromatic / Percy]        | [UI components]      | [Visual regression]        |
| **Performance** | [k6 / Artillery]           | [SLA endpoints]      | [Load testing]             |
| **Security**    | [OWASP ZAP / Burp Suite]   | [Auth flows, Inputs] | [Vulnerability scanning]   |

### 6.2 Test Data Management

| Aspect               | Approach                                                |
| -------------------- | ------------------------------------------------------- |
| **Fixtures**         | [Factory functions / JSON files / Database seeds]       |
| **Test Database**    | [Docker container / In-memory / Cloud dev instance]     |
| **Data Generation**  | [Faker.js / Factory Boy / Custom generators]            |
| **Cleanup Strategy** | [Transaction rollback / Truncate / Reset between tests] |

### 6.3 Mocking Strategy

| Layer                 | Tool                          | Approach              |
| --------------------- | ----------------------------- | --------------------- |
| **HTTP Calls**        | [MSW / nock / responses]      | [Mock service worker] |
| **Database**          | [In-memory / Test containers] | [Isolated test DB]    |
| **External Services** | [Mocks / Stubs / Fakes]       | [Interface-based]     |

---

## 7. Monitoring & Observability

### 7.1 Logging

| Attribute       | Value                                 |
| --------------- | ------------------------------------- |
| **Library**     | [Pino / Winston / Bunyan / structlog] |
| **Format**      | [JSON structured logging]             |
| **Aggregation** | [CloudWatch / Datadog / ELK / Loki]   |
| **Retention**   | [X days hot, Y days cold]             |
| **Log Levels**  | [error, warn, info, debug, trace]     |

### 7.2 Metrics

| Attribute          | Value                                             |
| ------------------ | ------------------------------------------------- |
| **Platform**       | [Prometheus / Datadog / CloudWatch]               |
| **Visualization**  | [Grafana / Datadog Dashboards]                    |
| **Key Metrics**    | [Request rate, Error rate, Latency (p50/p95/p99)] |
| **Custom Metrics** | [Business KPIs, Feature usage]                    |

### 7.3 Tracing

| Attribute           | Value                                   |
| ------------------- | --------------------------------------- |
| **Platform**        | [Jaeger / Zipkin / Datadog APM / X-Ray] |
| **Instrumentation** | [OpenTelemetry / Auto-instrumentation]  |
| **Sampling Rate**   | [X% production, 100% staging]           |

### 7.4 Alerting

| Channel                | Severity        | Response Time       |
| ---------------------- | --------------- | ------------------- |
| [PagerDuty / Opsgenie] | [Critical - P1] | [< 15 min]          |
| [Slack #alerts-high]   | [High - P2]     | [< 1 hour]          |
| [Slack #alerts-low]    | [Medium - P3]   | [< 24 hours]        |
| [Email]                | [Low - P4]      | [Next business day] |

### 7.5 Health Checks

| Endpoint        | Checks                    | Interval |
| --------------- | ------------------------- | -------- |
| `/health`       | [Process alive]           | [10s]    |
| `/health/ready` | [DB, Cache, Dependencies] | [30s]    |
| `/health/live`  | [Deep health check]       | [60s]    |

---

## 8. Security

### 8.1 Authentication

| Attribute            | Value                                |
| -------------------- | ------------------------------------ |
| **Method**           | [JWT / Session / OAuth 2.0 / OIDC]   |
| **Provider**         | [Auth0 / Cognito / Clerk / Custom]   |
| **MFA**              | [TOTP / SMS / WebAuthn]              |
| **Session Duration** | [Access: X min, Refresh: Y days]     |
| **Token Storage**    | [HTTP-only cookies / Secure storage] |

### 8.2 Authorization

| Attribute          | Value                                        |
| ------------------ | -------------------------------------------- |
| **Model**          | [RBAC / ABAC / PBAC]                         |
| **Implementation** | [Casbin / Custom middleware / Service layer] |
| **Roles**          | [Admin, Editor, Viewer, etc.]                |
| **Permissions**    | [Resource-based / Action-based]              |

### 8.3 Security Tools

| Category                | Tool                           | Purpose                   |
| ----------------------- | ------------------------------ | ------------------------- |
| **SAST**                | [Semgrep / SonarQube / CodeQL] | [Static code analysis]    |
| **DAST**                | [OWASP ZAP / Burp Suite]       | [Dynamic testing]         |
| **Dependency Scanning** | [Snyk / Dependabot / Renovate] | [Vulnerability detection] |
| **Secret Scanning**     | [GitGuardian / TruffleHog]     | [Credential detection]    |
| **Container Scanning**  | [Trivy / Clair]                | [Image vulnerabilities]   |

### 8.4 Secrets Management

| Attribute    | Value                                             |
| ------------ | ------------------------------------------------- |
| **Platform** | [AWS Secrets Manager / HashiCorp Vault / Doppler] |
| **Rotation** | [Automated / Manual / Policy-based]               |
| **Access**   | [IAM roles / Service accounts]                    |
| **Audit**    | [Access logging enabled]                          |

### 8.5 Compliance

| Standard  | Status                              | Notes              |
| --------- | ----------------------------------- | ------------------ |
| [SOC 2]   | [Certified / In progress / Planned] | [Type I / Type II] |
| [GDPR]    | [Compliant / In progress]           | [DPA in place]     |
| [HIPAA]   | [N/A / Compliant / In progress]     | [BAA required]     |
| [PCI DSS] | [N/A / Level X compliant]           | [SAQ type]         |

---

## 9. External Services & APIs

### 9.1 Third-Party Services

| Service    | Purpose          | Tier            | Fallback                |
| ---------- | ---------------- | --------------- | ----------------------- |
| [Stripe]   | [Payments]       | [Production]    | [Manual processing]     |
| [SendGrid] | [Email]          | [Pro]           | [Amazon SES]            |
| [Twilio]   | [SMS/Voice]      | [Pay-as-you-go] | [MessageBird]           |
| [OpenAI]   | [AI/ML features] | [Tier X]        | [Local model / Disable] |
| [Mapbox]   | [Mapping]        | [Commercial]    | [Google Maps]           |

### 9.2 API Integrations

| Integration       | Type             | Authentication           | Rate Limits |
| ----------------- | ---------------- | ------------------------ | ----------- |
| [Partner API X]   | [REST / GraphQL] | [OAuth 2.0 / API Key]    | [X req/min] |
| [Data Provider Y] | [REST]           | [API Key + IP whitelist] | [X req/day] |

### 9.3 Internal APIs/Services

| Service                | Owner    | Protocol       | Documentation  |
| ---------------------- | -------- | -------------- | -------------- |
| [User Service]         | [Team A] | [gRPC / REST]  | [Link to docs] |
| [Notification Service] | [Team B] | [Event-driven] | [Link to docs] |

---

## 10. Development Environment

### 10.1 Local Development

| Tool             | Purpose          | Configuration        |
| ---------------- | ---------------- | -------------------- |
| [Docker Compose] | [Local services] | [docker-compose.yml] |
| [Devcontainer]   | [Consistent env] | [.devcontainer/]     |
| [Local K8s]      | [K8s testing]    | [minikube / kind]    |

### 10.2 Required Tools

| Tool              | Version     | Installation              |
| ----------------- | ----------- | ------------------------- |
| [Node.js]         | [20.x LTS]  | [nvm / fnm]               |
| [Docker]          | [24.x+]     | [Docker Desktop / Colima] |
| pnpm (CE default) | [e.g. 10.x] | Corepack                  |
| [Git]             | [2.40+]     | [Package manager]         |

### 10.3 IDE Configuration

| IDE                | Extensions/Plugins          | Config Files            |
| ------------------ | --------------------------- | ----------------------- |
| [VS Code / Cursor] | [ESLint, Prettier, GitLens] | [.vscode/settings.json] |
| [JetBrains]        | [Prettier, ESLint]          | [.idea/]                |

### 10.4 Environment Variables

| Category       | Local          | Staging           | Production        |
| -------------- | -------------- | ----------------- | ----------------- |
| **Source**     | [.env.local]   | [Secrets Manager] | [Secrets Manager] |
| **Template**   | [.env.example] | [N/A]             | [N/A]             |
| **Validation** | [Zod schema]   | [Same]            | [Same]            |

---

## 11. Operational Runbooks

### 11.1 Critical Procedures

| Procedure            | Documentation     | Last Tested |
| -------------------- | ----------------- | ----------- |
| [Incident Response]  | [Link to runbook] | [Date]      |
| [Database Failover]  | [Link to runbook] | [Date]      |
| [Rollback Procedure] | [Link to runbook] | [Date]      |
| [Security Incident]  | [Link to runbook] | [Date]      |

### 11.2 On-Call

| Aspect         | Configuration                  |
| -------------- | ------------------------------ |
| **Rotation**   | [Weekly / Bi-weekly]           |
| **Platform**   | [PagerDuty / Opsgenie]         |
| **Escalation** | [Engineer → Lead → Manager]    |
| **SLA**        | [P1: 15min, P2: 1hr, P3: 24hr] |

---

## 12. Decision Log

| Date   | Decision                              | Options Considered              | Rationale                         | Impact                          |
| ------ | ------------------------------------- | ------------------------------- | --------------------------------- | ------------------------------- |
| [Date] | [e.g., Chose PostgreSQL over MongoDB] | [PostgreSQL, MongoDB, DynamoDB] | [ACID compliance, team expertise] | [Schema design, query patterns] |

---

## 13. Appendix

### 13.1 Architecture Decision Records (ADRs)

| ADR                  | Title                 | Status     |
| -------------------- | --------------------- | ---------- |
| [ADR-001]            | [Database Selection]  | [Accepted] |
| [ADR-002]            | [API Design Approach] | [Accepted] |
| [Link to ADR folder] |

### 13.2 Glossary

| Term     | Definition   |
| -------- | ------------ |
| [Term 1] | [Definition] |
| [Term 2] | [Definition] |

### 13.3 Related Documents

- [System PRD](../PRD/system-prd-template.md)
- [Deployment Guide](link)
- [Security Policy](link)
- [API Documentation](link)
