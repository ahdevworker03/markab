# Technology Decisions

## Purpose

This document records the reasoning behind the technologies chosen for the project.

The goal is not simply to list the tech stack, but to explain **why each technology was selected**, what alternatives were considered, and the trade-offs involved.

These decisions are based on the current requirements of Version 2 and may evolve as the product grows.

---

# Decision Principles

Every technology should:

- Solve a real business or technical problem.
- Be appropriate for the current stage of the project.
- Support long-term maintainability.
- Have a strong ecosystem and community.
- Help us learn software engineering, not just a framework.
- Be replaceable if future requirements change.

---

# Technology Stack Overview

| Category                  | Decision                 |
| ------------------------- | ------------------------ |
| Language                  | TypeScript               |
| Frontend                  | React                    |
| Future Frontend Framework | Next.js (when justified) |
| JavaScript Runtime        | Node.js                  |
| Backend Framework         | Express                  |
| Database                  | PostgreSQL               |
| ORM                       | Prisma                   |
| API Style                 | REST                     |
| Authentication            | JWT (planned)            |

---

# Language

## Decision

**TypeScript**

### Why

- One language across the entire application.
- Static typing catches errors during development.
- Excellent editor support and autocomplete.
- Easier refactoring as the project grows.
- Better documentation through types.
- Industry standard for modern JavaScript applications.

### Alternatives Considered

- JavaScript

### Why Not JavaScript

- No compile-time type checking.
- Easier to introduce runtime bugs.
- Harder to maintain as the codebase grows.

---

# Frontend

## Decision

**React**

### Why

- Already used in Version 1.
- Large ecosystem.
- Excellent community support.
- Flexible architecture.
- Easy integration with REST APIs.
- Strong TypeScript support.

### Future

If the project later requires:

- Server-side rendering
- SEO
- File-based routing
- Full-stack React features

then **Next.js** will be considered.

At the current stage, React alone keeps the architecture simpler.

---

# JavaScript Runtime

## Decision

**Node.js**

### Alternatives Considered

- Bun

### Why Node.js

- Mature ecosystem.
- Excellent compatibility with libraries.
- Stable production environment.
- Largest community.
- Most learning resources.
- Industry standard for backend JavaScript.

### Why Not Bun (for now)

Bun is impressive and continues to improve.

However:

- Smaller ecosystem.
- Fewer educational resources.
- Less battle-tested in production.
- Some packages still target Node.js first.

Bun remains an option in the future if it provides a clear advantage.

---

# Backend Framework

## Decision

**Express**

### Alternatives Considered

- NestJS
- Fastify
- Hono
- Koa

### Why Express

- Minimal.
- Easy to understand.
- Flexible architecture.
- Huge community.
- Massive ecosystem.
- Excellent educational resources.
- Helps learn HTTP fundamentals instead of hiding them.

### Trade-offs

- More manual setup.
- Fewer built-in conventions.
- Requires discipline to keep the project organized.

### Why Not NestJS

NestJS is an excellent framework.

However, it introduces many concepts simultaneously:

- Dependency Injection
- Modules
- Providers
- Decorators
- Framework conventions

For this project, the priority is understanding backend fundamentals before adopting a more opinionated framework.

If the application or team grows significantly, migrating to NestJS can be evaluated.

---

# Database

## Decision

**PostgreSQL**

### Alternatives Considered

- MySQL
- MongoDB
- SQLite

### Why PostgreSQL

- Mature and reliable.
- Excellent performance.
- Strong support for relational data.
- ACID compliance.
- Advanced querying capabilities.
- Well suited for business applications.

The application's domain is highly relational:

- Organizations
- Users
- Customers
- Vehicles
- Rentals
- Payments
- Maintenance

A relational database naturally models these relationships.

### Why Not MongoDB

The application's business data has many relationships and integrity constraints.

A relational database better fits these requirements.

---

# ORM

## Decision

**Prisma**

### Why

- Excellent TypeScript integration.
- Type-safe database access.
- Automatic client generation.
- Migration support.
- Improved developer productivity.
- Cleaner repository implementation.

### Learning Philosophy

Although Prisma will be used from the beginning, SQL concepts will still be learned.

Developers should understand:

- SELECT
- INSERT
- UPDATE
- DELETE
- JOIN
- Transactions
- Indexes
- Constraints

Prisma is a productivity tool—not a replacement for understanding databases.

---

# API Style

## Decision

**REST**

### Alternatives Considered

- GraphQL
- gRPC

### Why REST

- Simple.
- Well understood.
- Excellent tooling.
- Easy integration with React.
- Fits the current business requirements.
- Easier to learn while building the project.

GraphQL or gRPC may be evaluated if future requirements justify them.

---

# Authentication

## Decision

**JWT**

### Why

- Stateless authentication.
- Works well with APIs.
- Suitable for mobile and web clients.
- Widely adopted.

Authentication details will be documented separately.

---

# Future Review

Technology decisions are not permanent.

A decision should only change if:

- Business requirements change.
- Performance requirements change.
- Security requirements change.
- A measurable technical benefit justifies the migration.

Changing technology simply because a newer tool exists is not sufficient.

---

# Guiding Principle

Technology exists to serve the product.

We choose tools based on business needs, maintainability, and long-term understanding—not popularity or trends.
