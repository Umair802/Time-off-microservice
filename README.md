# Time-Off Microservice

This repository contains a full-featured Time-Off Microservice built with **NestJS**, **TypeORM**, and **SQLite**. It demonstrates agentic development rigor with a detailed sync engine for Human Capital Management (HCM) systems.

## Features

- **Core Domain**: Employees, Locations, Leave Types, and Balances.
- **State Machine**: Advanced time-off request lifecycle (`PENDING`, `APPROVED`, `SUBMITTED_TO_HCM`, `CONFIRMED`, `CANCELLED`).
- **Sync Engine**: Real-time balance updates, batch synchronization, and automatic discrepancy reconciliation where HCM serves as the Source of Truth.
- **Defensive Deductions**: Never allows a request if it exceeds `(available - used - pending)`.
- **Mock HCM Server**: Embedded mock server for E2E testing.
- **API Documentation**: Auto-generated Swagger documentation at `/api/docs`.

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Seeding Demo Data
Populate the SQLite database with initial employees, locations, and balances:
```bash
npm run seed
```

### 3. Start the Mock HCM Server
Since this service integrates with an external HCM system, start the mock server in a dedicated terminal first:
```bash
npx ts-node test/mock-hcm/mock-hcm-server.ts
```

### 4. Start the Application
In a separate terminal, start the NestJS API:
```bash
npm run start:dev
```

Visit `http://localhost:3000/api/docs` to view the auto-generated Swagger API documentation.

## Testing

This project achieved **100% test passing** on Unit and E2E tests, including defensive sync edges.

```bash
# Unit Tests
npm run test

# End-to-End Tests
npm run test:e2e
```

## Documentation

See the [Technical Requirements Document (TRD)](./docs/TRD.md) for full architectural decisions and tradeoffs.
