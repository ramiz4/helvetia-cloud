# Platform Features & Implementation

This document details the implementation of core functional features of the Helvetia Cloud platform.

---

## 1. Terms of Service & Legal Compliance

The platform implements a robust system for managing user acceptance of Terms of Service (ToS).

### Features

- **Versioning**: Each ToS update increments a version string.
- **Mandatory Acceptance**: Users must accept the latest version to proceed.
- **Blocking Modal**: A `TermsAcceptanceModal` interrupts the user experience if their accepted version is outdated.
  - _Scroll Enforcement_: Users must scroll to the bottom of the text to enable the "Accept" button.
- **Localization**: ToS content is served in the user's preferred language (EN, DE, FR, IT).

### Implementation

- **API**: `/api/v1/terms/check-acceptance` checks the user's status.
- **Frontend**: `TermsAcceptanceWrapper` wraps the application to enforce the check globally for authenticated users.
- **Audit**: Acceptance timestamps are stored in the database for compliance.

---

## 2. Organizations & Team Implementation

Helvetia Cloud supports multi-user collaboration through Organizations.

### Data Model

- **User**: Represents an individual identity (GitHub account).
- **Organization**: A logical grouping of resources and members.
- **Member**: A link between User and Organization with a Role (OWNER, ADMIN, MEMBER, VIEWER).

### Key Features

- **Resource Ownership**: Services and Volumes belong to an Organization, not a User directly.
- **Role-Based Access Control (RBAC)**:
  - _Owner_: Full control, billing management, deletion.
  - _Admin_: Resource management, member invites.
  - _Member_: Resource deployment, viewing logs.
  - _Viewer_: Read-only access.
- **Switching Context**: Users can switch between multiple organizations they belong to.

---

## 3. Team Collaboration

Real-time and asynchronous collaboration features enable teams to work together effectively.

### Features

- **Activity Logs**: Audit trail of who deployed, modified, or deleted resources.
- **Shared Invoices**: Billing is centralized at the Organization level.
- **Invitations**: Secure email/link-based flow to invite new members to an organization.

---

## 4. Admin Extraction & Management

Administrative functions are separated from the standard user flow to ensure security and clean architecture.

### Implementation

- **Separate API Routes**: Admin endpoints are isolated under `/api/admin`.
- **Superadmin Flag**: Special flag on the User model for platform administrators.
- **Capabilities**:
  - View all users and organizations.
  - Impersonate users for support.
  - System-wide announcements.
  - Global resource monitoring.
