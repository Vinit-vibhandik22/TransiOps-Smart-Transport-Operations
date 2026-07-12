# TransitOps - Smart Transport Operations Platform

TransitOps is a centralized, end-to-end transport operations platform that digitizes vehicle, driver, dispatch, maintenance, and expense management while enforcing strict business rules and providing real-time operational insights.

Built for the **Odoo Hackathon**.

## Architecture & Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (via `sqlite3` package) with auto-fallback to file-based JSON database in case of system binary compile failures.
- **Frontend**: Single Page Application (SPA) built using modern vanilla HTML, CSS, and JS.
- **Visuals**: Styled with a premium dark/light glassmorphic UI, responsive sidebar, custom badges, and interactive visualizations using **Chart.js** and **Lucide Icons**.
- **Role-Based Access Control (RBAC)**: Supports roles for Fleet Manager, Driver, Safety Officer, and Financial Analyst.

---

## Features

1. **Operations Dashboard & KPIs**: Real-time stats for fleet utilization, active vehicles, drivers on duty, pending/active trips, and in-shop logs. Includes active filter controls by vehicle type and region.
2. **Vehicle Registry & Document Uploads**: Full CRUD for vehicles. Upload and manage vehicle registration certificates, permits, and insurance policies (stored locally).
3. **Driver Management & Safety Compliance**: Keep track of driver profiles, licenses, and safety scores.
4. **Trip Lifecycle Management**: End-to-end trip dispatcher: `Draft` &rarr; `Dispatched` &rarr; `Completed` &rarr; `Cancelled`.
5. **Business Rule Engine**:
   - registration numbers must be unique.
   - Retired or In Shop vehicles are hidden/blocked from dispatch.
   - Driver license validity is verified before dispatch.
   - Drivers already on trip or suspended cannot be assigned.
   - Cargo weights are validated against maximum vehicle load capacities.
   - Automatic statuses updates for driver and vehicle throughout trip cycle.
6. **Vehicle Maintenance Workflow**: Log vehicle repairs to place them `In Shop`. Complete repairs to restore them to `Available`, automatically logging operational cost.
7. **Fuel & Expenses Tracking**: Log fuel receipts and operating expenses. Trip completion automatically calculates fuel efficiency and cost metrics.
8. **ROI & Operational Analytics**: Distance, fuel efficiency (km/L), total costs, and Vehicle ROI calculated dynamically. Reports can be exported to CSV or printable PDF.
9. **Compliance Notification Bar**: Alert alerts displayed on dashboard for expired/expiring driver licenses or low safety scores.

---

## Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Seed the database**:
   ```bash
   npm run seed
   ```

3. **Start the server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## Demo Accounts (RBAC)

The login screen features "Quick Login" buttons, or you can sign in manually using:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Fleet Manager** | `manager@transitops.com` | `password123` | Full administrative capabilities across all modules. |
| **Driver** | `driver@transitops.com` | `password123` | Trip lifecycle management (create/complete/cancel) and fuel logs. |
| **Safety Officer** | `safety@transitops.com` | `password123` | Driver registrations, license compliance monitoring, and safety score reviews. |
| **Financial Analyst** | `finance@transitops.com` | `password123` | Log operational expenses and audit ROI reports. |
