# Code Review - CI/CD

**Owner:** Developer (with DevOps if applicable)
**AI Role:** Pipeline Optimizer & Deployment Validator

## Purpose

Automate build, test, and deployment processes to ensure safe, reliable releases.

## AI-Assisted Activities

### 1. CI/CD Pipeline Configuration

```
AI Prompt Template:
"Create a CI/CD pipeline for this project:

Stack: [technology stack]
Environments: [dev, staging, production]
Requirements:
- Build and test on every PR
- Deploy to staging on merge to develop
- Deploy to production on merge to main (with approval)
- Run security scans
- Check code quality
- Verify type safety
- Generate coverage reports

Platform: [GitHub Actions / GitLab CI / Jenkins / etc.]

Include:
1. Complete pipeline configuration file
2. Necessary secrets/environment variables
3. Deployment strategy (blue-green / canary / rolling)
4. Rollback procedure
5. Monitoring and alerting setup"
```

### 2. Deployment Validation Script

```
AI Prompt Template:
"Create a deployment validation script that:
1. Verifies all services are healthy
2. Runs smoke tests
3. Checks database migrations applied
4. Validates configuration
5. Tests critical user flows
6. Checks performance metrics
7. Verifies monitoring/alerting active
8. Rolls back automatically if validation fails

Target environment: [environment details]
Technology: [Bash / Python / Node / etc.]"
```

### 3. Rollback Procedure

```
AI Prompt Template:
"Create a rollback procedure for this deployment:

Current version: [version]
Previous version: [version]
Environment: [environment]
Database migrations: [have been run / none]

Include:
1. Pre-rollback checks
2. Step-by-step rollback commands
3. Database rollback (if needed)
4. Cache invalidation
5. Verification steps
6. Communication template
7. Post-rollback monitoring"
```

### 4. Performance Monitoring Setup

```
AI Prompt Template:
"Set up performance monitoring for:

Application: [description]
Key metrics to track:
- Response time (p50, p95, p99)
- Error rate
- Request throughput
- Database query time
- Memory usage
- CPU usage

Tools: [DataDog / New Relic / CloudWatch / etc.]

Generate:
1. Monitoring configuration
2. Dashboard definitions
3. Alert rules
4. Runbook for common issues"
```

## CI Pipeline

**Continuous Integration Flow:**

The CI pipeline runs on every PR and push to main/develop branches:

1. **Code Quality Checks**
   - Lint code
   - Check formatting
   - Type checking

2. **Security Scanning**
   - Run security audit
   - Dependency vulnerability scan
   - Code security scan

3. **Testing**
   - Run unit tests
   - Run integration tests
   - Generate coverage report
   - Check coverage threshold

4. **Build**
   - Build application
   - Upload build artifacts

5. **E2E Tests** (optional)
   - Run E2E tests
   - Upload test results

## CD Pipeline

**Continuous Deployment Flow:**

1. **Deploy to Staging** (automatic on develop branch)
   - Run database migrations
   - Deploy application
   - Run smoke tests
   - Notify team

2. **Deploy to Production** (requires approval on main branch)
   - Create release
   - Run database migrations
   - Deploy application (blue-green strategy)
   - Run smoke and performance tests
   - Notify team
   - Rollback on failure

## Deployment Validation

**Smoke Tests:**

- Health check endpoint responds
- Database connection is healthy
- User can access home page
- User can log in
- API authentication works
- Critical user workflow completes

**Performance Validation:**

- Home page loads within acceptable time
- API response time is acceptable
- Performance metrics within targets

## Monitoring & Alerting

**Key Metrics to Monitor:**

- Request rate
- Error rate
- Response time (p50, p95, p99)
- Memory usage
- CPU usage
- Database connection pool availability

**Alert Configuration:**

- High error rate (>5%)
- Slow response time (p95 >1s)
- High memory usage (>90%)
- Database connection pool exhaustion

## Rollback Procedure

**Automated Rollback:**

1. Notify team
2. Switch traffic to previous version
3. Rollback database migrations (if needed)
4. Invalidate caches
5. Wait for stabilization
6. Validate rollback
7. Update version tracking

## Deliverable

**Deployment Report:**

```markdown
# Deployment Report

## Deployment Information

- **Version:** v1.2.3
- **Environment:** Production
- **Deployed At:** [timestamp]
- **Deployed By:** [user/system]
- **Duration:** [time]

## Changes Deployed

- Features
- Bug Fixes
- Database Changes

## Pre-Deployment Checklist

- [x] All tests passing in CI
- [x] Code review approved
- [x] Staging validated
- [x] Database backups verified
- [x] Rollback plan prepared
- [x] Team notified

## Deployment Steps Completed

- [x] Database migrations applied
- [x] Application deployed
- [x] Health checks passed
- [x] Smoke tests passed
- [x] Traffic switched to new version

## Validation Results

- Smoke Tests: PASSED
- Performance Tests: PASSED
- Monitoring: All green

## Rollback Information

- Previous version: [version]
- Rollback tested: Yes
- Estimated rollback time: <5 minutes

## Status

Successfully Deployed / Rollback Complete / Issues Encountered
```

## Quality Gate: Deployment Complete

**Checklist:**

- [ ] CI pipeline passed all checks
- [ ] Code merged to target branch
- [ ] Database migrations applied successfully
- [ ] Application deployed to target environment
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Performance within acceptable range
- [ ] Monitoring and alerting active
- [ ] No critical errors in logs
- [ ] Team notified
- [ ] Documentation updated (if applicable)
- [ ] Rollback plan ready and tested

---

## Slash Commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `/quality-gate deploy` | Run deployment checklist                 |
| `/architecture-check`  | Validate deployment against architecture |

---

## CI Workflow Templates

The [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) includes GitHub Actions workflow templates you can install during setup:

- `templates/ci-checks.yml` - Lint, format, type-check, build, unit tests
- `templates/e2e-tests.yml` - Playwright E2E tests

**CLI location:** `path/to/ce-developer-cli/templates/` (replace with your clone path)

---

## Related Documentation

- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
