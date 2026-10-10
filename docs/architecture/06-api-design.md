# API Design

## Table of Contents

| # | Section |
| - | ------- |
| 1 | [Purpose](#purpose) |
| 2 | [Design Goals](#design-goals) |
| 3 | [API Philosophy](#api-philosophy) |
| 4 | [Architectural Style](#architectural-style) |
| 5 | [Resource Naming](#resource-naming) |
| 6 | [HTTP Methods](#http-methods) |
| 7 | [Request Structure](#request-structure) |
| 8 | [Response Structure](#response-structure) |
| 9 | [Error Responses](#error-responses) |
| 10 | [HTTP Status Codes](#http-status-codes) |
| 11 | [Validation](#validation) |
| 12 | [Authentication](#authentication) |
| 13 | [Authentication Endpoints](#authentication-endpoints) |
| 14 | [POST /api/auth/login](#post-apiauthlogin) |
| 15 | [POST /api/auth/refresh](#post-apiauthrefresh) |
| 16 | [POST /api/auth/logout](#post-apiauthlogout) |
| 17 | [GET /api/auth/me](#get-apiauthme) |
| 18 | [Organization Endpoints](#organization-endpoints) |
| 19 | [Organization Identity From Authentication](#organization-identity-from-authentication) |
| 20 | [GET /api/organizations/me](#get-apiorganizationsme) |
| 21 | [PATCH /api/organizations/me](#patch-apiorganizationsme) |
| 22 | [POST /api/platform/organizations](#post-apiplatformorganizations) |
| 23 | [GET /api/platform/organizations/:organizationId/users](#get-apiplatformorganizationsorganizationidusers) |
| 24 | [POST /api/platform/organizations/:organizationId/invitations/:invitationId/resend](#post-apiplatformorganizationsorganizationidinvitationsinvitationidresend) |
| 25 | [POST /api/platform/organizations/:organizationId/owner/password-reset](#post-apiplatformorganizationsorganizationidownerpassword-reset) |
| 26 | [POST /api/platform/organizations/:organizationId/users/:userId/deactivate](#post-apiplatformorganizationsorganizationidusersuseriddeactivate) |
| 27 | [PATCH /api/platform/organizations/:organizationId/status](#patch-apiplatformorganizationsorganizationidstatus) |
| 28 | [DELETE /api/organizations/me](#delete-apiorganizationsme) |
| 29 | [Authorization](#authorization) |
| 30 | [Pagination](#pagination) |
| 31 | [Filtering](#filtering) |
| 32 | [Sorting](#sorting) |
| 33 | [Searching](#searching) |
| 34 | [Versioning](#versioning) |
| 35 | [Offline Synchronization](#offline-synchronization) |
| 36 | [Security](#security) |
| 37 | [Consistency](#consistency) |
| 38 | [Future Expansion](#future-expansion) |
| 39 | [Guiding Principle](#guiding-principle) |

## Purpose

This document defines the design principles and communication standards for the Vehicle Rental Management Platform API.

Its purpose is to ensure every client communicates with the backend in a consistent, predictable, and maintainable way.

This document defines **how the API works**, not the implementation of individual endpoints.

---

# Design Goals

The API should be:

- Simple to understand.
- Consistent.
- Predictable.
- Secure.
- Easy to consume.
- Easy to maintain.
- Suitable for offline synchronization.
- Independent of any frontend implementation.

---

# API Philosophy

The API is the contract between clients and the backend.

Clients should not need to understand backend implementation details.

The backend is responsible for enforcing business rules, validating requests, and protecting data integrity.

---

# Architectural Style

The platform exposes a RESTful API.

Resources represent business entities such as:

- Organizations
- Users
- Customers
- Vehicles
- Rentals
- Payments
- Maintenance

Endpoints operate on these resources using standard HTTP methods.

---

# Resource Naming

Resources should:

- Use plural nouns.
- Use lowercase letters.
- Use hyphens when necessary.
- Represent business concepts.

Examples:

```text
/customers

/vehicles

/rentals

/payments
```

Endpoints should never describe actions.

Avoid:

```text
/createCustomer

/getVehicles

/deleteRental
```

---

# HTTP Methods

The API follows standard REST conventions.

| Method | Purpose                   |
| ------ | ------------------------- |
| GET    | Retrieve resources        |
| POST   | Create resources          |
| PATCH  | Update existing resources |
| DELETE | Soft delete resources     |

Methods should always have a consistent meaning.

---

# Request Structure

Clients communicate using JSON.

Requests should include:

- Path parameters
- Query parameters
- Request body (when applicable)
- Authentication token

Only required information should be sent.

---

# Response Structure

Successful responses should follow a consistent format.

Example:

```json
{
  "data": {}
}
```

Collections return an array within the `data` property.

Response structures should remain consistent across the entire API.

---

# Error Responses

Errors should also follow a consistent format.

Example:

```json
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer not found."
  }
}
```

Errors should provide enough information for the client while avoiding exposure of internal implementation details.

---

# HTTP Status Codes

The API should use standard HTTP status codes.

Common responses include:

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| 200    | Success                                  |
| 201    | Resource created                         |
| 204    | Successful request with no response body |
| 400    | Invalid request                          |
| 401    | Authentication required                  |
| 403    | Permission denied                        |
| 404    | Resource not found                       |
| 409    | Business conflict                        |
| 422    | Validation failed                        |
| 500    | Unexpected server error                  |

Status codes should accurately represent the outcome of the request.

---

# Validation

Validation occurs before business logic is executed.

Validation includes:

- Required fields.
- Data types.
- Formats.
- Value ranges.
- Request structure.

Business validation is performed separately by the service layer.

---

# Authentication

Protected endpoints require authentication.

Authentication is performed using JWT access tokens.

Authentication details are documented separately in the Authentication Architecture document.

---

# Authentication Endpoints

Authentication endpoints are grouped under the `/api/auth/*` prefix.

Login and refresh return JSON access-token data. The server manages the refresh
session with an `HttpOnly` cookie that is secure in production and scoped to
`/api/auth`; the web client does not store or send the refresh token directly.

## POST /api/auth/login

- **Purpose:** Authenticate a user, return a short-lived access token, and set
  the refresh token in the approved `HttpOnly` cookie.
- **Request body:**
  ```json
  {
    "email": "owner@example.com",
    "password": "securepassword"
  }
  ```
- **Success response:** `200 OK`
  ```json
  {
    "data": {
      "accessToken": "...",
      "expiresAt": "2026-01-01T00:00:00.000Z"
    }
  }
  ```
- The refresh token is not returned in JSON.
- **Error responses:**
  - `401` Invalid credentials
  - `422` Validation failed

## POST /api/auth/refresh

- **Purpose:** Read the refresh token from the `HttpOnly` cookie, rotate it,
  and write the replacement token to that cookie. The previous refresh token
  is invalidated.
- **Request body:** None.
- **Success response:** `200 OK`
  ```json
  {
    "data": {
      "accessToken": "...",
      "expiresAt": "2026-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error responses:**
  - `401` Invalid or expired refresh token
  - `422` Validation failed

## POST /api/auth/logout

- **Purpose:** Revoke the refresh session identified by the `HttpOnly` cookie,
  clear that cookie, and end the authenticated session.
- **Request body:** None.
- **Success response:** `204 No Content` (no body)
- **Error responses:**
  - `422` Validation failed

## GET /api/auth/me

- **Purpose:** Retrieve the current authenticated user. Used by clients to restore the active session.
- **Request headers:** `Authorization: Bearer <accessToken>`
- **Success responses:**
  - `200 OK` with authenticated user information when the access token is valid:
    ```json
    {
      "data": {
        "id": "...",
        "email": "owner@example.com",
        "role": "OWNER",
        "organizationId": "...",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    }
    ```
  - `200 OK` with `{ "data": null }` when no authenticated user exists (no token provided).
- **Error responses:**
  - `401` Unauthorized when an authentication attempt is made with an invalid or malformed token.

---

# Organization Endpoints

Organization endpoints are grouped under the `/api/organizations/*` prefix.

## Organization Identity From Authentication

The organization identity is **never supplied by the client** for these endpoints.

- The authenticated organization ID is obtained from `req.user.org`.
- `req.user.org` originates from the validated JWT `org` claim.
- Clients cannot request another organization's data by providing an organization ID.
- This is part of the platform's tenant isolation strategy.

Since every authenticated user belongs to exactly one organization, the API derives the organization context from authentication instead of a URL parameter. This reduces the attack surface and prevents cross-organization access caused by user-controlled organization identifiers.

## GET /api/organizations/me

- **Purpose:** Retrieve the current authenticated user's organization.
- **Request headers:** `Authorization: Bearer <accessToken>`
- **Success response:** `200 OK`
  ```json
  {
    "data": {
      "id": "...",
      "name": "My Company",
      "status": "TRIAL",
      "legalName": null,
      "phone": null,
      "email": null,
      "address": null,
      "contractFooterText": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error responses:**
  - `401` Authentication required
  - `404` Organization not found

## PATCH /api/organizations/me

- **Purpose:** Update the current authenticated user's organization.
- **Authorization:** `OWNER` of an operational (`TRIAL` or `ACTIVE`) organization;
  `SUSPENDED` and `CANCELLED` organizations receive
  `403 ORGANIZATION_NOT_OPERATIONAL`.
- **Request headers:** `Authorization: Bearer <accessToken>`
- **Request body:**
  ```json
  {
    "name": "My Renamed Company",
    "legalName": "My Rental Company LLC",
    "phone": "+961 1 234 567",
    "email": "info@example.com",
    "address": "Beirut",
    "contractFooterText": "Approved rental terms apply."
  }
  ```
- **Success response:** `200 OK`
  ```json
  {
    "data": {
      "id": "...",
      "name": "My Renamed Company",
      "status": "TRIAL",
      "legalName": "My Rental Company LLC",
      "phone": "+961 1 234 567",
      "email": "info@example.com",
      "address": "Beirut",
      "contractFooterText": "Approved rental terms apply.",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error responses:**
  - `401` Authentication required
  - `403` Insufficient permissions
  - `404` Organization not found
  - `422` Validation failed

## POST /api/platform/organizations

- **Purpose:** Provision a client organization and its first `OWNER`. This is
  the only way to create a tenant: Markab is B2B with operator-managed
  onboarding, and there is no public registration endpoint.
- **Authorization:** `PLATFORM_OWNER` only; no tenant middleware.
- **Request body:**
  ```json
  { "organizationName": "Cedar Rentals", "ownerEmail": "founder@example.com", "initialStatus": "ACTIVE" }
  ```
  `initialStatus` is `ACTIVE` (default, the normal production choice) or `TRIAL`
  (currently the same operational access as `ACTIVE`, with no expiry or billing);
  `SUSPENDED`/`CANCELLED` are rejected. Unknown properties — notably any password — are rejected with `422`.
  The owner email is trimmed, lower-cased, and must be globally unique.
- **Behavior:** in one transaction the organization, its `OWNER`, a one-time
  password-setup token (the normal password-reset token; hash stored), and a
  `PLATFORM_ORGANIZATION_CREATED` audit entry are created. The `OWNER` account
  starts with an unusable random password hash; the owner sets their own password
  through the normal reset link, which is delivered after commit. A delivery
  failure does not roll the account back — use the owner password-reset support
  action to request a new link (setup links expire after one hour).
- **Success response:** `201 Created`
  ```json
  { "data": { "organization": { "id": "uuid", "name": "Cedar Rentals", "status": "ACTIVE", "...": "..." },
              "owner": { "id": "uuid", "email": "founder@example.com", "role": "OWNER" } } }
  ```
  No password, token, or setup link is returned.
- **Error responses:** `401`, `403`, `409 EMAIL_ALREADY_EXISTS`, `422`.

## GET /api/platform/organizations/:organizationId/users

- **Purpose:** Read-only support visibility into who has access to a client
  organization.
- **Authorization:** `PLATFORM_OWNER` only. This is a platform-specific read; it
  does not use tenant `/api/users` routes and grants no tenant-business access.
  Internal, deleted, and unknown organizations return `404`.
- **Success response:** `200`
  ```json
  {
    "data": {
      "users": [
        {
          "id": "uuid",
          "email": "owner@example.com",
          "role": "OWNER",
          "status": "ACTIVE",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "deactivatedAt": null
        }
      ],
      "invitations": [
        {
          "id": "uuid",
          "email": "employee@example.com",
          "status": "PENDING",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "expiresAt": "2026-01-08T00:00:00.000Z",
          "acceptedAt": null
        }
      ]
    }
  }
  ```
- **User state:** `status` is `DEACTIVATED` when the account is soft-deleted
  (`deactivatedAt` is set), otherwise `ACTIVE`. Ordering: `OWNER`, active
  `EMPLOYEE` accounts, then deactivated accounts, each by creation time.
- **Invitation state:** `ACCEPTED` when `acceptedAt` is set, otherwise `EXPIRED`
  when the expiry has passed, else `PENDING`. Revoked or replaced invitations
  cannot be distinguished (a resend overwrites the same record). Ordering:
  pending, expired, accepted, newest first.
- **Never returned:** password hashes, session or reset tokens, invitation
  tokens or token hashes, acceptance URLs, tenant business data.
- **Invariant:** a `PLATFORM_OWNER` found inside a client organization is not
  shown as a tenant user; the request fails with
  `500 ORGANIZATION_DATA_INTEGRITY_ERROR`.
- **Error responses:** `401`, `403`, `404`, `422`, `500`.

## POST /api/platform/organizations/:organizationId/invitations/:invitationId/resend

- **Purpose:** Support action: reissue an existing employee invitation of a
  client organization.
- **Authorization:** `PLATFORM_OWNER` only; platform-specific (tenant invitation
  routes stay closed to `PLATFORM_OWNER`). Internal, deleted, and unknown
  organizations, and invitations of other organizations, return `404`.
- **Behavior:** identical to the tenant resend: the previous token is
  invalidated, a new seven-day token is created and only its hash stored, and
  the new acceptance token is returned once for manual secure delivery.
  Allowed for pending and expired invitations of `TRIAL`/`ACTIVE` organizations.
- **Success response:** `200` with the invitation (`EmployeeInvitationResponse`,
  including `acceptanceToken`).
- **Errors:** `403 ORGANIZATION_NOT_OPERATIONAL` for `SUSPENDED`/`CANCELLED`,
  `409 INVITATION_ALREADY_ACCEPTED`, `409 EMAIL_ALREADY_EXISTS`, `404`, `422`.

## POST /api/platform/organizations/:organizationId/owner/password-reset

- **Purpose:** Support action: send a password recovery link to the
  organization's owner.
- **Authorization:** `PLATFORM_OWNER` only; internal/deleted/unknown
  organizations return `404`.
- **Behavior:** no body. The server resolves the single active `OWNER`, issues
  the normal one-hour reset token (hash stored, earlier tokens invalidated) and
  passes it to the configured delivery channel. No email is accepted from the
  client and no token or password is ever returned. Allowed for every lifecycle
  status; it does not change organization status. Completing the reset follows
  the normal flow (sessions revoked).
- **Success response:** `204 No Content`.
- **Errors:** `409 OWNER_DEACTIVATED`; `500 ORGANIZATION_DATA_INTEGRITY_ERROR`
  for a missing or duplicated active owner; `404`; `422`.

## POST /api/platform/organizations/:organizationId/users/:userId/deactivate

- **Purpose:** Support action: deactivate a tenant employee account.
- **Authorization:** `PLATFORM_OWNER` only. Only `EMPLOYEE` accounts of the
  selected client organization can be targeted.
- **Request body:** `{ "reason": "Left the company" }` — mandatory, trimmed,
  1–500 characters.
- **Behavior:** in one transaction the user is soft-deleted (never hard-deleted;
  business history is preserved), all refresh sessions are revoked, and an audit
  entry with the reason is appended. There is no reactivation. Allowed for every
  lifecycle status.
- **Success response:** `200` with the updated organization user
  (`status: "DEACTIVATED"`).
- **Errors:** `409 USER_NOT_DEACTIVATABLE` (owner or platform owner),
  `409 USER_ALREADY_DEACTIVATED`, `404 USER_NOT_FOUND` (including users of other
  organizations), `422` (missing, blank, or over-long reason).

## PATCH /api/platform/organizations/:organizationId/status

- **Purpose:** Update a tenant organization's SaaS lifecycle status.
- **Authorization:** `PLATFORM_OWNER` only.
- **Request body:** `{ "status": "SUSPENDED", "reason": "Unpaid invoice" }`,
  where status is `TRIAL`, `ACTIVE`, `SUSPENDED`, or `CANCELLED` and `reason` is
  an optional string of at most 500 characters (trimmed).
- **Allowed transitions:** `TRIAL` → `ACTIVE`, `SUSPENDED`, `CANCELLED`;
  `ACTIVE` → `SUSPENDED`, `CANCELLED`; `SUSPENDED` → `ACTIVE`, `CANCELLED`;
  `CANCELLED` → `ACTIVE`. Requesting the current status is an idempotent no-op
  with no audit entry. Any other transition returns
  `409 INVALID_ORGANIZATION_STATUS_TRANSITION` (also returned if the status
  changed concurrently).
- **Reason:** required (`422 STATUS_CHANGE_REASON_REQUIRED`) when moving to
  `SUSPENDED` or `CANCELLED` and when reactivating a `CANCELLED` organization;
  stored in the audit entry metadata.
- **Behavior:** suspended and cancelled organizations retain authentication and
  account-status visibility, but their tenant business APIs, organization
  profile updates, and invitation acceptance return
  `403 ORGANIZATION_NOT_OPERATIONAL`.

## DELETE /api/organizations/me

- **Purpose:** Soft-delete the current authenticated user's organization.
- **Request headers:** `Authorization: Bearer <accessToken>`
- **Success response:** `204 No Content` (no body)
- **Error responses:**
  - `401` Authentication required
  - `403` Insufficient permissions
  - `404` Organization not found

---

# Authorization

Authentication identifies the user.

Authorization determines what the user is allowed to do.

Permissions are evaluated according to:

- Organization
- User role
- Business rules

Authorization is enforced by the backend.

---

# Pagination

Collection endpoints should support pagination.

Typical query parameters include:

```text
?page=1&limit=20
```

Paginated responses should include metadata such as:

- Current page
- Page size
- Total records
- Total pages

---

# Filtering

Collection endpoints may support filtering.

Examples include:

- Vehicle status
- Rental status
- Customer
- Date ranges

Filtering should use query parameters.

---

# Sorting

Collection endpoints may support sorting.

Example:

```text
?sort=created_at&order=desc
```

Sorting should remain consistent across all resources.

---

# Searching

Search functionality should use query parameters.

Example:

```text
?search=john
```

Search behavior should remain predictable across the application.

---

# Versioning

The API should support future versioning.

Initial version:

```text
/api/v1
```

Future breaking changes should introduce a new API version rather than modifying existing contracts.

---

# Offline Synchronization

The API is designed to support offline-first operation.

Synchronization endpoints should:

- Receive locally created records.
- Detect conflicts.
- Resolve synchronization state.
- Return synchronization results.

Offline synchronization is considered a core API capability.

---

# Security

The API should:

- Require authentication where appropriate.
- Validate all incoming data.
- Never trust client input.
- Return only necessary information.
- Prevent unauthorized access.

Security applies to every endpoint.

---

# Consistency

Every endpoint should follow the same conventions.

Clients should not need to learn different patterns for different resources.

Consistency improves maintainability, usability, and developer experience.

---

# Future Expansion

The API should evolve without breaking existing clients.

New resources and capabilities should follow the same design principles defined in this document.

---

# Guiding Principle

Every API design decision should answer one question:

> **Does this make communication between clients and the backend simpler, more consistent, and easier to maintain while accurately supporting the business requirements?**
