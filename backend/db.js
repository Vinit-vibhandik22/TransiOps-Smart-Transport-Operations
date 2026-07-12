const fs = require('fs');
const path = require('path');

// Global variables for SQLite or JSON implementation
let isSQLite = true;
let sqliteDb = null;

// JSON database file paths for fallback
const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  vehicles: path.join(DATA_DIR, 'vehicles.json'),
  drivers: path.join(DATA_DIR, 'drivers.json'),
  trips: path.join(DATA_DIR, 'trips.json'),
  maintenance: path.join(DATA_DIR, 'maintenance.json'),
  fuel: path.join(DATA_DIR, 'fuel.json'),
  expenses: path.join(DATA_DIR, 'expenses.json'),
  documents: path.join(DATA_DIR, 'documents.json')
};

// Try importing sqlite3
try {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '..', 'transitops.db');
  sqliteDb = new sqlite3.Database(dbPath);
  console.log('TransitOps: Successfully connected to SQLite Database.');
} catch (err) {
  console.warn('TransitOps Warning: Failed to load sqlite3. Falling back to JSON file-based database.', err.message);
  isSQLite = false;
  // Create data directory for JSON files if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Initialize files with empty arrays if they don't exist
  Object.keys(JSON_FILES).forEach(key => {
    if (!fs.existsSync(JSON_FILES[key])) {
      fs.writeFileSync(JSON_FILES[key], JSON.stringify([], null, 2));
    }
  });
}

// ----------------------------------------------------
// SQLITE DATABASE SCHEMAS DEFINITION
// ----------------------------------------------------
if (isSQLite && sqliteDb) {
  sqliteDb.serialize(() => {
    // Users
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT
    )`);

    // Vehicles (Changed name -> model)
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS vehicles (
      registration_number TEXT PRIMARY KEY,
      model TEXT,
      type TEXT,
      max_load_capacity REAL,
      odometer REAL,
      acquisition_cost REAL,
      status TEXT DEFAULT 'Available',
      region TEXT
    )`);

    // Drivers
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      license_number TEXT,
      license_category TEXT,
      license_expiry_date TEXT,
      contact_number TEXT,
      safety_score REAL,
      status TEXT DEFAULT 'Available'
    )`);

    // Trips
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT,
      destination TEXT,
      vehicle_id TEXT,
      driver_id INTEGER,
      cargo_weight REAL,
      planned_distance REAL,
      odometer_start REAL,
      odometer_end REAL,
      fuel_consumed REAL,
      revenue REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      created_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(registration_number),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )`);

    // Maintenance Logs
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT,
      description TEXT,
      cost REAL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(registration_number)
    )`);

    // Fuel Logs (Added trip_id, logged_by)
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT,
      trip_id INTEGER,
      liters REAL,
      cost REAL,
      date TEXT,
      logged_by TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(registration_number),
      FOREIGN KEY (trip_id) REFERENCES trips(id)
    )`);

    // Expenses (Added trip_id, logged_by)
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT,
      trip_id INTEGER,
      type TEXT,
      cost REAL,
      date TEXT,
      description TEXT,
      logged_by TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(registration_number),
      FOREIGN KEY (trip_id) REFERENCES trips(id)
    )`);

    // Run migrations to ensure columns exist for existing databases
    sqliteDb.run("ALTER TABLE fuel_logs ADD COLUMN logged_by TEXT", (err) => {
      // Ignore error if column already exists
    });
    sqliteDb.run("ALTER TABLE expenses ADD COLUMN logged_by TEXT", (err) => {
      // Ignore error if column already exists
    });

    // Documents
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT,
      document_type TEXT,
      file_name TEXT,
      file_path TEXT,
      upload_date TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(registration_number)
    )`);
  });
}

// ----------------------------------------------------
// DATABASE ACCESS WRAPPERS (PROMISIFIED)
// ----------------------------------------------------

// Run query (INSERT/UPDATE/DELETE)
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isSQLite) {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    } else {
      reject(new Error('dbRun directly is not supported in JSON fallback mode. Use helper methods instead.'));
    }
  });
}

// Get all rows
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isSQLite) {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      reject(new Error('dbAll directly is not supported in JSON fallback mode. Use helper methods instead.'));
    }
  });
}

