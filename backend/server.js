require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const jwt       = require('jsonwebtoken');
const db        = require('./db_pg');
const authRouter = require('./auth');
const { sendComplianceReminder } = require('./mailer');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload config
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ─────────────────────────────────────────────
// JWT MIDDLEWARE
// ─────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token.' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email, role, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid.' });
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Forbidden: Role '${req.user.role}' is not permitted. Requires: ${roles.join(', ')}`
        });
      }
      next();
    });
  };
}

// ─────────────────────────────────────────────
// AUTH ROUTES (public — no token needed)
// ─────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ─────────────────────────────────────────────
// 1. Dashboard KPIs
// ─────────────────────────────────────────────
app.get('/api/dashboard/kpis', authenticate, async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    const drivers  = await db.getDrivers();
    const trips    = await db.getTrips();

    const activeVehicles   = vehicles.filter(v => v.status === 'On Trip').length;
    const availableVehicles= vehicles.filter(v => v.status === 'Available').length;
    const inMaintenance    = vehicles.filter(v => v.status === 'In Shop').length;
    const retiredVehicles  = vehicles.filter(v => v.status === 'Retired').length;
    const totalActiveOrAvail = vehicles.filter(v => v.status !== 'Retired').length;
    const activeTrips      = trips.filter(t => t.status === 'Dispatched').length;
    const pendingTrips     = trips.filter(t => t.status === 'Draft').length;
    const driversOnDuty    = drivers.filter(d => d.status === 'Available' || d.status === 'On Trip').length;
    const fleetUtilization = totalActiveOrAvail > 0
      ? Math.round((activeVehicles / totalActiveOrAvail) * 100) : 0;

    res.json({ activeVehicles, availableVehicles, inMaintenance, activeTrips,
               pendingTrips, driversOnDuty, fleetUtilization,
               totalVehicles: vehicles.length, retiredVehicles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 2. Vehicles
// ─────────────────────────────────────────────
app.get('/api/vehicles', authenticate, async (req, res) => {
  try {
    const list = await db.getVehicles(req.query);
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vehicles', authorize(['fleet_manager']), async (req, res) => {
  const { registration_number, name, model, type, max_load_capacity, odometer, acquisition_cost, region } = req.body;
  const vehicleName = model || name;
  if (!registration_number || !vehicleName || !type || !max_load_capacity || !odometer || !acquisition_cost || !region)
    return res.status(400).json({ error: 'All vehicle fields are required.' });
  try {
    const existing = await db.getVehicleByRegNumber(registration_number);
    if (existing) return res.status(400).json({ error: `Registration ${registration_number} already exists.` });
    const v = await db.createVehicle({ registration_number, model: vehicleName, name: vehicleName, type,
      max_load_capacity: parseFloat(max_load_capacity), odometer: parseFloat(odometer),
      acquisition_cost: parseFloat(acquisition_cost), region });
    res.status(201).json(v);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/vehicles/:regNumber', authorize(['fleet_manager']), async (req, res) => {
  try {
    const v = await db.updateVehicle(req.params.regNumber, req.body);
    res.json(v);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vehicles/:regNumber', authorize(['fleet_manager']), async (req, res) => {
  try {
    await db.deleteVehicle(req.params.regNumber);
    res.json({ message: `Vehicle ${req.params.regNumber} deleted.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Vehicle Documents
