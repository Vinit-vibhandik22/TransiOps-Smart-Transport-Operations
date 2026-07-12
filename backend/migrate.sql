-- ============================================================
-- TransitOps: Full Database Migration for Supabase PostgreSQL
-- Run this ENTIRE script in:
-- https://supabase.com/dashboard/project/ceqfickdvljxldrywsst/sql/new
-- ============================================================

-- Drop tables in reverse-dependency order (safe re-run)
DROP TABLE IF EXISTS otp_tokens CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS fuel_logs CASCADE;
DROP TABLE IF EXISTS maintenance_logs CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS (extended for auth)
CREATE TABLE users (
  id               SERIAL PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('fleet_manager','driver','safety_officer','financial_analyst')),
  phone            TEXT,
  is_verified      BOOLEAN DEFAULT FALSE,
  fail_count       INTEGER DEFAULT 0,
  frozen_until     TIMESTAMPTZ,
  refresh_token    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OTP TOKENS
CREATE TABLE otp_tokens (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  otp_code    TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('signup','reset','unfreeze')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VEHICLES
CREATE TABLE vehicles (
  registration_number  TEXT PRIMARY KEY,
  model                TEXT,
  type                 TEXT,
  max_load_capacity    FLOAT,
  odometer             FLOAT,
  acquisition_cost     FLOAT,
  status               TEXT DEFAULT 'Available',
  region               TEXT
);

-- 4. DRIVERS
CREATE TABLE drivers (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT,
  license_number       TEXT,
  license_category     TEXT,
  license_expiry_date  TEXT,
  contact_number       TEXT,
  safety_score         FLOAT,
  status               TEXT DEFAULT 'Available'
);

-- 5. TRIPS
CREATE TABLE trips (
  id               SERIAL PRIMARY KEY,
  source           TEXT,
  destination      TEXT,
  vehicle_id       TEXT REFERENCES vehicles(registration_number) ON DELETE SET NULL,
  driver_id        INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  cargo_weight     FLOAT,
  planned_distance FLOAT,
  odometer_start   FLOAT,
  odometer_end     FLOAT,
  fuel_consumed    FLOAT,
  revenue          FLOAT DEFAULT 0,
  status           TEXT DEFAULT 'Draft',
  created_at       TEXT
);

-- 6. MAINTENANCE LOGS
CREATE TABLE maintenance_logs (
  id          SERIAL PRIMARY KEY,
  vehicle_id  TEXT REFERENCES vehicles(registration_number) ON DELETE SET NULL,
  description TEXT,
  cost        FLOAT DEFAULT 0,
  start_date  TEXT,
  end_date    TEXT,
  status      TEXT DEFAULT 'Active'
);

-- 7. FUEL LOGS
CREATE TABLE fuel_logs (
  id        SERIAL PRIMARY KEY,
  vehicle_id TEXT REFERENCES vehicles(registration_number) ON DELETE SET NULL,
  trip_id   INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  liters    FLOAT,
  cost      FLOAT,
  date      TEXT
);

-- 8. EXPENSES
CREATE TABLE expenses (
  id          SERIAL PRIMARY KEY,
  vehicle_id  TEXT REFERENCES vehicles(registration_number) ON DELETE SET NULL,
  trip_id     INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  type        TEXT,
  cost        FLOAT,
  date        TEXT,
  description TEXT
);

-- 9. DOCUMENTS
CREATE TABLE documents (
  id            SERIAL PRIMARY KEY,
  vehicle_id    TEXT REFERENCES vehicles(registration_number) ON DELETE CASCADE,
  document_type TEXT,
  file_name     TEXT,
  file_path     TEXT,
  upload_date   TEXT
);

-- Indexes for performance
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_fuel_vehicle ON fuel_logs(vehicle_id);
CREATE INDEX idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX idx_otp_email ON otp_tokens(email);
CREATE INDEX idx_users_email ON users(email);
