const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing of JSON/urlencoded bodies
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup file uploads directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${baseName}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ----------------------------------------------------
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL MIDDLEWARE
// ----------------------------------------------------
function authorize(roles = []) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    const userEmail = req.headers['x-user-email'];

    if (!userRole || !userEmail) {
      return res.status(401).json({ error: 'Unauthorized: Missing credentials.' });
    }

    if (roles.length && !roles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Access denied for role: ${userRole}. Requires one of: ${roles.join(', ')}` });
    }

    next();
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Authentication
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    // Omit password from output
    const { password: _, ...userInfo } = user;
    res.json(userInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Dashboard KPIs
app.get('/api/dashboard/kpis', async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    const drivers = await db.getDrivers();
    const trips = await db.getTrips();

    const activeVehicles = vehicles.filter(v => v.status === 'On Trip').length;
    const availableVehicles = vehicles.filter(v => v.status === 'Available').length;
    const inMaintenance = vehicles.filter(v => v.status === 'In Shop').length;
    const retiredVehicles = vehicles.filter(v => v.status === 'Retired').length;
    const totalActiveOrAvailVehicles = vehicles.filter(v => v.status !== 'Retired').length;

    const activeTrips = trips.filter(t => t.status === 'Dispatched').length;
    const pendingTrips = trips.filter(t => t.status === 'Draft').length;

    const driversOnDuty = drivers.filter(d => d.status === 'Available' || d.status === 'On Trip').length;

    const fleetUtilization = totalActiveOrAvailVehicles > 0 
      ? Math.round((activeVehicles / totalActiveOrAvailVehicles) * 100) 
      : 0;

    res.json({
      activeVehicles,
      availableVehicles,
      inMaintenance,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      fleetUtilization,
      totalVehicles: vehicles.length,
      retiredVehicles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Vehicles CRUD & Document Management
app.get('/api/vehicles', async (req, res) => {
  try {
    let list = await db.getVehicles();
    const { type, status, region } = req.query;

    if (type) list = list.filter(v => v.type.toLowerCase() === type.toLowerCase());
    if (status) list = list.filter(v => v.status.toLowerCase() === status.toLowerCase());
    if (region) list = list.filter(v => v.region.toLowerCase() === region.toLowerCase());

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', authorize(['fleet_manager']), async (req, res) => {
  const { registration_number, name, type, max_load_capacity, odometer, acquisition_cost, region } = req.body;
  if (!registration_number || !name || !type || !max_load_capacity || !odometer || !acquisition_cost || !region) {
    return res.status(400).json({ error: 'All vehicle fields are required.' });
  }

  try {
    const existing = await db.getVehicleByRegNumber(registration_number);
    if (existing) {
      return res.status(400).json({ error: `Vehicle registration number ${registration_number} already exists.` });
    }
    const newVehicle = await db.createVehicle({
      registration_number,
      name,
      type,
      max_load_capacity: parseFloat(max_load_capacity),
      odometer: parseFloat(odometer),
      acquisition_cost: parseFloat(acquisition_cost),
      region
    });
    res.status(201).json(newVehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:regNumber', authorize(['fleet_manager']), async (req, res) => {
  try {
    const regNumber = req.params.regNumber;
    const updates = req.body;
    const updated = await db.updateVehicle(regNumber, updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:regNumber', authorize(['fleet_manager']), async (req, res) => {
  try {
    const regNumber = req.params.regNumber;
    await db.deleteVehicle(regNumber);
    res.json({ message: `Vehicle ${regNumber} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicle Document Management
app.post('/api/vehicles/:regNumber/documents', authorize(['fleet_manager']), upload.single('document'), async (req, res) => {
  const { regNumber } = req.params;
  const { document_type } = req.body;

  if (!req.file || !document_type) {
    return res.status(400).json({ error: 'Document file and document_type are required.' });
  }

  try {
    const vehicle = await db.getVehicleByRegNumber(regNumber);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const doc = await db.createDocument({
      vehicle_id: regNumber,
      document_type,
      file_name: req.file.originalname,
      file_path: `/uploads/${req.file.filename}`
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:regNumber/documents', async (req, res) => {
  try {
    const docs = await db.getDocuments(req.params.regNumber);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:regNumber/documents/:docId', authorize(['fleet_manager']), async (req, res) => {
  const { regNumber, docId } = req.params;
  try {
    const doc = await db.getDocumentById(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const absolutePath = path.join(__dirname, '..', doc.file_path);
    fs.unlink(absolutePath, (err) => {
      if (err) console.error('Failed to delete file from disk:', err.message);
    });

    await db.deleteDocument(docId);
    res.json({ message: 'Document successfully deleted.', id: docId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Drivers CRUD
app.get('/api/drivers', async (req, res) => {
  try {
    const list = await db.getDrivers();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  const { name, license_number, license_category, license_expiry_date, contact_number, safety_score } = req.body;
  if (!name || !license_number || !license_category || !license_expiry_date || !contact_number) {
    return res.status(400).json({ error: 'Required driver fields are missing.' });
  }

  try {
    const newDriver = await db.createDriver({
      name,
      license_number,
      license_category,
      license_expiry_date,
      contact_number,
      safety_score: safety_score ? parseFloat(safety_score) : 100
    });
    res.status(201).json(newDriver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drivers/:id', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updated = await db.updateDriver(id, updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drivers/:id', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  try {
    const id = req.params.id;
    await db.deleteDriver(id);
    res.json({ message: `Driver deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers/:id/remind', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await db.getDriverById(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found.' });
    }

    const emailRecord = {
      id: Date.now(),
      driver_id: driver.id,
      driver_name: driver.name,
      recipient: `${driver.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@transitops.com`,
      subject: 'URGENT: Commercial Driver License Expiry Notification',
      body: `Hello ${driver.name},\n\nThis is an automated compliance reminder from TransitOps. Our records show that your driver license (${driver.license_number}) class ${driver.license_category} is expired or expiring soon (expiration date: ${driver.license_expiry_date}).\n\nPlease submit your renewed document to the Safety Officer immediately to ensure you remain active on our dispatch roster.\n\nBest regards,\nTransitOps Operations Team`,
      sent_at: new Date().toISOString()
    };

    const DATA_DIR = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const sentEmailsFile = path.join(DATA_DIR, 'sent_emails.json');
    let emailsList = [];
    if (fs.existsSync(sentEmailsFile)) {
      try {
        emailsList = JSON.parse(fs.readFileSync(sentEmailsFile, 'utf8'));
      } catch (e) {
        emailsList = [];
      }
    }
    emailsList.push(emailRecord);
    fs.writeFileSync(sentEmailsFile, JSON.stringify(emailsList, null, 2), 'utf8');

    res.json({ message: `Compliance reminder email sent successfully to ${emailRecord.recipient}.`, email: emailRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Trip Management
app.get('/api/trips', async (req, res) => {
  try {
    const list = await db.getTrips();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', authorize(['fleet_manager', 'driver']), async (req, res) => {
  const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, revenue } = req.body;

  if (!source || !destination || !vehicle_id || !driver_id || !cargo_weight || !planned_distance) {
    return res.status(400).json({ error: 'All trip parameters are required.' });
  }

  try {
    // Business Rule Checks
    const vehicle = await db.getVehicleByRegNumber(vehicle_id);
    if (!vehicle) return res.status(400).json({ error: 'Vehicle not found.' });
    
    // Rule: Retired or In Shop vehicles must never be assigned
    if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
      return res.status(400).json({ error: `Vehicle is currently ${vehicle.status} and cannot be dispatched.` });
    }
    // Rule: Vehicle already On Trip cannot be assigned
    if (vehicle.status === 'On Trip') {
      return res.status(400).json({ error: 'Vehicle is currently assigned to another active trip.' });
    }
    // Rule: Cargo weight must not exceed max load capacity
    if (parseFloat(cargo_weight) > vehicle.max_load_capacity) {
      return res.status(400).json({ error: `Cargo weight (${cargo_weight} kg) exceeds vehicle's maximum load capacity (${vehicle.max_load_capacity} kg).` });
    }

    const driver = await db.getDriverById(driver_id);
    if (!driver) return res.status(400).json({ error: 'Driver not found.' });

    // Rule: Driver already On Trip or Suspended/Off Duty
    if (driver.status === 'On Trip') {
      return res.status(400).json({ error: 'Driver is currently on another active trip.' });
    }
    if (driver.status === 'Suspended') {
      return res.status(400).json({ error: 'Driver is currently suspended and cannot be assigned.' });
    }

    // Rule: Driver license validity check
    const today = new Date().toISOString().split('T')[0];
    if (driver.license_expiry_date < today) {
      return res.status(400).json({ error: `Cannot assign driver: license expired on ${driver.license_expiry_date}.` });
    }

    // Create the trip in Draft status
    const newTrip = await db.createTrip({
      source,
      destination,
      vehicle_id,
      driver_id: parseInt(driver_id),
      cargo_weight: parseFloat(cargo_weight),
      planned_distance: parseFloat(planned_distance),
      odometer_start: vehicle.odometer,
      revenue: revenue ? parseFloat(revenue) : 0,
      status: 'Draft'
    });

    res.status(201).json(newTrip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dispatch Trip
app.put('/api/trips/:id/dispatch', authorize(['fleet_manager', 'driver']), async (req, res) => {
  const { id } = req.params;
  try {
    const trip = await db.getTripById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    if (trip.status !== 'Draft') {
      return res.status(400).json({ error: `Only Draft trips can be dispatched. Current status: ${trip.status}` });
    }

    const vehicle = await db.getVehicleByRegNumber(trip.vehicle_id);
    const driver = await db.getDriverById(trip.driver_id);

    // Final checks before actual dispatch
    if (vehicle.status !== 'Available') {
      return res.status(400).json({ error: `Vehicle is not Available. Current status: ${vehicle.status}` });
    }
    if (driver.status !== 'Available') {
      return res.status(400).json({ error: `Driver is not Available. Current status: ${driver.status}` });
    }

    // Update statuses
    await db.updateTrip(id, { status: 'Dispatched' });
    await db.updateVehicle(trip.vehicle_id, { status: 'On Trip' });
    await db.updateDriver(trip.driver_id, { status: 'On Trip' });

    res.json({ message: 'Trip successfully dispatched.', trip_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Trip
app.put('/api/trips/:id/complete', authorize(['fleet_manager', 'driver']), async (req, res) => {
  const { id } = req.params;
  const { odometer_end, fuel_consumed, fuel_cost } = req.body;

  if (!odometer_end || !fuel_consumed || !fuel_cost) {
    return res.status(400).json({ error: 'Odometer end value, fuel consumed, and fuel cost are required to complete trip.' });
  }

  try {
    const trip = await db.getTripById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    if (trip.status !== 'Dispatched') {
      return res.status(400).json({ error: `Only Dispatched trips can be completed. Current status: ${trip.status}` });
    }

    const odoEnd = parseFloat(odometer_end);
    const fuelVal = parseFloat(fuel_consumed);
    const fuelCostVal = parseFloat(fuel_cost);

    if (odoEnd < trip.odometer_start) {
      return res.status(400).json({ error: `Odometer end (${odoEnd}) cannot be less than odometer start (${trip.odometer_start}).` });
    }

    // Update Trip details
    await db.updateTrip(id, {
      status: 'Completed',
      odometer_end: odoEnd,
      fuel_consumed: fuelVal
    });

    // Restore vehicle status and update its odometer
    await db.updateVehicle(trip.vehicle_id, {
      status: 'Available',
      odometer: odoEnd
    });

    // Restore driver status
    await db.updateDriver(trip.driver_id, {
      status: 'Available'
    });

    // Automatically record Fuel Log entry
    await db.createFuelLog({
      vehicle_id: trip.vehicle_id,
      liters: fuelVal,
      cost: fuelCostVal,
      date: new Date().toISOString().split('T')[0]
    });

    res.json({ message: 'Trip completed, vehicle and driver statuses restored. Fuel log generated.', trip_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel Trip
app.put('/api/trips/:id/cancel', authorize(['fleet_manager', 'driver']), async (req, res) => {
  const { id } = req.params;
  try {
    const trip = await db.getTripById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    if (trip.status === 'Completed' || trip.status === 'Cancelled') {
      return res.status(400).json({ error: `Cannot cancel trip in ${trip.status} status.` });
    }

    // Restore vehicle/driver to Available if trip was Dispatched
    if (trip.status === 'Dispatched') {
      await db.updateVehicle(trip.vehicle_id, { status: 'Available' });
      await db.updateDriver(trip.driver_id, { status: 'Available' });
    }

    await db.updateTrip(id, { status: 'Cancelled' });

    res.json({ message: 'Trip successfully cancelled.', trip_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Maintenance Logs
app.get('/api/maintenance', async (req, res) => {
  try {
    const list = await db.getMaintenanceLogs();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maintenance', authorize(['fleet_manager']), async (req, res) => {
  const { vehicle_id, description } = req.body;
  if (!vehicle_id || !description) {
    return res.status(400).json({ error: 'Vehicle ID and description are required.' });
  }

  try {
    const vehicle = await db.getVehicleByRegNumber(vehicle_id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });

    // Put vehicle in shop
    await db.updateVehicle(vehicle_id, { status: 'In Shop' });

    const log = await db.createMaintenanceLog({
      vehicle_id,
      description,
      status: 'Active'
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/maintenance/:id/close', authorize(['fleet_manager']), async (req, res) => {
  const { id } = req.params;
  const { cost, end_date } = req.body;

  if (!cost || !end_date) {
    return res.status(400).json({ error: 'Maintenance cost and end date are required to close.' });
  }

  try {
    const logs = await db.getMaintenanceLogs();
    const log = logs.find(l => l.id === parseInt(id));
    if (!log) return res.status(404).json({ error: 'Maintenance log not found.' });

    if (log.status !== 'Active') {
      return res.status(400).json({ error: 'Maintenance log is already closed.' });
    }

    // Close log
    await db.updateMaintenanceLog(id, {
      status: 'Closed',
      cost: parseFloat(cost),
      end_date
    });

    // Check if vehicle is retired, if not, restore status to Available
    const vehicle = await db.getVehicleByRegNumber(log.vehicle_id);
    if (vehicle && vehicle.status !== 'Retired') {
      await db.updateVehicle(log.vehicle_id, { status: 'Available' });
    }

    // Create a matching Expense entry automatically
    await db.createExpense({
      vehicle_id: log.vehicle_id,
      type: 'Maintenance',
      cost: parseFloat(cost),
      date: end_date,
      description: `Auto-logged: ${log.description}`
    });

    res.json({ message: 'Maintenance log closed, vehicle status updated, and operational expense logged.', log_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Fuel Logs API
app.get('/api/fuel', async (req, res) => {
  try {
    const list = await db.getFuelLogs();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fuel', authorize(['fleet_manager', 'driver']), async (req, res) => {
  const { vehicle_id, liters, cost, date } = req.body;
  if (!vehicle_id || !liters || !cost || !date) {
    return res.status(400).json({ error: 'All fuel logging fields are required.' });
  }

  try {
    const log = await db.createFuelLog({
      vehicle_id,
      liters: parseFloat(liters),
      cost: parseFloat(cost),
      date
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Expenses API
app.get('/api/expenses', async (req, res) => {
  try {
    const list = await db.getExpenses();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', authorize(['fleet_manager', 'financial_analyst']), async (req, res) => {
  const { vehicle_id, type, cost, date, description } = req.body;
  if (!vehicle_id || !type || !cost || !date || !description) {
    return res.status(400).json({ error: 'All expense logging fields are required.' });
  }

  try {
    const expense = await db.createExpense({
      vehicle_id,
      type,
      cost: parseFloat(cost),
      date,
      description
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reports & Analytics API
app.get('/api/reports/analytics', async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    const trips = await db.getTrips();
    const fuelLogs = await db.getFuelLogs();
    const expenses = await db.getExpenses();

    const reportData = vehicles.map(v => {
      // Completed trips for this vehicle
      const vTrips = trips.filter(t => t.vehicle_id === v.registration_number && t.status === 'Completed');
      const totalDistance = vTrips.reduce((acc, t) => acc + (t.odometer_end - t.odometer_start), 0);
      const totalFuelConsumed = vTrips.reduce((acc, t) => acc + (t.fuel_consumed || 0), 0);
      const totalRevenue = vTrips.reduce((acc, t) => acc + (t.revenue || 0), 0);

      // Fuel efficiency
      const fuelEfficiency = totalFuelConsumed > 0 
        ? parseFloat((totalDistance / totalFuelConsumed).toFixed(2)) 
        : 0;

      // Expenses breakdown
      const vFuelLogs = fuelLogs.filter(f => f.vehicle_id === v.registration_number);
      const totalFuelCost = vFuelLogs.reduce((acc, f) => acc + f.cost, 0);

      const vExpenses = expenses.filter(e => e.vehicle_id === v.registration_number);
      const maintenanceCosts = vExpenses.filter(e => e.type === 'Maintenance').reduce((acc, e) => acc + e.cost, 0);
      const otherExpenses = vExpenses.filter(e => e.type !== 'Maintenance').reduce((acc, e) => acc + e.cost, 0);

      const totalOpsCost = totalFuelCost + maintenanceCosts + otherExpenses;

      // ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost
      const roi = v.acquisition_cost > 0 
        ? (totalRevenue - (maintenanceCosts + totalFuelCost)) / v.acquisition_cost
        : 0;
        
      const extendedRoiVal = v.acquisition_cost > 0 
        ? ((totalRevenue - totalOpsCost) / v.acquisition_cost) * 100
        : 0;
      const extended_roi = parseFloat(extendedRoiVal.toFixed(2));

      return {
        registration_number: v.registration_number,
        name: v.name,
        type: v.type,
        acquisition_cost: v.acquisition_cost,
        total_distance: totalDistance,
        total_fuel_consumed: totalFuelConsumed,
        fuel_efficiency: fuelEfficiency,
        total_revenue: totalRevenue,
        fuel_costs: totalFuelCost,
        maintenance_costs: maintenanceCosts,
        other_costs: otherExpenses,
        total_ops_cost: totalOpsCost,
        roi,
        extended_roi
      };
    });

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`TransitOps: Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to access the app.`);
});