app.post('/api/vehicles/:regNumber/documents', authorize(['fleet_manager']), upload.single('document'), async (req, res) => {
  const { regNumber } = req.params;
  const { document_type } = req.body;
  if (!req.file || !document_type)
    return res.status(400).json({ error: 'Document file and document_type are required.' });
  try {
    const vehicle = await db.getVehicleByRegNumber(regNumber);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });
    const doc = await db.createDocument({ vehicle_id: regNumber, document_type,
      file_name: req.file.originalname, file_path: `/uploads/${req.file.filename}` });
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vehicles/:regNumber/documents', authenticate, async (req, res) => {
  try {
    res.json(await db.getDocuments(req.params.regNumber));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vehicles/:regNumber/documents/:docId', authorize(['fleet_manager']), async (req, res) => {
  try {
    const doc = await db.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    const absPath = path.join(__dirname, '..', doc.file_path);
    fs.unlink(absPath, err => { if (err) console.error('File delete:', err.message); });
    await db.deleteDocument(req.params.docId);
    res.json({ message: 'Document deleted.', id: req.params.docId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 3. Drivers
// ─────────────────────────────────────────────
app.get('/api/drivers', authenticate, async (req, res) => {
  try { res.json(await db.getDrivers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/drivers', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  const { name, license_number, license_category, license_expiry_date, contact_number, safety_score } = req.body;
  if (!name || !license_number || !license_category || !license_expiry_date || !contact_number)
    return res.status(400).json({ error: 'Required driver fields are missing.' });
  try {
    const d = await db.createDriver({ name, license_number, license_category,
      license_expiry_date, contact_number, safety_score: safety_score ? parseFloat(safety_score) : 100 });
    res.status(201).json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/drivers/:id', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  try { res.json(await db.updateDriver(req.params.id, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/drivers/:id', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  try { await db.deleteDriver(req.params.id); res.json({ message: 'Driver deleted.' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Driver Compliance Email
app.post('/api/drivers/:id/remind', authorize(['fleet_manager', 'safety_officer']), async (req, res) => {
  try {
    const driver = await db.getDriverById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });

    const toEmail = `${driver.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@transitops.com`;
    try {
      await sendComplianceReminder(toEmail, driver.name, driver.license_number,
        driver.license_category, driver.license_expiry_date);
    } catch (mailErr) {
      console.error('Compliance email error (non-fatal):', mailErr.message);
    }
    res.json({ message: `Compliance reminder sent to ${toEmail}.`, recipient: toEmail });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 4. Trips
// ─────────────────────────────────────────────
app.get('/api/trips', authenticate, async (req, res) => {
  try { res.json(await db.getTrips()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/trips', authorize(['fleet_manager', 'driver', 'dispatcher']), async (req, res) => {
  const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, revenue } = req.body;
  if (!source || !destination || !vehicle_id || !driver_id || !cargo_weight || !planned_distance)
    return res.status(400).json({ error: 'All trip parameters are required.' });
  try {
    const vehicle = await db.getVehicleByRegNumber(vehicle_id);
    if (!vehicle) return res.status(400).json({ error: 'Vehicle not found.' });
    if (vehicle.status === 'Retired' || vehicle.status === 'In Shop')
      return res.status(400).json({ error: `Vehicle is ${vehicle.status} and cannot be dispatched.` });
    if (vehicle.status === 'On Trip')
      return res.status(400).json({ error: 'Vehicle is on another active trip.' });
    if (parseFloat(cargo_weight) > vehicle.max_load_capacity)
      return res.status(400).json({ error: `Cargo (${cargo_weight} kg) exceeds capacity (${vehicle.max_load_capacity} kg).` });

    const driver = await db.getDriverById(driver_id);
    if (!driver) return res.status(400).json({ error: 'Driver not found.' });
    if (driver.status === 'On Trip') return res.status(400).json({ error: 'Driver is on another trip.' });
    if (driver.status === 'Suspended') return res.status(400).json({ error: 'Driver is suspended.' });

    const today = new Date().toISOString().split('T')[0];
    if (driver.license_expiry_date < today)
      return res.status(400).json({ error: `Driver license expired on ${driver.license_expiry_date}.` });

    const trip = await db.createTrip({ source, destination, vehicle_id, driver_id: parseInt(driver_id),
      cargo_weight: parseFloat(cargo_weight), planned_distance: parseFloat(planned_distance),
      odometer_start: vehicle.odometer, revenue: revenue ? parseFloat(revenue) : 0, status: 'Draft' });
    res.status(201).json(trip);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/trips/:id/dispatch', authorize(['fleet_manager', 'driver', 'dispatcher']), async (req, res) => {
  try {
    const trip = await db.getTripById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    if (trip.status !== 'Draft')
      return res.status(400).json({ error: `Only Draft trips can be dispatched.` });
    const vehicle = await db.getVehicleByRegNumber(trip.vehicle_id);
    const driver  = await db.getDriverById(trip.driver_id);
    if (vehicle.status !== 'Available')
      return res.status(400).json({ error: `Vehicle is not Available (${vehicle.status}).` });
    if (driver.status !== 'Available')
      return res.status(400).json({ error: `Driver is not Available (${driver.status}).` });
    await db.updateTrip(req.params.id, { status: 'Dispatched' });
    await db.updateVehicle(trip.vehicle_id, { status: 'On Trip' });
    await db.updateDriver(trip.driver_id,  { status: 'On Trip' });
    res.json({ message: 'Trip dispatched.', trip_id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/trips/:id/complete', authorize(['fleet_manager', 'driver', 'dispatcher']), async (req, res) => {
  const { odometer_end, fuel_consumed, fuel_cost } = req.body;
  if (!odometer_end || !fuel_consumed || !fuel_cost)
    return res.status(400).json({ error: 'Odometer end, fuel consumed, and fuel cost are required.' });
  try {
    const trip = await db.getTripById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    if (trip.status !== 'Dispatched')
      return res.status(400).json({ error: 'Only Dispatched trips can be completed.' });
    const odoEnd = parseFloat(odometer_end);
    if (odoEnd < trip.odometer_start)
      return res.status(400).json({ error: `Odometer end cannot be less than start (${trip.odometer_start}).` });
    await db.updateTrip(req.params.id, { status: 'Completed', odometer_end: odoEnd, fuel_consumed: parseFloat(fuel_consumed) });
    await db.updateVehicle(trip.vehicle_id, { status: 'Available', odometer: odoEnd });
    await db.updateDriver(trip.driver_id,  { status: 'Available' });
    await db.createFuelLog({ vehicle_id: trip.vehicle_id, trip_id: trip.id,
      liters: parseFloat(fuel_consumed), cost: parseFloat(fuel_cost),
      date: new Date().toISOString().split('T')[0] });
    res.json({ message: 'Trip completed, vehicle and driver statuses restored. Fuel log generated.', trip_id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/trips/:id/cancel', authorize(['fleet_manager', 'driver', 'dispatcher']), async (req, res) => {
  try {
    const trip = await db.getTripById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    if (trip.status === 'Completed' || trip.status === 'Cancelled') {
      return res.status(400).json({ error: `Cannot cancel trip in ${trip.status} status.` });
    }

    const user = await db.getUserByEmail(req.user.email);
    let roleDisplay = 'unknown';
    if (user) {
      if (user.role === 'fleet_manager' || user.role === 'dispatcher' || user.email === 'driver@transitops.com') {
        roleDisplay = 'dispatcher';
      } else if (user.role === 'driver') {
        roleDisplay = 'driver';
      } else {
        roleDisplay = user.role;
      }
    }

    let driverInfo = '';
    if (user && user.role === 'driver' && user.email !== 'driver@transitops.com') {
      const driversList = await db.getDrivers();
      const cleanUserName = user.name.replace(/\s*\(Driver\)/i, '').toLowerCase().trim();
      const matchingDriver = driversList.find(d => 
        cleanUserName.includes(d.name.toLowerCase()) || 
        d.name.toLowerCase().includes(cleanUserName)
      );
      if (matchingDriver) {
        driverInfo = ` / Driver ID: ${matchingDriver.id}`;
      }
    }

    const noteName = user ? user.name : 'Unknown User';
    const noteId = user ? user.id : 'N/A';
    const cancellation_note = `Cancelled by ${roleDisplay} (User ID: ${noteId}${driverInfo}, Name: ${noteName})`;

    // Restore vehicle/driver to Available if trip was Dispatched
    if (trip.status === 'Dispatched') {
      await db.updateVehicle(trip.vehicle_id, { status: 'Available' });
      await db.updateDriver(trip.driver_id,   { status: 'Available' });
    }

    await db.updateTrip(req.params.id, { status: 'Cancelled', cancellation_note });

    res.json({ message: 'Trip successfully cancelled.', trip_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────
// 5. Maintenance Logs
// ─────────────────────────────────────────────
app.get('/api/maintenance', authenticate, async (req, res) => {
  try { res.json(await db.getMaintenanceLogs()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/maintenance', authorize(['fleet_manager']), async (req, res) => {
  const { vehicle_id, description } = req.body;
  if (!vehicle_id || !description)
    return res.status(400).json({ error: 'Vehicle ID and description are required.' });
  try {
    const vehicle = await db.getVehicleByRegNumber(vehicle_id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });
    await db.updateVehicle(vehicle_id, { status: 'In Shop' });
    const log = await db.createMaintenanceLog({ vehicle_id, description, status: 'Active' });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/maintenance/:id/close', authorize(['fleet_manager']), async (req, res) => {
  const { cost, end_date } = req.body;
  if (!cost || !end_date)
    return res.status(400).json({ error: 'Cost and end date are required.' });
  try {
    const logs = await db.getMaintenanceLogs();
    const log  = logs.find(l => l.id === parseInt(req.params.id));
    if (!log) return res.status(404).json({ error: 'Maintenance log not found.' });
    if (log.status !== 'Active')
      return res.status(400).json({ error: 'Log is already closed.' });
    await db.updateMaintenanceLog(req.params.id, { status: 'Closed', cost: parseFloat(cost), end_date });
    const vehicle = await db.getVehicleByRegNumber(log.vehicle_id);
    if (vehicle && vehicle.status !== 'Retired')
      await db.updateVehicle(log.vehicle_id, { status: 'Available' });
    await db.createExpense({ vehicle_id: log.vehicle_id, type: 'Maintenance',
      cost: parseFloat(cost), date: end_date, description: `Auto-logged: ${log.description}` });
    res.json({ message: 'Maintenance log closed, vehicle restored, expense logged.', log_id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 6. Fuel Logs
// ─────────────────────────────────────────────
app.get('/api/fuel', authenticate, async (req, res) => {
  try { res.json(await db.getFuelLogs()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fuel', authorize(['fleet_manager', 'driver', 'dispatcher']), async (req, res) => {
  const { vehicle_id, trip_id, liters, cost, date } = req.body;
  if (!vehicle_id || !liters || !cost || !date)
    return res.status(400).json({ error: 'All fuel logging fields are required.' });
  try {
    const log = await db.createFuelLog({ vehicle_id, trip_id: trip_id ? parseInt(trip_id) : null,
      liters: parseFloat(liters), cost: parseFloat(cost), date });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 7. Expenses
// ─────────────────────────────────────────────
app.get('/api/expenses', authenticate, async (req, res) => {
  try { res.json(await db.getExpenses()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/expenses', authorize(['fleet_manager', 'financial_analyst', 'driver', 'dispatcher']), async (req, res) => {
  const { vehicle_id, trip_id, type, cost, date, description } = req.body;
  if (!vehicle_id || !type || !cost || !date || !description)
    return res.status(400).json({ error: 'All expense fields are required.' });
  try {
    const exp = await db.createExpense({ vehicle_id, trip_id: trip_id ? parseInt(trip_id) : null,
      type, cost: parseFloat(cost), date, description });
    res.status(201).json(exp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// 8. Reports & Analytics
// ─────────────────────────────────────────────
app.get('/api/reports/analytics', authenticate, async (req, res) => {
  try {
    const [vehicles, trips, fuelLogs, expenses] = await Promise.all([
      db.getVehicles(), db.getTrips(), db.getFuelLogs(), db.getExpenses()
    ]);
    const reportData = vehicles.map(v => {
      const vTrips = trips.filter(t => t.vehicle_id === v.registration_number && t.status === 'Completed');
      const totalDistance     = vTrips.reduce((a, t) => a + ((t.odometer_end || 0) - (t.odometer_start || 0)), 0);
      const totalFuelConsumed = vTrips.reduce((a, t) => a + (t.fuel_consumed || 0), 0);
      const totalRevenue      = vTrips.reduce((a, t) => a + (t.revenue || 0), 0);
      const fuelEfficiency    = totalFuelConsumed > 0 ? parseFloat((totalDistance / totalFuelConsumed).toFixed(2)) : 0;
      const vFuelLogs         = fuelLogs.filter(f => f.vehicle_id === v.registration_number);
      const totalFuelCost     = vFuelLogs.reduce((a, f) => a + f.cost, 0);
      const vExpenses         = expenses.filter(e => e.vehicle_id === v.registration_number);
      const maintenanceCosts  = vExpenses.filter(e => e.type === 'Maintenance').reduce((a, e) => a + e.cost, 0);
      const otherExpenses     = vExpenses.filter(e => e.type !== 'Maintenance').reduce((a, e) => a + e.cost, 0);
      const totalOpsCost      = totalFuelCost + maintenanceCosts + otherExpenses;
      const roi         = v.acquisition_cost > 0 ? (totalRevenue - (maintenanceCosts + totalFuelCost)) / v.acquisition_cost : 0;
      const extended_roi= v.acquisition_cost > 0 ? parseFloat(((totalRevenue - totalOpsCost) / v.acquisition_cost * 100).toFixed(2)) : 0;
      return {
        registration_number: v.registration_number, name: v.name, type: v.type,
        acquisition_cost: v.acquisition_cost, total_distance: totalDistance,
        total_fuel_consumed: totalFuelConsumed, fuel_efficiency: fuelEfficiency,
        total_revenue: totalRevenue, fuel_costs: totalFuelCost,
        maintenance_costs: maintenanceCosts, other_costs: otherExpenses,
        total_ops_cost: totalOpsCost, roi, extended_roi
      };
    });
    res.json(reportData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// Start Server / Export for Vercel
// ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  app.listen(PORT, () => {
    console.log(`TransitOps: Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
  });
}

module.exports = app;
