require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service role — bypasses RLS, backend-only
  { realtime: { transport: ws } }
);

console.log('TransitOps: Connected to Supabase PostgreSQL.');


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
async function getUsers() {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function createUser(user) {
  const { data, error } = await supabase
    .from('users').insert([user]).select().single();
  if (error) throw error;
  return data;
}

async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('users').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Increment fail count; if ≥5 freeze for 24h
async function recordFailedLogin(email) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const newCount = (user.fail_count || 0) + 1;
  const updates = { fail_count: newCount };
  if (newCount >= 5) {
    const frozenUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    updates.frozen_until = frozenUntil;
  }
  return updateUser(user.id, updates);
}

async function resetFailCount(id) {
  return updateUser(id, { fail_count: 0, frozen_until: null });
}

async function setRefreshToken(id, token) {
  return updateUser(id, { refresh_token: token });
}

async function clearRefreshToken(id) {
  return updateUser(id, { refresh_token: null });
}

// ─────────────────────────────────────────────
// OTP TOKENS
// ─────────────────────────────────────────────
async function createOTP(email, purpose) {
  // Invalidate any existing unused OTPs for this email+purpose
  await supabase.from('otp_tokens')
    .update({ used: true })
    .eq('email', email).eq('purpose', purpose).eq('used', false);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
  const { data, error } = await supabase
    .from('otp_tokens')
    .insert([{ email, otp_code: otp, purpose, expires_at: expiresAt }])
    .select().single();
  if (error) throw error;
  return otp; // return plaintext code to send in email
}

async function verifyOTP(email, code, purpose) {
  const { data, error } = await supabase
    .from('otp_tokens')
    .select('*')
    .eq('email', email)
    .eq('otp_code', code)
    .eq('purpose', purpose)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  // Mark as used
  await supabase.from('otp_tokens').update({ used: true }).eq('id', data.id);
  return true;
}

// ─────────────────────────────────────────────
// VEHICLES
// ─────────────────────────────────────────────
async function getVehicles(filters = {}) {
  let query = supabase.from('vehicles').select('*');
  if (filters.type)   query = query.ilike('type', filters.type);
  if (filters.status) query = query.ilike('status', filters.status);
  if (filters.region) query = query.ilike('region', filters.region);
  const { data, error } = await query.order('registration_number');
  if (error) throw error;
  // Alias model→name for frontend compatibility
  return (data || []).map(v => ({ ...v, name: v.model }));
}

async function getVehicleByRegNumber(regNumber) {
  const { data, error } = await supabase
    .from('vehicles').select('*').eq('registration_number', regNumber).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, name: data.model };
}

async function createVehicle(vehicle) {
  const row = {
    registration_number: vehicle.registration_number,
    model: vehicle.model || vehicle.name,
    type: vehicle.type,
    max_load_capacity: vehicle.max_load_capacity,
    odometer: vehicle.odometer,
    acquisition_cost: vehicle.acquisition_cost,
    status: vehicle.status || 'Available',
    region: vehicle.region
  };
  const { data, error } = await supabase.from('vehicles').insert([row]).select().single();
  if (error) throw error;
  return { ...data, name: data.model };
}

async function updateVehicle(regNumber, updates) {
  const dbUpdates = { ...updates };
  if ('name' in dbUpdates) { dbUpdates.model = dbUpdates.name; delete dbUpdates.name; }
  const { data, error } = await supabase
    .from('vehicles').update(dbUpdates).eq('registration_number', regNumber).select().single();
  if (error) throw error;
  return { ...data, name: data.model };
}

async function deleteVehicle(regNumber) {
  const { error } = await supabase.from('vehicles').delete().eq('registration_number', regNumber);
  if (error) throw error;
  return { registration_number: regNumber };
}

// ─────────────────────────────────────────────
// DRIVERS
// ─────────────────────────────────────────────
async function getDrivers() {
  const { data, error } = await supabase.from('drivers').select('*').order('id');
  if (error) throw error;
  return data || [];
}

