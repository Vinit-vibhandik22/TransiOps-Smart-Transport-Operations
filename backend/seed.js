const db = require('./db');

async function seed() {
  console.log('TransitOps: Starting Database Seeding...');

  try {
    // 1. Clear Existing Data
    // We do this dynamically. If it's SQLite, we can truncate/delete.
    // If it's JSON fallback, the DAO handles it.
    // Let's implement clearing in a clean way:
    if (db.isSQLiteMode()) {
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const dbPath = path.join(__dirname, '..', 'transitops.db');
      const fs = require('fs');
      if (fs.existsSync(dbPath)) {
        // Close DB connections before deleting
        // For simplicity, we can just delete from the tables using SQL
        const tempDb = new sqlite3.Database(dbPath);
        const tables = ['users', 'vehicles', 'drivers', 'trips', 'maintenance_logs', 'fuel_logs', 'expenses', 'documents'];
        for (const table of tables) {
          await new Promise((resolve) => tempDb.run(`DELETE FROM ${table}`, () => resolve()));
        }
        await new Promise((resolve) => tempDb.close(() => resolve()));
      }
    } else {
      // In JSON mode, write empty arrays
      const fs = require('fs');
      const path = require('path');
      const DATA_DIR = path.join(__dirname, '..', 'data');
      const files = ['users.json', 'vehicles.json', 'drivers.json', 'trips.json', 'maintenance.json', 'fuel.json', 'expenses.json', 'documents.json'];
      files.forEach(file => {
        fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify([], null, 2));
      });
    }

    console.log('Cleared existing data.');

    // 2. Insert Users
    const users = [
      { email: 'manager@transitops.com', password: 'password123', name: 'Frank Miller (Fleet Mgr)', role: 'fleet_manager' },
      { email: 'driver@transitops.com', password: 'password123', name: 'Raven K. (Dispatcher)', role: 'driver' },
      { email: 'safety@transitops.com', password: 'password123', name: 'Sophia Chen (Safety Officer)', role: 'safety_officer' },
      { email: 'finance@transitops.com', password: 'password123', name: 'Richard Cox (Financial Analyst)', role: 'financial_analyst' }
    ];
    for (const u of users) {
      await db.createUser(u);
    }
    console.log('Seeded Users.');

    // 3. Insert Vehicles
    const vehicles = [
      { registration_number: 'VAN-05', name: 'Ford Transit Van 05', type: 'Van', max_load_capacity: 500, odometer: 12000, acquisition_cost: 35000, status: 'Available', region: 'North' },
      { registration_number: 'TRK-12', name: 'Volvo Heavy Truck 12', type: 'Truck', max_load_capacity: 5000, odometer: 85000, acquisition_cost: 110000, status: 'In Shop', region: 'East' },
      { registration_number: 'VAN-08', name: 'Mercedes Sprinter 08', type: 'Van', max_load_capacity: 800, odometer: 24000, acquisition_cost: 45000, status: 'Available', region: 'South' },
      { registration_number: 'SEMI-01', name: 'Peterbilt Semi 01', type: 'Semi-Trailer', max_load_capacity: 15000, odometer: 150000, acquisition_cost: 160000, status: 'On Trip', region: 'West' },
      { registration_number: 'TRK-09', name: 'Isuzu Medium Truck 09', type: 'Truck', max_load_capacity: 2500, odometer: 42000, acquisition_cost: 55000, status: 'Retired', region: 'North' }
    ];
    for (const v of vehicles) {
      await db.createVehicle(v);
    }
    // Set explicit status for SEMI-01 and TRK-12 just in case
    await db.updateVehicle('SEMI-01', { status: 'On Trip' });
    await db.updateVehicle('TRK-12', { status: 'In Shop' });
    await db.updateVehicle('TRK-09', { status: 'Retired' });
    console.log('Seeded Vehicles.');

    // 4. Insert Drivers
    const drivers = [
      { name: 'Alex Johnson', license_number: 'DL-9827361', license_category: 'Class A CDL', license_expiry_date: '2028-10-15', contact_number: '+1 555-0199', safety_score: 95, status: 'Available' },
      { name: 'Sarah Smith', license_number: 'DL-1204859', license_category: 'Class B CDL', license_expiry_date: '2026-03-01', contact_number: '+1 555-0122', safety_score: 88, status: 'Available' },
      { name: 'Michael Green', license_number: 'DL-5529381', license_category: 'Class A CDL', license_expiry_date: '2027-05-12', contact_number: '+1 555-0143', safety_score: 98, status: 'On Trip' },
      { name: 'David Miller', license_number: 'DL-3829102', license_category: 'Class C', license_expiry_date: '2027-09-20', contact_number: '+1 555-0155', safety_score: 52, status: 'Suspended' }
    ];
    const createdDrivers = [];
    for (const d of drivers) {
      const newD = await db.createDriver(d);
      createdDrivers.push(newD);
    }
    // Update status explicitly to bypass default 'Available'
    const michael = createdDrivers.find(d => d.name === 'Michael Green');
    if (michael) await db.updateDriver(michael.id, { status: 'On Trip' });
    const david = createdDrivers.find(d => d.name === 'David Miller');
    if (david) await db.updateDriver(david.id, { status: 'Suspended' });
    console.log('Seeded Drivers.');

    // 5. Insert Trips
    const michaelId = michael ? michael.id : 3;
    const alexId = createdDrivers.find(d => d.name === 'Alex Johnson')?.id || 1;

    const trips = [
      { source: 'Warehouse A', destination: 'Retail Store 3', vehicle_id: 'SEMI-01', driver_id: michaelId, cargo_weight: 12000, planned_distance: 350, odometer_start: 149650, odometer_end: null, fuel_consumed: null, revenue: 1500, status: 'Dispatched' },
      { source: 'Port Terminal', destination: 'Distribution Center', vehicle_id: 'VAN-08', driver_id: alexId, cargo_weight: 600, planned_distance: 120, odometer_start: 23880, odometer_end: 24000, fuel_consumed: 15, revenue: 450, status: 'Completed' },
      { source: 'HQ Depot', destination: 'North Station', vehicle_id: 'VAN-05', driver_id: alexId, cargo_weight: 300, planned_distance: 80, odometer_start: 11920, odometer_end: 12000, fuel_consumed: 8, revenue: 280, status: 'Completed' }
    ];
    for (const t of trips) {
      await db.createTrip(t);
    }
    console.log('Seeded Trips.');

    // 6. Insert Maintenance Logs
    const maintenanceLogs = [
      { vehicle_id: 'TRK-12', description: 'Engine Diagnostics & Spark Plug Replacement', cost: 1200, start_date: '2026-07-10', end_date: null, status: 'Active' },
      { vehicle_id: 'VAN-08', description: 'Tire Rotation and Brake Pad Service', cost: 450, start_date: '2026-06-15', end_date: '2026-06-16', status: 'Closed' }
    ];
    for (const log of maintenanceLogs) {
      await db.createMaintenanceLog(log);
    }
    console.log('Seeded Maintenance Logs.');

    // 7. Insert Fuel Logs
    const fuelLogs = [
      { vehicle_id: 'SEMI-01', liters: 120, cost: 180, date: '2026-07-08' },
      { vehicle_id: 'VAN-05', liters: 40, cost: 60, date: '2026-07-09' },
      { vehicle_id: 'VAN-08', liters: 50, cost: 75, date: '2026-07-10' }
    ];
    for (const log of fuelLogs) {
      await db.createFuelLog(log);
    }
    console.log('Seeded Fuel Logs.');

    // 8. Insert Expenses
    const expenses = [
      { vehicle_id: 'SEMI-01', type: 'Tolls', cost: 45, date: '2026-07-08', description: 'Highway Tolls route 90' },
      { vehicle_id: 'TRK-12', type: 'Registration', cost: 300, date: '2026-07-01', description: 'Annual state vehicle registration fee' }
    ];
    for (const exp of expenses) {
      await db.createExpense(exp);
    }
    console.log('Seeded Expenses.');

    console.log('TransitOps: Database Seeding Completed Successfully!');
  } catch (err) {
    console.error('TransitOps: Database Seeding Failed!', err);
  }
}

seed();