// Get single row
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isSQLite) {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    } else {
      reject(new Error('dbGet directly is not supported in JSON fallback mode. Use helper methods instead.'));
    }
  });
}

// ----------------------------------------------------
// JSON FALLBACK HELPERS
// ----------------------------------------------------
function readJSON(fileKey) {
  try {
    const filePath = JSON_FILES[fileKey];
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeJSON(fileKey, data) {
  const filePath = JSON_FILES[fileKey];
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ----------------------------------------------------
// UNIFIED DATA ACCESS OBJECT (DAO) EXPORTS
// ----------------------------------------------------
module.exports = {
  isSQLiteMode: () => isSQLite,

  // --- USERS ---
  getUsers: async () => {
    if (isSQLite) {
      return dbAll("SELECT * FROM users");
    } else {
      return readJSON('users');
    }
  },

  getUserByEmail: async (email) => {
    if (isSQLite) {
      return dbGet("SELECT * FROM users WHERE email = ?", [email]);
    } else {
      const users = readJSON('users');
      return users.find(u => u.email === email) || null;
    }
  },

  createUser: async (user) => {
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
        [user.email, user.password, user.name, user.role]
      );
      return { id: res.lastID, ...user };
    } else {
      const users = readJSON('users');
      const id = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      const newUser = { id, ...user };
      users.push(newUser);
      writeJSON('users', users);
      return newUser;
    }
  },

  // --- VEHICLES ---
  getVehicles: async () => {
    if (isSQLite) {
      return dbAll("SELECT registration_number, model, model AS name, type, max_load_capacity, odometer, acquisition_cost, status, region FROM vehicles");
    } else {
      const list = readJSON('vehicles');
      return list.map(v => ({ name: v.name || v.model, model: v.model || v.name, ...v }));
    }
  },

  getVehicleByRegNumber: async (regNumber) => {
    if (isSQLite) {
      return dbGet("SELECT registration_number, model, model AS name, type, max_load_capacity, odometer, acquisition_cost, status, region FROM vehicles WHERE registration_number = ?", [regNumber]);
    } else {
      const vehicles = readJSON('vehicles');
      const v = vehicles.find(veh => veh.registration_number === regNumber) || null;
      if (v) {
        return { name: v.name || v.model, model: v.model || v.name, ...v };
      }
      return null;
    }
  },

  createVehicle: async (vehicle) => {
    if (isSQLite) {
      await dbRun(
        "INSERT INTO vehicles (registration_number, model, type, max_load_capacity, odometer, acquisition_cost, status, region) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          vehicle.registration_number,
          vehicle.model || vehicle.name,
          vehicle.type,
          vehicle.max_load_capacity,
          vehicle.odometer,
          vehicle.acquisition_cost,
          vehicle.status || 'Available',
          vehicle.region
        ]
      );
      return { name: vehicle.name || vehicle.model, model: vehicle.model || vehicle.name, ...vehicle };
    } else {
      const vehicles = readJSON('vehicles');
      if (vehicles.some(v => v.registration_number === vehicle.registration_number)) {
        throw new Error('Vehicle registration number must be unique.');
      }
      const newVehicle = { 
        status: 'Available', 
        name: vehicle.name || vehicle.model, 
        model: vehicle.model || vehicle.name, 
        ...vehicle 
      };
      vehicles.push(newVehicle);
      writeJSON('vehicles', vehicles);
      return newVehicle;
    }
  },

  updateVehicle: async (regNumber, updates) => {
    const dbUpdates = { ...updates };
    if ('name' in dbUpdates) {
      dbUpdates.model = dbUpdates.name;
      delete dbUpdates.name;
    }
    if (isSQLite) {
      const keys = Object.keys(dbUpdates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(dbUpdates), regNumber];
      await dbRun(`UPDATE vehicles SET ${setClause} WHERE registration_number = ?`, values);
      return { registration_number: regNumber, ...updates };
    } else {
      const vehicles = readJSON('vehicles');
      const index = vehicles.findIndex(v => v.registration_number === regNumber);
      if (index === -1) throw new Error('Vehicle not found');
      vehicles[index] = { 
        ...vehicles[index], 
        ...updates,
        name: updates.name || updates.model || vehicles[index].name || vehicles[index].model,
        model: updates.model || updates.name || vehicles[index].model || vehicles[index].name
      };
      writeJSON('vehicles', vehicles);
      return vehicles[index];
    }
  },

  deleteVehicle: async (regNumber) => {
    if (isSQLite) {
      await dbRun("DELETE FROM vehicles WHERE registration_number = ?", [regNumber]);
      return { registration_number: regNumber };
    } else {
      let vehicles = readJSON('vehicles');
      vehicles = vehicles.filter(v => v.registration_number !== regNumber);
      writeJSON('vehicles', vehicles);
      return { registration_number: regNumber };
    }
  },

  // --- DRIVERS ---
  getDrivers: async () => {
    if (isSQLite) {
      return dbAll("SELECT * FROM drivers");
    } else {
      return readJSON('drivers');
    }
  },

  getDriverById: async (id) => {
    if (isSQLite) {
      return dbGet("SELECT * FROM drivers WHERE id = ?", [id]);
    } else {
      const drivers = readJSON('drivers');
      return drivers.find(d => d.id === parseInt(id)) || null;
    }
  },

  createDriver: async (driver) => {
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO drivers (name, license_number, license_category, license_expiry_date, contact_number, safety_score, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          driver.name,
          driver.license_number,
          driver.license_category,
          driver.license_expiry_date,
          driver.contact_number,
          driver.safety_score,
          driver.status || 'Available'
        ]
      );
      return { id: res.lastID, ...driver };
    } else {
      const drivers = readJSON('drivers');
      const id = drivers.length > 0 ? Math.max(...drivers.map(d => d.id)) + 1 : 1;
      const newDriver = { id, status: 'Available', ...driver };
      drivers.push(newDriver);
      writeJSON('drivers', drivers);
      return newDriver;
    }
  },

  updateDriver: async (id, updates) => {
    if (isSQLite) {
      const keys = Object.keys(updates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      await dbRun(`UPDATE drivers SET ${setClause} WHERE id = ?`, values);
      return { id, ...updates };
    } else {
      const drivers = readJSON('drivers');
      const index = drivers.findIndex(d => d.id === parseInt(id));
      if (index === -1) throw new Error('Driver not found');
      drivers[index] = { ...drivers[index], ...updates };
      writeJSON('drivers', drivers);
      return drivers[index];
    }
  },

  deleteDriver: async (id) => {
    if (isSQLite) {
      await dbRun("DELETE FROM drivers WHERE id = ?", [id]);
      return { id };
    } else {
      let drivers = readJSON('drivers');
      drivers = drivers.filter(d => d.id !== parseInt(id));
      writeJSON('drivers', drivers);
      return { id };
    }
  },

  // --- TRIPS ---
  getTrips: async () => {
    if (isSQLite) {
      return dbAll(`
        SELECT trips.*, vehicles.model as vehicle_name, drivers.name as driver_name 
        FROM trips
        LEFT JOIN vehicles ON trips.vehicle_id = vehicles.registration_number
        LEFT JOIN drivers ON trips.driver_id = drivers.id
        ORDER BY trips.id DESC
      `);
    } else {
      const trips = readJSON('trips');
      const vehicles = readJSON('vehicles');
      const drivers = readJSON('drivers');
      return trips.map(t => {
        const v = vehicles.find(veh => veh.registration_number === t.vehicle_id);
        const d = drivers.find(drv => drv.id === parseInt(t.driver_id));
        return {
          ...t,
          vehicle_name: v ? v.name : null,
          driver_name: d ? d.name : null
        };
      }).reverse();
    }
  },

  getTripById: async (id) => {
    if (isSQLite) {
      return dbGet("SELECT * FROM trips WHERE id = ?", [id]);
    } else {
      const trips = readJSON('trips');
      return trips.find(t => t.id === parseInt(id)) || null;
    }
  },

  createTrip: async (trip) => {
    const createdAt = new Date().toISOString().split('T')[0];
    if (isSQLite) {
      const res = await dbRun(
        `INSERT INTO trips (source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, odometer_start, odometer_end, fuel_consumed, revenue, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trip.source,
          trip.destination,
          trip.vehicle_id,
          trip.driver_id,
          trip.cargo_weight,
          trip.planned_distance,
          trip.odometer_start || 0,
          trip.odometer_end || null,
          trip.fuel_consumed || null,
          trip.revenue || 0,
          trip.status || 'Draft',
          createdAt
        ]
      );
      return { id: res.lastID, created_at: createdAt, ...trip };
    } else {
      const trips = readJSON('trips');
      const id = trips.length > 0 ? Math.max(...trips.map(t => t.id)) + 1 : 1;
      const newTrip = {
        id,
        odometer_start: trip.odometer_start || 0,
        odometer_end: trip.odometer_end || null,
        fuel_consumed: trip.fuel_consumed || null,
        revenue: trip.revenue || 0,
        status: trip.status || 'Draft',
        created_at: createdAt,
        ...trip
      };
      trips.push(newTrip);
      writeJSON('trips', trips);
      return newTrip;
    }
  },

  updateTrip: async (id, updates) => {
    if (isSQLite) {
      const keys = Object.keys(updates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      await dbRun(`UPDATE trips SET ${setClause} WHERE id = ?`, values);
      return { id, ...updates };
    } else {
      const trips = readJSON('trips');
      const index = trips.findIndex(t => t.id === parseInt(id));
      if (index === -1) throw new Error('Trip not found');
      trips[index] = { ...trips[index], ...updates };
      writeJSON('trips', trips);
      return trips[index];
    }
  },

  // --- MAINTENANCE LOGS ---
  getMaintenanceLogs: async () => {
    if (isSQLite) {
      return dbAll(`
        SELECT maintenance_logs.*, vehicles.model as vehicle_name 
        FROM maintenance_logs
        LEFT JOIN vehicles ON maintenance_logs.vehicle_id = vehicles.registration_number
        ORDER BY maintenance_logs.id DESC
      `);
    } else {
      const logs = readJSON('maintenance');
      const vehicles = readJSON('vehicles');
      return logs.map(l => {
        const v = vehicles.find(veh => veh.registration_number === l.vehicle_id);
        return {
          ...l,
          vehicle_name: v ? v.name : null
        };
      }).reverse();
    }
  },

  createMaintenanceLog: async (log) => {
    const startDate = log.start_date || new Date().toISOString().split('T')[0];
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO maintenance_logs (vehicle_id, description, cost, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)",
        [log.vehicle_id, log.description, log.cost || 0, startDate, log.end_date || null, log.status || 'Active']
      );
      return { id: res.lastID, start_date: startDate, ...log };
    } else {
      const logs = readJSON('maintenance');
      const id = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
      const newLog = {
        id,
        cost: log.cost || 0,
        start_date: startDate,
        end_date: log.end_date || null,
        status: log.status || 'Active',
        ...log
      };
      logs.push(newLog);
      writeJSON('maintenance', logs);
      return newLog;
    }
  },

  updateMaintenanceLog: async (id, updates) => {
    if (isSQLite) {
      const keys = Object.keys(updates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      await dbRun(`UPDATE maintenance_logs SET ${setClause} WHERE id = ?`, values);
      return { id, ...updates };
    } else {
      const logs = readJSON('maintenance');
      const index = logs.findIndex(l => l.id === parseInt(id));
      if (index === -1) throw new Error('Maintenance log not found');
      logs[index] = { ...logs[index], ...updates };
      writeJSON('maintenance', logs);
      return logs[index];
    }
  },

  // --- FUEL LOGS ---
  getFuelLogs: async () => {
    if (isSQLite) {
      return dbAll(`
        SELECT fuel_logs.*, vehicles.model as vehicle_name 
        FROM fuel_logs
        LEFT JOIN vehicles ON fuel_logs.vehicle_id = vehicles.registration_number
        ORDER BY fuel_logs.date DESC, fuel_logs.id DESC
      `);
    } else {
      const logs = readJSON('fuel');
      const vehicles = readJSON('vehicles');
      return logs.map(l => {
        const v = vehicles.find(veh => veh.registration_number === l.vehicle_id);
        return {
          ...l,
          vehicle_name: v ? v.name : null
        };
      }).reverse();
    }
  },

  createFuelLog: async (log) => {
    const logDate = log.date || new Date().toISOString().split('T')[0];
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO fuel_logs (vehicle_id, trip_id, liters, cost, date, logged_by) VALUES (?, ?, ?, ?, ?, ?)",
        [log.vehicle_id, log.trip_id || null, log.liters, log.cost, logDate, log.logged_by || null]
      );
      return { id: res.lastID, date: logDate, ...log };
    } else {
      const logs = readJSON('fuel');
      const id = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
      const newLog = {
        id,
        date: logDate,
        trip_id: log.trip_id || null,
        logged_by: log.logged_by || null,
        ...log
      };
      logs.push(newLog);
      writeJSON('fuel', logs);
      return newLog;
    }
  },

  // --- EXPENSES ---
  getExpenses: async () => {
    if (isSQLite) {
      return dbAll(`
        SELECT expenses.*, vehicles.model as vehicle_name 
        FROM expenses
        LEFT JOIN vehicles ON expenses.vehicle_id = vehicles.registration_number
        ORDER BY expenses.date DESC, expenses.id DESC
      `);
    } else {
      const expenses = readJSON('expenses');
      const vehicles = readJSON('vehicles');
      return expenses.map(e => {
        const v = vehicles.find(veh => veh.registration_number === e.vehicle_id);
        return {
          ...e,
          vehicle_name: v ? v.name : null
        };
      }).reverse();
    }
  },

  createExpense: async (expense) => {
    const expenseDate = expense.date || new Date().toISOString().split('T')[0];
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO expenses (vehicle_id, trip_id, type, cost, date, description, logged_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [expense.vehicle_id, expense.trip_id || null, expense.type, expense.cost, expenseDate, expense.description, expense.logged_by || null]
      );
      return { id: res.lastID, date: expenseDate, ...expense };
    } else {
      const expenses = readJSON('expenses');
      const id = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
      const newExpense = {
        id,
        date: expenseDate,
        trip_id: expense.trip_id || null,
        logged_by: expense.logged_by || null,
        ...expense
      };
      expenses.push(newExpense);
      writeJSON('expenses', expenses);
      return newExpense;
    }
  },

  // --- DOCUMENTS ---
  getDocuments: async (vehicleId = null) => {
    if (isSQLite) {
      if (vehicleId) {
        return dbAll("SELECT * FROM documents WHERE vehicle_id = ? ORDER BY id DESC", [vehicleId]);
      }
      return dbAll("SELECT * FROM documents ORDER BY id DESC");
    } else {
      const docs = readJSON('documents');
      if (vehicleId) {
        return docs.filter(d => d.vehicle_id === vehicleId).reverse();
      }
      return docs.reverse();
    }
  },

  createDocument: async (doc) => {
    const uploadDate = new Date().toISOString().split('T')[0];
    if (isSQLite) {
      const res = await dbRun(
        "INSERT INTO documents (vehicle_id, document_type, file_name, file_path, upload_date) VALUES (?, ?, ?, ?, ?)",
        [doc.vehicle_id, doc.document_type, doc.file_name, doc.file_path, uploadDate]
      );
      return { id: res.lastID, upload_date: uploadDate, ...doc };
    } else {
      const docs = readJSON('documents');
      const id = docs.length > 0 ? Math.max(...docs.map(d => d.id)) + 1 : 1;
      const newDoc = {
        id,
        upload_date: uploadDate,
        ...doc
      };
      docs.push(newDoc);
      writeJSON('documents', docs);
      return newDoc;
    }
  },

  getDocumentById: async (id) => {
    if (isSQLite) {
      return dbGet("SELECT * FROM documents WHERE id = ?", [id]);
    } else {
      const docs = readJSON('documents');
      return docs.find(d => d.id === parseInt(id)) || null;
    }
  },

  deleteDocument: async (id) => {
    if (isSQLite) {
      await dbRun("DELETE FROM documents WHERE id = ?", [id]);
      return { id };
    } else {
      let docs = readJSON('documents');
      docs = docs.filter(d => d.id !== parseInt(id));
      writeJSON('documents', docs);
      return { id };
    }
  }
};
