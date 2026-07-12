require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db_pg');

async function seed() {
  console.log('TransitOps: Starting Supabase Seeding...');

  // ── Users (hashed passwords) ──────────────────────────
  const hash = await bcrypt.hash('Password@123', 12);
  const users = [
    { email: 'manager@transitops.com',  password_hash: hash, name: 'Frank Miller (Fleet Mgr)',          role: 'fleet_manager',      is_verified: true, fail_count: 0, phone: '+91 9000000001' },
    { email: 'driver@transitops.com',   password_hash: hash, name: 'Raven K. (Driver)',                 role: 'driver',             is_verified: true, fail_count: 0, phone: '+91 9000000002' },
    { email: 'safety@transitops.com',   password_hash: hash, name: 'Sophia Chen (Safety Officer)',      role: 'safety_officer',     is_verified: true, fail_count: 0, phone: '+91 9000000003' },
    { email: 'finance@transitops.com',  password_hash: hash, name: 'Richard Cox (Financial Analyst)',   role: 'financial_analyst',  is_verified: true, fail_count: 0, phone: '+91 9000000004' },
  ];
  for (const u of users) {
    try { await db.createUser(u); } catch (_) { /* already exists */ }
  }
  console.log('Seeded Users. Password for all: Password@123');

  // ── Vehicles ──────────────────────────────────────────
  const vehicles = [
    { registration_number: 'VAN-05',  model: 'Ford Transit Van 05',     type: 'Van',          max_load_capacity: 500,   odometer: 12000, acquisition_cost: 35000,  status: 'Available', region: 'North' },
    { registration_number: 'TRK-12',  model: 'Volvo Heavy Truck 12',    type: 'Truck',        max_load_capacity: 5000,  odometer: 85000, acquisition_cost: 110000, status: 'In Shop',   region: 'East'  },
    { registration_number: 'VAN-08',  model: 'Mercedes Sprinter 08',    type: 'Van',          max_load_capacity: 800,   odometer: 24000, acquisition_cost: 45000,  status: 'Available', region: 'South' },
    { registration_number: 'SEMI-01', model: 'Peterbilt Semi 01',       type: 'Semi-Trailer', max_load_capacity: 15000, odometer: 150000,acquisition_cost: 160000, status: 'On Trip',   region: 'West'  },
    { registration_number: 'TRK-09',  model: 'Isuzu Medium Truck 09',   type: 'Truck',        max_load_capacity: 2500,  odometer: 42000, acquisition_cost: 55000,  status: 'Retired',   region: 'North' },
  ];
  for (const v of vehicles) {
    try { await db.createVehicle(v); } catch (_) { /* already exists */ }
  }
  console.log('Seeded Vehicles.');

  // ── Drivers ───────────────────────────────────────────
  const drivers = [
    { name: 'Alex Johnson',   license_number: 'DL-9827361', license_category: 'Class A CDL', license_expiry_date: '2028-10-15', contact_number: '+1 555-0199', safety_score: 95, status: 'Available' },
    { name: 'Sarah Smith',    license_number: 'DL-1204859', license_category: 'Class B CDL', license_expiry_date: '2026-03-01', contact_number: '+1 555-0122', safety_score: 88, status: 'Available' },
    { name: 'Michael Green',  license_number: 'DL-5529381', license_category: 'Class A CDL', license_expiry_date: '2027-05-12', contact_number: '+1 555-0143', safety_score: 98, status: 'On Trip'   },
    { name: 'David Miller',   license_number: 'DL-3829102', license_category: 'Class C',     license_expiry_date: '2027-09-20', contact_number: '+1 555-0155', safety_score: 52, status: 'Suspended' },
  ];
  const createdDrivers = [];
  for (const d of drivers) {
    try { createdDrivers.push(await db.createDriver(d)); } catch (_) { /* already exists */ }
  }
  console.log('Seeded Drivers.');

  // ── Trips ─────────────────────────────────────────────
  const trips = [
    { source: 'Mumbai',    destination: 'Delhi',   vehicle_id: 'VAN-08',  driver_id: createdDrivers[0]?.id || 1, cargo_weight: 300,  planned_distance: 1400, odometer_start: 24000, revenue: 8500,  status: 'Completed', odometer_end: 25400, fuel_consumed: 140 },
    { source: 'Delhi',     destination: 'Kolkata', vehicle_id: 'TRK-12',  driver_id: createdDrivers[1]?.id || 2, cargo_weight: 2000, planned_distance: 1500, odometer_start: 85000, revenue: 12000, status: 'Completed', odometer_end: 86500, fuel_consumed: 300 },
    { source: 'Bangalore', destination: 'Chennai', vehicle_id: 'SEMI-01', driver_id: createdDrivers[2]?.id || 3, cargo_weight: 8000, planned_distance: 350,  odometer_start: 150000,revenue: 6000,  status: 'Dispatched'},
  ];
  for (const t of trips) {
    try { await db.createTrip(t); } catch (e) { console.warn('Trip seed skip:', e.message); }
  }
  console.log('Seeded Trips.');

  // ── Maintenance ───────────────────────────────────────
  try {
    await db.createMaintenanceLog({ vehicle_id: 'TRK-12', description: 'Engine overhaul and brake replacement', cost: 4500, start_date: '2024-06-01', status: 'Active' });
    console.log('Seeded Maintenance.');
  } catch (_) {}

  // ── Fuel Logs ─────────────────────────────────────────
  try {
    await db.createFuelLog({ vehicle_id: 'VAN-08',  liters: 140, cost: 14000, date: '2024-06-20' });
    await db.createFuelLog({ vehicle_id: 'TRK-12',  liters: 300, cost: 28500, date: '2024-06-22' });
    console.log('Seeded Fuel Logs.');
  } catch (_) {}

  // ── Expenses ──────────────────────────────────────────
  try {
    await db.createExpense({ vehicle_id: 'VAN-08',  type: 'Maintenance', cost: 1200, date: '2024-05-15', description: 'Tyre replacement' });
    await db.createExpense({ vehicle_id: 'TRK-12',  type: 'Maintenance', cost: 4500, date: '2024-06-01', description: 'Auto-logged: Engine overhaul' });
    console.log('Seeded Expenses.');
  } catch (_) {}

  console.log('\n✅ TransitOps Supabase Seeding Complete!');
  console.log('Login with any of these accounts (password: Password@123):');
  console.log('  manager@transitops.com  — Fleet Manager');
  console.log('  driver@transitops.com   — Driver');
  console.log('  safety@transitops.com   — Safety Officer');
  console.log('  finance@transitops.com  — Financial Analyst');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