async function getDriverById(id) {
  const { data, error } = await supabase
    .from('drivers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function createDriver(driver) {
  const row = {
    name: driver.name,
    license_number: driver.license_number,
    license_category: driver.license_category,
    license_expiry_date: driver.license_expiry_date,
    contact_number: driver.contact_number,
    safety_score: driver.safety_score,
    status: driver.status || 'Available'
  };
  const { data, error } = await supabase.from('drivers').insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function updateDriver(id, updates) {
  const { data, error } = await supabase
    .from('drivers').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteDriver(id) {
  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) throw error;
  return { id };
}

// ─────────────────────────────────────────────
// TRIPS
// ─────────────────────────────────────────────
async function getTrips() {
  const { data: trips, error: tErr } = await supabase
    .from('trips').select('*').order('id', { ascending: false });
  if (tErr) throw tErr;

  const { data: vehicles } = await supabase.from('vehicles').select('registration_number, model');
  const { data: drivers }  = await supabase.from('drivers').select('id, name');

  return (trips || []).map(t => {
    const v = (vehicles || []).find(v => v.registration_number === t.vehicle_id);
    const d = (drivers  || []).find(d => d.id === t.driver_id);
    return {
      ...t,
      vehicle_name: v ? v.model : null,
      driver_name:  d ? d.name  : null
    };
  });
}

async function getTripById(id) {
  const { data, error } = await supabase
    .from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function createTrip(trip) {
  const row = {
    source:           trip.source,
    destination:      trip.destination,
    vehicle_id:       trip.vehicle_id,
    driver_id:        trip.driver_id,
    cargo_weight:     trip.cargo_weight,
    planned_distance: trip.planned_distance,
    odometer_start:   trip.odometer_start || 0,
    odometer_end:     trip.odometer_end   || null,
    fuel_consumed:    trip.fuel_consumed  || null,
    revenue:          trip.revenue        || 0,
    status:           trip.status         || 'Draft',
    created_at:       todayStr()
  };
  const { data, error } = await supabase.from('trips').insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function updateTrip(id, updates) {
  const { data, error } = await supabase
    .from('trips').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// MAINTENANCE LOGS
// ─────────────────────────────────────────────
async function getMaintenanceLogs() {
  const { data: logs, error } = await supabase
    .from('maintenance_logs').select('*').order('id', { ascending: false });
  if (error) throw error;
  const { data: vehicles } = await supabase.from('vehicles').select('registration_number, model');
  return (logs || []).map(l => {
    const v = (vehicles || []).find(v => v.registration_number === l.vehicle_id);
    return { ...l, vehicle_name: v ? v.model : null };
  });
}

async function createMaintenanceLog(log) {
  const row = {
    vehicle_id:  log.vehicle_id,
    description: log.description,
    cost:        log.cost        || 0,
    start_date:  log.start_date  || todayStr(),
    end_date:    log.end_date    || null,
    status:      log.status      || 'Active'
  };
  const { data, error } = await supabase.from('maintenance_logs').insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function updateMaintenanceLog(id, updates) {
  const { data, error } = await supabase
    .from('maintenance_logs').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// FUEL LOGS
// ─────────────────────────────────────────────
async function getFuelLogs() {
  const { data: logs, error } = await supabase
    .from('fuel_logs').select('*').order('id', { ascending: false });
  if (error) throw error;
  const { data: vehicles } = await supabase.from('vehicles').select('registration_number, model');
  return (logs || []).map(l => {
    const v = (vehicles || []).find(v => v.registration_number === l.vehicle_id);
    return { ...l, vehicle_name: v ? v.model : null };
  });
}

async function createFuelLog(log) {
  const row = {
    vehicle_id: log.vehicle_id,
    trip_id:    log.trip_id || null,
    liters:     log.liters,
    cost:       log.cost,
    date:       log.date || todayStr()
  };
  const { data, error } = await supabase.from('fuel_logs').insert([row]).select().single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────
async function getExpenses() {
  const { data: exp, error } = await supabase
    .from('expenses').select('*').order('id', { ascending: false });
  if (error) throw error;
  const { data: vehicles } = await supabase.from('vehicles').select('registration_number, model');
  return (exp || []).map(e => {
    const v = (vehicles || []).find(v => v.registration_number === e.vehicle_id);
    return { ...e, vehicle_name: v ? v.model : null };
  });
}

async function createExpense(expense) {
  const row = {
    vehicle_id:  expense.vehicle_id,
    trip_id:     expense.trip_id     || null,
    type:        expense.type,
    cost:        expense.cost,
    date:        expense.date        || todayStr(),
    description: expense.description || ''
  };
  const { data, error } = await supabase.from('expenses').insert([row]).select().single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────
async function getDocuments(vehicleId = null) {
  let query = supabase.from('documents').select('*').order('id', { ascending: false });
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createDocument(doc) {
  const row = {
    vehicle_id:    doc.vehicle_id,
    document_type: doc.document_type,
    file_name:     doc.file_name,
    file_path:     doc.file_path,
    upload_date:   todayStr()
  };
  const { data, error } = await supabase.from('documents').insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function getDocumentById(id) {
  const { data, error } = await supabase
    .from('documents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
  return { id };
}

module.exports = {
  // Auth
  getUsers, getUserByEmail, getUserById, createUser, updateUser,
  recordFailedLogin, resetFailCount, setRefreshToken, clearRefreshToken,
  // OTP
  createOTP, verifyOTP,
  // Vehicles
  getVehicles, getVehicleByRegNumber, createVehicle, updateVehicle, deleteVehicle,
  // Drivers
  getDrivers, getDriverById, createDriver, updateDriver, deleteDriver,
  // Trips
  getTrips, getTripById, createTrip, updateTrip,
  // Maintenance
  getMaintenanceLogs, createMaintenanceLog, updateMaintenanceLog,
  // Fuel
  getFuelLogs, createFuelLog,
  // Expenses
  getExpenses, createExpense,
  // Documents
  getDocuments, createDocument, getDocumentById, deleteDocument,
};
