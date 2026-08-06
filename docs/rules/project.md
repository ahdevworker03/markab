# Project Context

## Overview

Vehicle Rental Management Platform is a modern SaaS platform designed for small and medium-sized vehicle rental businesses in Lebanon, with future expansion to the MENA region.

The platform helps rental businesses replace manual notebooks and spreadsheets with a reliable digital system for managing customers, vehicles, rentals, payments, maintenance, and daily operations.

The project is developed as a production-ready application while serving as a learning journey for building a complete full-stack SaaS.

---

## Vision

Build a reliable, maintainable, and scalable platform that can grow from a single business to thousands of organizations without requiring major architectural redesign.

Every implementation should balance simplicity today with a clear path for future growth.

---

## Current Status

- Frontend validation has been completed.
- Product-market fit has been validated with real rental businesses.
- The project is entering production backend development.
- Documentation and architecture are considered the source of truth before implementation.
- Development follows an API-first and contract-driven approach.

---

## Product Goals

- Build a production-ready SaaS platform.
- Support multiple organizations (multi-tenancy).
- Operate offline when internet connectivity is unavailable.
- Deliver a mobile-first experience while fully supporting desktop.
- Maintain a clean architecture that supports long-term growth.
- Prioritize reliability, maintainability, and developer productivity.

---

## Architecture Summary

The platform consists of:

- React + TypeScript frontend.
- Express + TypeScript backend.
- PostgreSQL database.
- Prisma ORM.
- REST API.
- Offline synchronization layer.
- Object storage for uploaded files.

Each component has a clearly defined responsibility and can evolve independently.

---

## Repository Structure

- `artifacts/` — Deployable applications.
- `docs/` — Product, planning, architecture, and development documentation.
- Shared packages contain reusable code that supports multiple applications.
- Workspace configuration is managed from the repository root.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express
- TypeScript
- Prisma

### Database

- PostgreSQL

### Development

- pnpm Workspaces
- Prettier
- ESLint
- OpenAPI

---

## Development Philosophy

This repository values:

- Simplicity over unnecessary complexity.
- Consistency over personal preference.
- Incremental improvements over large rewrites.
- Architecture before implementation.
- Business requirements before technical preferences.

Avoid over-engineering.

Build only what the product currently requires.

---

## Repository Principles

- Follow the documented architecture.
- Respect module boundaries.
- Keep responsibilities clearly separated.
- Make the smallest coherent change.
- Preserve existing patterns unless improvement is justified.
- Repository decisions take precedence over generic best practices.

---

## Source of Truth

The following documents define repository truth:

- Product documentation.
- Planning documentation.
- Architecture documentation.
- Repository rules.
- Existing implementation.

When conflicts occur, repository documentation always overrides assumptions.

---

## Long-Term Objective

The objective is not simply to build software.

The objective is to build a high-quality, production-ready SaaS while establishing a maintainable codebase, documentation system, and development workflow that can support the product for years.
