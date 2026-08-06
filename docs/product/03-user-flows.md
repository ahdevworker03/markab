# User Flows

## Introduction

This document describes the primary workflows supported by the Vehicle Rental Management Platform.

Each flow represents a business process performed by users during their daily operations. These flows are based on validated business requirements and will guide future UI design, backend implementation, database modeling, and API development.

---

# Authentication

## Login

### Goal

Allow authorized users to securely access their organization's workspace.

### Flow

1. User opens the application.
2. User enters their credentials.
3. System validates the credentials.
4. User is redirected to the dashboard.

### Alternative Flows

- Invalid credentials are rejected.
- Inactive users cannot log in.

---

# Customer Management

## Add Customer

### Goal

Create a customer profile before renting a vehicle.

### Flow

1. User opens Customer Management.
2. User selects **Add Customer**.
3. User enters customer information.
4. User enters driver's license information.
5. User saves the customer.
6. Customer profile becomes available for future rentals.

---

## Search Customer

### Goal

Find an existing customer quickly.

### Flow

1. User enters a search term.
2. System displays matching customers.
3. User selects a customer.
4. Customer details and rental history are displayed.

---

## Edit Customer

### Goal

Update customer information.

### Flow

1. User opens a customer profile.
2. User edits information.
3. User saves changes.
4. Updated information becomes immediately available.

---

# Vehicle Management

## Register Vehicle

### Goal

Add a vehicle to the business fleet.

### Flow

1. User opens Vehicle Management.
2. User selects **Add Vehicle**.
3. User enters vehicle information.
4. User uploads relevant documents and photos.
5. Vehicle is saved.
6. Vehicle becomes available for business operations.

---

## Search Vehicle

### Goal

Locate vehicles instantly.

### Flow

1. User searches by vehicle information.
2. System displays matching vehicles.
3. User selects a vehicle.
4. Vehicle details, status, and history are displayed.

---

## Update Vehicle Status

### Goal

Maintain accurate fleet availability.

### Flow

1. User opens a vehicle profile.
2. User changes vehicle status.
3. System updates availability.
4. Dashboard reflects the new status.

---

# Rental Management

## Create Rental

### Goal

Rent a vehicle to a customer.

### Flow

1. User starts a new rental.
2. User selects an existing customer or creates a new one.
3. User selects an available vehicle.
4. User enters rental details.
5. System validates vehicle availability.
6. Rental is created.
7. Vehicle status changes to **Rented**.
8. Contract becomes available for printing or PDF export.

### Alternative Flows

- Customer does not exist → Create Customer.
- Vehicle is unavailable → Select another vehicle.

---

## Return Vehicle

### Goal

Complete an active rental.

### Flow

1. User opens the active rental.
2. User records the return.
3. System updates rental status.
4. Vehicle becomes available or enters maintenance.
5. Rental is archived.

---

## Extend Rental

### Goal

Increase the rental period.

### Flow

1. User opens an active rental.
2. User updates the return date.
3. System verifies vehicle availability.
4. Rental is updated.

---

## Cancel Rental

### Goal

Cancel a rental before it begins.

### Flow

1. User opens the rental.
2. User selects **Cancel**.
3. System releases the reserved vehicle.
4. Rental is marked as cancelled.

---

# Contract Management

## Generate Rental Contract

### Goal

Produce a legal rental agreement.

### Flow

1. User opens an active rental.
2. User generates the contract.
3. System creates the contract.
4. User prints or exports the contract as PDF.

---

# Maintenance Management

## Record Maintenance

### Goal

Track maintenance performed on a vehicle.

### Flow

1. User selects a vehicle.
2. User creates a maintenance record.
3. User records repair details, replaced parts, vendor, date, notes, and cost.
4. Maintenance record is saved.
5. Vehicle history is updated.

---

## Complete Maintenance

### Goal

Return a maintained vehicle to service.

### Flow

1. User opens an active maintenance record.
2. User marks maintenance as completed.
3. Vehicle status changes to **Available**.
4. Dashboard is updated.

---

# Financial Management

## Record Rental Payment

### Goal

Track customer payments.

### Flow

1. User opens a rental.
2. User records a payment.
3. System updates the payment status.
4. Rental balance is recalculated.

---

## Record Expense

### Goal

Track operational costs.

### Flow

1. User creates an expense.
2. User associates it with a vehicle when applicable.
3. User saves the expense.
4. Dashboard and analytics update automatically.

---

# Task Management

## Create Task

### Goal

Manage operational reminders.

### Flow

1. User creates a task.
2. User sets a due date.
3. User optionally marks the task as recurring.
4. Task appears in upcoming reminders.

---

## Complete Task

### Goal

Track finished work.

### Flow

1. User opens a task.
2. User marks it as completed.
3. Completed task is archived or removed from active reminders.

---

# Dashboard

## Review Daily Operations

### Goal

Provide business owners with an overview of current operations.

### Flow

1. User opens the dashboard.
2. System displays:

   - Active rentals
   - Available vehicles
   - Vehicles under maintenance
   - Upcoming returns
   - Revenue summary
   - Expense summary
   - Pending tasks

3. User navigates directly to the relevant module.

---

# Offline Workflow

## Continue Working Without Internet

### Goal

Allow businesses to continue operating during connectivity interruptions.

### Flow

1. User opens the application without an internet connection.
2. Previously synchronized data is loaded locally.
3. User searches customers and vehicles.
4. User creates or edits records.
5. Changes are stored locally.
6. Internet connectivity returns.
7. System synchronizes local changes automatically.
8. User receives confirmation that synchronization completed successfully.

---

# Future Vehicle Sales

## Sell Fleet Vehicle

### Goal

Allow businesses to sell vehicles that are leaving the rental fleet.

### Flow

1. User selects a vehicle.
2. User changes the vehicle status to **Listed for Sale**.
3. User records buyer information.
4. User records sale details.
5. System generates a sales contract.
6. Vehicle status changes to **Sold**.
7. Vehicle remains accessible through historical records but is no longer available for rental.
