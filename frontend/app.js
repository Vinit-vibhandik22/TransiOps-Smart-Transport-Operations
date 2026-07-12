// ==========================================================================
// TransitOps Frontend Core Logic
// ==========================================================================

const API_BASE = 'http://localhost:5000/api';

// Global Application State
const state = {
  currentUser: null,
  activeView: 'dashboard',
  vehicles: [],
  drivers: [],
  trips: [],
  maintenance: [],
  fuelLogs: [],
  expenses: [],
  reports: [],
  // Chart instances
  charts: {
    fleetStatus: null,
    opsCosts: null
  }
};

// ----------------------------------------------------
// INITIALIZATION & LOGIN
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  // Check if session is stored
  const storedUser = localStorage.getItem('transitops_user');
  if (storedUser) {
    state.currentUser = JSON.parse(storedUser);
    showAppLayout();
    navigateTo('dashboard');
  } else {
    showLoginLayout();
  }
  
  // Theme initialization
  const storedTheme = localStorage.getItem('transitops_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);
  
  // Initialize Lucide Icons
  lucide.createIcons();
}

function showLoginLayout() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

function showAppLayout() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'grid';
  
  // Render user profile info
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-badge');
  const initialsEl = document.getElementById('user-initials');
  
  nameEl.textContent = state.currentUser.name;
  
  // Set role class and badge text
  roleEl.className = 'role-badge';
  if (state.currentUser.role === 'fleet_manager') {
    roleEl.textContent = 'Fleet Manager';
    roleEl.classList.add('manager');
  } else if (state.currentUser.role === 'driver') {
    roleEl.textContent = 'Driver';
    roleEl.classList.add('driver');
  } else if (state.currentUser.role === 'safety_officer') {
    roleEl.textContent = 'Safety Officer';
    roleEl.classList.add('safety');
  } else if (state.currentUser.role === 'financial_analyst') {
    roleEl.textContent = 'Financial Analyst';
    roleEl.classList.add('finance');
  }
  
  // Get initials
  const initials = state.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  initialsEl.textContent = initials;
  
  // Apply role restriction visuals
  applyRolePermissions();
}

function applyRolePermissions() {
  const role = state.currentUser.role;
  
  // Rules for role permissions visibility:
  // 1. Vehicles: Fleet Manager only can Add, Edit, Delete, Upload Docs
  const managerOnlyButtons = document.querySelectorAll('.action-restricted-manager');
  managerOnlyButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager') ? 'inline-flex' : 'none';
  });

  // 2. Drivers: Manager and Safety Officer can Add, Edit, Delete drivers
  const managerSafetyButtons = document.querySelectorAll('.action-restricted-manager-safety');
  managerSafetyButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'safety_officer') ? 'inline-flex' : 'none';
  });

  // 3. Trips: Driver and Manager can Create Trips, Dispatch, Cancel, Complete
  const managerDriverButtons = document.querySelectorAll('.action-restricted-manager-driver');
  managerDriverButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'driver') ? 'inline-flex' : 'none';
  });

  // 4. Expenses: Financial Analyst and Fleet Manager can Log Expense
  const managerFinanceButtons = document.querySelectorAll('.action-restricted-manager-finance');
  managerFinanceButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'financial_analyst') ? 'inline-flex' : 'none';
  });
}

// ----------------------------------------------------
// EVENT LISTENERS SETUP
// ----------------------------------------------------
function setupEventListeners() {
  // Login Form Submission
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to authenticate');
      
      state.currentUser = data;
      localStorage.setItem('transitops_user', JSON.stringify(data));
      showAppLayout();
      navigateTo('dashboard');
    } catch (err) {
      alert(`Login Error: ${err.message}`);
    }
  });
  
  // Quick Login Demo Buttons
  const quickLoginButtons = document.querySelectorAll('.quick-login-btn');
  quickLoginButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = 'password123';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    });
  });
  
  // Logout Button
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('transitops_user');
    state.currentUser = null;
    showLoginLayout();
  });
  
  // Theme Toggle (Dark/Light)
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('transitops_theme', newTheme);
  });
  
  // Sidebar Navigation Links
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const view = item.getAttribute('data-view');
      navigateTo(view);
    });
  });

  // Top Notification bar Close button
  document.querySelector('.btn-close-notification').addEventListener('click', () => {
    document.getElementById('notification-bar').style.display = 'none';
  });

  // --- FILTERS & INTERACTIVITY ---
  // Dashboard Filters
  document.getElementById('db-filter-type').addEventListener('change', () => loadDashboardData());
  document.getElementById('db-filter-region').addEventListener('change', () => loadDashboardData());
  document.getElementById('db-reset-filters').addEventListener('click', () => {
    document.getElementById('db-filter-type').value = '';
    document.getElementById('db-filter-region').value = '';
    loadDashboardData();
  });

  // --- MODAL TRIGGERS ---
  // Modal close buttons (cancel / x)
  const closeButtons = document.querySelectorAll('.btn-close-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
    });
  });

  // Add Vehicle modal trigger
  document.getElementById('btn-add-vehicle').addEventListener('click', () => {
    openModal('modal-vehicle');
  });

  // Add Driver modal trigger
  document.getElementById('btn-add-driver').addEventListener('click', () => {
    document.getElementById('driver-edit-id').value = '';
    document.getElementById('form-driver').reset();
    document.getElementById('driver-status-group').style.display = 'none';
    document.querySelector('#modal-driver h2').textContent = 'Register New Driver';
    openModal('modal-driver');
  });

  // Create Trip modal trigger
  document.getElementById('btn-create-trip').addEventListener('click', () => {
    setupTripFormDropdowns();
    openModal('modal-trip');
  });

  // Trip Form vehicle capacity dynamic hint & validation
  document.getElementById('trip-vehicle').addEventListener('change', (e) => {
    const regNum = e.target.value;
    const capacityHintEl = document.getElementById('trip-vehicle-cap-hint');
    if (!regNum) {
      capacityHintEl.textContent = '';
      return;
    }
    const vehicle = state.vehicles.find(v => v.registration_number === regNum);
    if (vehicle) {
      capacityHintEl.innerHTML = `Vehicle Max Load Capacity: <strong>${vehicle.max_load_capacity} kg</strong>.`;
      capacityHintEl.setAttribute('data-max', vehicle.max_load_capacity);
    }
  });

  // Log Maintenance modal trigger
  document.getElementById('btn-log-maintenance').addEventListener('click', () => {
    setupMaintenanceFormDropdown();
    openModal('modal-maintenance');
  });

  // Log Fuel modal trigger
  document.getElementById('btn-log-fuel').addEventListener('click', () => {
    setupExpenseFormDropdowns('fuel-vehicle');
    document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-fuel');
  });

  // Log Expense modal trigger
  document.getElementById('btn-log-expense').addEventListener('click', () => {
    setupExpenseFormDropdowns('expense-vehicle');
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-expense');
  });

  // --- SUBMISSIONS ---
  document.getElementById('form-vehicle').addEventListener('submit', handleAddVehicle);
  document.getElementById('form-driver').addEventListener('submit', handleAddDriver);
  document.getElementById('form-trip').addEventListener('submit', handleCreateTrip);
  document.getElementById('form-complete-trip').addEventListener('submit', handleCompleteTrip);
  document.getElementById('form-maintenance').addEventListener('submit', handleLogMaintenance);
  document.getElementById('form-close-maintenance').addEventListener('submit', handleCloseMaintenance);
  document.getElementById('form-fuel').addEventListener('submit', handleLogFuel);
  document.getElementById('form-expense').addEventListener('submit', handleLogExpense);
  document.getElementById('form-document').addEventListener('submit', handleDocumentUpload);

  // --- EXPORTS ---
  document.getElementById('btn-export-csv').addEventListener('click', exportReportsCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportReportsPDF);
}

// ----------------------------------------------------
// VIEW NAVIGATION & ROUTING
// ----------------------------------------------------
async function navigateTo(view) {
  state.activeView = view;
  
  // Hide all sections
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.style.display = 'none');
  
  // Show active section
  const activeEl = document.getElementById(`view-${view}`);
  if (activeEl) activeEl.style.display = 'block';

  // Load specific data depending on view
  try {
    switch (view) {
      case 'dashboard':
        await loadDashboardData();
        break;
      case 'vehicles':
        await loadVehiclesData();
        break;
      case 'drivers':
        await loadDriversData();
        break;
      case 'trips':
        await loadTripsData();
        break;
      case 'maintenance':
        await loadMaintenanceData();
        break;
      case 'expenses':
        await loadExpensesData();
        break;
      case 'reports':
        await loadReportsData();
        break;
    }
  } catch (err) {
    console.error(`Error loading data for view ${view}:`, err);
  }
}

// Helper to query API with proper RBAC headers
async function apiCall(endpoint, options = {}) {
  const headers = options.headers || {};
  
  if (state.currentUser) {
    headers['x-user-role'] = state.currentUser.role;
    headers['x-user-email'] = state.currentUser.email;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }
  return data;
}

// Helper to query API with JSON headers
async function apiJSONCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return apiCall(endpoint, options);
}

// Modal actions helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => m.classList.remove('active'));
}

// ----------------------------------------------------
// DATA LOADER & RENDERERS
// ----------------------------------------------------

// 1. Dashboard View
async function loadDashboardData() {
  const type = document.getElementById('db-filter-type').value;
  const region = document.getElementById('db-filter-region').value;
  
  let endpoint = '/dashboard/kpis';
  // If filter criteria set, let's fetch matching lists manually to compute filtered KPIs
  // since server dashboard API handles overall fleet. For dashboard filtering,
  // we filter local records to show matching numbers in real-time.
  
  try {
    const kpis = await apiJSONCall(endpoint);
    
    // Fetch latest lists to display warnings and draw charts
    state.vehicles = await apiJSONCall('/vehicles');
    state.drivers = await apiJSONCall('/drivers');
    state.trips = await apiJSONCall('/trips');
    state.reports = await apiJSONCall('/reports/analytics');

    let filteredVehicles = [...state.vehicles];
    let filteredTrips = [...state.trips];
    let filteredDrivers = [...state.drivers];

    if (type) {
      filteredVehicles = filteredVehicles.filter(v => v.type.toLowerCase() === type.toLowerCase());
      filteredTrips = filteredTrips.filter(t => {
        const v = state.vehicles.find(veh => veh.registration_number === t.vehicle_id);
        return v && v.type.toLowerCase() === type.toLowerCase();
      });
    }
    if (region) {
      filteredVehicles = filteredVehicles.filter(v => v.region.toLowerCase() === region.toLowerCase());
      filteredTrips = filteredTrips.filter(t => {
        const v = state.vehicles.find(veh => veh.registration_number === t.vehicle_id);
        return v && v.region.toLowerCase() === region.toLowerCase();
      });
    }

    // Compute metrics
    const activeVehicles = filteredVehicles.filter(v => v.status === 'On Trip').length;
    const availableVehicles = filteredVehicles.filter(v => v.status === 'Available').length;
    const inMaint = filteredVehicles.filter(v => v.status === 'In Shop').length;
    const activeTrips = filteredTrips.filter(t => t.status === 'Dispatched').length;
    const pendingTrips = filteredTrips.filter(t => t.status === 'Draft').length;

    const totalActiveOrAvail = filteredVehicles.filter(v => v.status !== 'Retired').length;
    const utilization = totalActiveOrAvail > 0 ? Math.round((activeVehicles / totalActiveOrAvail) * 100) : 0;

    // Drivers on duty
    const drvsOnDuty = filteredDrivers.filter(d => d.status === 'Available' || d.status === 'On Trip').length;

    // Update HTML
    document.getElementById('kpi-active-vehicles').textContent = activeVehicles;
    document.getElementById('kpi-available-vehicles').textContent = availableVehicles;
    document.getElementById('kpi-maintenance-vehicles').textContent = inMaint;
    document.getElementById('kpi-drivers-duty').textContent = drvsOnDuty;
    document.getElementById('kpi-utilization').textContent = `${utilization}%`;
    document.getElementById('kpi-trips-summary').textContent = `${pendingTrips} / ${activeTrips}`;

    // Compliance Alerts scan
    scanComplianceAlerts();

    // Redraw charts
    renderDashboardCharts(filteredVehicles);
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

// Scan for expiring/expired licenses and low safety scores
function scanComplianceAlerts() {
  const alertBar = document.getElementById('notification-bar');
  const alertMsg = document.getElementById('notification-message');
  
  const today = new Date().toISOString().split('T')[0];
  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + 30); // 30 days expiry alert
  const thresholdStr = warningThreshold.toISOString().split('T')[0];

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let lowSafetyCount = 0;

  state.drivers.forEach(d => {
    if (d.license_expiry_date < today) {
      expiredCount++;
    } else if (d.license_expiry_date <= thresholdStr) {
      expiringSoonCount++;
    }
    
    if (d.safety_score < 60) {
      lowSafetyCount++;
    }
  });

  if (expiredCount > 0 || expiringSoonCount > 0 || lowSafetyCount > 0) {
    let message = '<strong>Alert System Notices:</strong> ';
    const parts = [];
    if (expiredCount > 0) parts.push(`<span class="badge badge-sm suspended">${expiredCount} Driver license(s) expired!</span>`);
    if (expiringSoonCount > 0) parts.push(`<span class="badge badge-sm draft">${expiringSoonCount} License(s) expiring within 30 days.</span>`);
    if (lowSafetyCount > 0) parts.push(`<span class="badge badge-sm cancelled">${lowSafetyCount} Driver(s) with low safety score (<60).</span>`);
    
    alertMsg.innerHTML = message + parts.join(' | ');
    alertBar.style.display = 'flex';
  } else {
    alertBar.style.display = 'none';
  }
}

// 2. Vehicles View
async function loadVehiclesData() {
  state.vehicles = await apiJSONCall('/vehicles');
  const tbody = document.querySelector('#vehicles-table tbody');
  tbody.innerHTML = '';

  state.vehicles.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${v.registration_number}</strong></td>
      <td>${v.name}</td>
      <td>${v.type}</td>
      <td>${v.max_load_capacity} kg</td>
      <td>${v.odometer.toLocaleString()} km</td>
      <td>$${v.acquisition_cost.toLocaleString()}</td>
      <td>${v.region}</td>
      <td><span class="badge ${v.status.toLowerCase().replace(' ', '')}">${v.status}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="openDocumentModal('${v.registration_number}')">
            <i data-lucide="file-text" style="width:14px;height:14px;"></i> Docs
          </button>
          <button class="btn btn-outline btn-sm action-restricted-manager" onclick="deleteVehicle('${v.registration_number}')" style="${state.currentUser.role === 'fleet_manager' ? '' : 'display:none;'}">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  lucide.createIcons();
}

// 3. Drivers View
async function loadDriversData() {
  state.drivers = await apiJSONCall('/drivers');
  const tbody = document.querySelector('#drivers-table tbody');
  tbody.innerHTML = '';

  const today = new Date().toISOString().split('T')[0];

  state.drivers.forEach(d => {
    const isExpired = d.license_expiry_date < today;
    const licenseClass = isExpired ? 'style="color: #f87171; font-weight: 600;"' : '';
    const safetyBadge = d.safety_score < 60 ? 'color: #f87171; font-weight: 600;' : (d.safety_score >= 90 ? 'color: #34d399;' : '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${d.name}</strong></td>
      <td>${d.license_number}</td>
      <td>${d.license_category}</td>
      <td ${licenseClass}>
        ${d.license_expiry_date} 
        ${isExpired ? '<span class="badge badge-sm cancelled" style="margin-left: 6px;">Expired</span>' : ''}
      </td>
      <td>${d.contact_number}</td>
      <td><span style="${safetyBadge}">${d.safety_score} / 100</span></td>
      <td><span class="badge ${d.status.toLowerCase().replace(' ', '')}">${d.status}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm action-restricted-manager-safety" onclick="editDriver('${d.id}')" style="${(state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'safety_officer') ? '' : 'display:none;'}">
            <i data-lucide="edit" style="width:14px;height:14px;"></i> Edit
          </button>
          <button class="btn btn-outline btn-sm action-restricted-manager-safety" onclick="deleteDriver('${d.id}')" style="${(state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'safety_officer') ? '' : 'display:none;'}">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// 4. Trips View
async function loadTripsData() {
  state.trips = await apiJSONCall('/trips');
  state.vehicles = await apiJSONCall('/vehicles'); // refresh vehicles
  const tbody = document.querySelector('#trips-table tbody');
  tbody.innerHTML = '';

  state.trips.forEach(t => {
    let actionButtons = '';
    const canManageTrips = state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'driver';

    if (canManageTrips) {
      if (t.status === 'Draft') {
        actionButtons = `
          <button class="btn btn-primary btn-sm" onclick="dispatchTrip('${t.id}')">
            <i data-lucide="play" style="width:12px;height:12px;"></i> Dispatch
          </button>
          <button class="btn btn-outline btn-sm" onclick="cancelTrip('${t.id}')">
            <i data-lucide="x" style="width:12px;height:12px;"></i> Cancel
          </button>
        `;
      } else if (t.status === 'Dispatched') {
        actionButtons = `
          <button class="btn btn-outline btn-sm" onclick="openCompleteTripModal('${t.id}', ${t.odometer_start})" style="border-color: var(--primary); color: var(--primary);">
            <i data-lucide="check" style="width:12px;height:12px;"></i> Complete
          </button>
          <button class="btn btn-outline btn-sm" onclick="cancelTrip('${t.id}')">
            <i data-lucide="x" style="width:12px;height:12px;"></i> Cancel
          </button>
        `;
      }
    }

    const odoRange = t.status === 'Completed' 
      ? `${t.odometer_start} - ${t.odometer_end} (${t.odometer_end - t.odometer_start} km)` 
      : `${t.odometer_start} - ...`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>TRIP-${t.id}</td>
      <td>
        <div style="font-weight:600;">${t.source}</div>
        <div style="font-size:12px; color: var(--text-muted);">to ${t.destination}</div>
      </td>
      <td><strong>${t.vehicle_id}</strong><div style="font-size:12px; color: var(--text-muted);">${t.vehicle_name || ''}</div></td>
      <td>${t.driver_name || `Driver ID: ${t.driver_id}`}</td>
      <td>${t.cargo_weight} kg</td>
      <td>${t.planned_distance} km</td>
      <td><span class="badge ${t.status.toLowerCase()}">${t.status}</span></td>
      <td>${odoRange}</td>
      <td>$${t.revenue.toLocaleString()}</td>
      <td>
        <div class="btn-group">
          ${actionButtons || '<span class="text-muted" style="font-size:12px;">No Actions</span>'}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// 5. Maintenance View
async function loadMaintenanceData() {
  state.maintenance = await apiJSONCall('/maintenance');
  const tbody = document.querySelector('#maintenance-table tbody');
  tbody.innerHTML = '';

  state.maintenance.forEach(log => {
    let action = '';
    if (log.status === 'Active' && state.currentUser.role === 'fleet_manager') {
      action = `
        <button class="btn btn-outline btn-sm" onclick="openCloseMaintenanceModal('${log.id}')" style="border-color: var(--primary); color: var(--primary);">
          <i data-lucide="check-circle" style="width:12px;height:12px;"></i> Resolve
        </button>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>MAINT-${log.id}</td>
      <td><strong>${log.vehicle_id}</strong><div style="font-size:11px;color:var(--text-muted);">${log.vehicle_name || ''}</div></td>
      <td>${log.description}</td>
      <td>${log.start_date}</td>
      <td>${log.end_date || 'In Progress'}</td>
      <td><span class="badge ${log.status === 'Active' ? 'inshop' : 'completed'}">${log.status}</span></td>
      <td>${log.cost ? `$${log.cost.toLocaleString()}` : '-'}</td>
      <td>${action || '<span class="text-muted" style="font-size:12px;">No Actions</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// 6. Expenses & Fuel View
async function loadExpensesData() {
  state.fuelLogs = await apiJSONCall('/fuel');
  state.expenses = await apiJSONCall('/expenses');

  // Fuel Table
  const fuelTbody = document.querySelector('#fuel-table tbody');
  fuelTbody.innerHTML = '';
  state.fuelLogs.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.vehicle_id}</strong><div style="font-size:11px;color:var(--text-muted);">${f.vehicle_name || ''}</div></td>
      <td>${f.liters} L</td>
      <td>$${f.cost.toLocaleString()}</td>
      <td>${f.date}</td>
    `;
    fuelTbody.appendChild(tr);
  });

  // Expenses Table
  const expTbody = document.querySelector('#expenses-table tbody');
  expTbody.innerHTML = '';
  state.expenses.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${e.vehicle_id}</strong><div style="font-size:11px;color:var(--text-muted);">${e.vehicle_name || ''}</div></td>
      <td><span class="badge ${e.type === 'Maintenance' ? 'inshop' : 'draft'}">${e.type}</span></td>
      <td>$${e.cost.toLocaleString()}</td>
      <td>${e.date}</td>
      <td><span style="font-size:12px;color:var(--text-muted);">${e.description}</span></td>
    `;
    expTbody.appendChild(tr);
  });
}

// 7. Reports & ROI View
async function loadReportsData() {
  state.reports = await apiJSONCall('/reports/analytics');
  const tbody = document.querySelector('#reports-table tbody');
  tbody.innerHTML = '';

  state.reports.forEach(r => {
    const effStr = r.fuel_efficiency > 0 ? `${r.fuel_efficiency} km/L` : '-';
    
    // ROI style
    let roiClass = '';
    if (r.roi > 0) roiClass = 'style="color: var(--color-available); font-weight:700;"';
    else if (r.roi < 0) roiClass = 'style="color: var(--color-cancelled); font-weight:700;"';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.registration_number}</strong><div style="font-size:11px;color:var(--text-muted);">${r.name}</div></td>
      <td>${r.type}</td>
      <td>${r.total_distance.toLocaleString()} km</td>
      <td>${r.total_fuel_consumed.toLocaleString()} L</td>
      <td>${effStr}</td>
      <td>$${r.fuel_costs.toLocaleString()}</td>
      <td>$${r.maintenance_costs.toLocaleString()}</td>
      <td>$${r.other_costs.toLocaleString()}</td>
      <td><strong>$${r.total_ops_cost.toLocaleString()}</strong></td>
      <td>$${r.total_revenue.toLocaleString()}</td>
      <td ${roiClass}>${r.roi}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------
// CHARTS GENERATION
// ----------------------------------------------------
function renderDashboardCharts(vehicles) {
  // --- CHART 1: Fleet Status Pie Chart ---
  const ctxStatus = document.getElementById('chart-fleet-status').getContext('2d');
  
  const statusCounts = {
    'Available': 0,
    'On Trip': 0,
    'In Shop': 0,
    'Retired': 0
  };
  vehicles.forEach(v => {
    if (statusCounts[v.status] !== undefined) {
      statusCounts[v.status]++;
    }
  });

  if (state.charts.fleetStatus) {
    state.charts.fleetStatus.destroy();
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const labelColor = isLight ? '#1e293b' : '#f3f4f6';

  state.charts.fleetStatus = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#10b981', // Available
          '#3b82f6', // On Trip
          '#f59e0b', // In Shop
          '#6b7280'  // Retired
        ],
        borderWidth: 1,
        borderColor: isLight ? '#ffffff' : '#111827'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: labelColor,
            font: { family: 'Inter', size: 12 }
          }
        }
      }
    }
  });

  // --- CHART 2: Operational Cost Bar Chart ---
  const ctxCosts = document.getElementById('chart-ops-costs').getContext('2d');
  
  // Extract report stats
  const labels = state.reports.map(r => r.registration_number);
  const fuelCostsData = state.reports.map(r => r.fuel_costs);
  const maintCostsData = state.reports.map(r => r.maintenance_costs);
  const otherCostsData = state.reports.map(r => r.other_costs);

  if (state.charts.opsCosts) {
    state.charts.opsCosts.destroy();
  }

  state.charts.opsCosts = new Chart(ctxCosts, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [
        {
          label: 'Fuel Cost',
          data: fuelCostsData.length ? fuelCostsData : [0],
          backgroundColor: '#3b82f6'
        },
        {
          label: 'Maintenance Cost',
          data: maintCostsData.length ? maintCostsData : [0],
          backgroundColor: '#f59e0b'
        },
        {
          label: 'Other Cost',
          data: otherCostsData.length ? otherCostsData : [0],
          backgroundColor: '#8b5cf6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: labelColor }
        },
        y: {
          stacked: true,
          grid: { color: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' },
          ticks: { color: labelColor }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: labelColor,
            font: { family: 'Inter', size: 12 }
          }
        }
      }
    }
  });
}

// ----------------------------------------------------
// DROPDOWNS & DYNAMIC FORM SETUPS
// ----------------------------------------------------
function setupTripFormDropdowns() {
  const vehicleSelect = document.getElementById('trip-vehicle');
  const driverSelect = document.getElementById('trip-driver');
  
  vehicleSelect.innerHTML = '<option value="">Select Available Vehicle</option>';
  driverSelect.innerHTML = '<option value="">Select Available Driver</option>';

  // Load only Available vehicles
  state.vehicles.forEach(v => {
    if (v.status === 'Available') {
      const opt = document.createElement('option');
      opt.value = v.registration_number;
      opt.textContent = `${v.registration_number} - ${v.name} (Max: ${v.max_load_capacity} kg)`;
      vehicleSelect.appendChild(opt);
    }
  });

  // Load only Available drivers with non-expired license
  const today = new Date().toISOString().split('T')[0];
  state.drivers.forEach(d => {
    const isExpired = d.license_expiry_date < today;
    if (d.status === 'Available' && !isExpired) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} - ${d.license_category} CDL (Safety Score: ${d.safety_score})`;
      driverSelect.appendChild(opt);
    }
  });
}

function setupMaintenanceFormDropdown() {
  const maintSelect = document.getElementById('maint-vehicle');
  maintSelect.innerHTML = '<option value="">Select Vehicle</option>';

  // Load vehicles that are NOT Retired and NOT already In Shop
  state.vehicles.forEach(v => {
    if (v.status !== 'Retired' && v.status !== 'In Shop') {
      const opt = document.createElement('option');
      opt.value = v.registration_number;
      opt.textContent = `${v.registration_number} - ${v.name} (Odo: ${v.odometer} km)`;
      maintSelect.appendChild(opt);
    }
  });
}

function setupExpenseFormDropdowns(elementId) {
  const select = document.getElementById(elementId);
  select.innerHTML = '<option value="">Select Vehicle</option>';

  // Load all vehicles
  state.vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.registration_number;
    opt.textContent = `${v.registration_number} - ${v.name}`;
    select.appendChild(opt);
  });
}

// ----------------------------------------------------
// FORM SUBMISSIONS LOGIC (API CALLS)
// ----------------------------------------------------

// 1. Add Vehicle
async function handleAddVehicle(e) {
  e.preventDefault();
  const payload = {
    registration_number: document.getElementById('vehicle-reg').value.toUpperCase().trim(),
    name: document.getElementById('vehicle-name').value.trim(),
    type: document.getElementById('vehicle-type').value,
    max_load_capacity: document.getElementById('vehicle-capacity').value,
    odometer: document.getElementById('vehicle-odometer').value,
    acquisition_cost: document.getElementById('vehicle-cost').value,
    region: document.getElementById('vehicle-region').value
  };

  try {
    await apiJSONCall('/vehicles', 'POST', payload);
    closeAllModals();
    document.getElementById('form-vehicle').reset();
    await navigateTo('vehicles');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// 2. Add/Edit Driver
async function handleAddDriver(e) {
  e.preventDefault();
  const id = document.getElementById('driver-edit-id').value;
  const payload = {
    name: document.getElementById('driver-name').value.trim(),
    license_number: document.getElementById('driver-license').value.trim(),
    license_category: document.getElementById('driver-license-cat').value,
    license_expiry_date: document.getElementById('driver-license-expiry').value,
    contact_number: document.getElementById('driver-contact').value.trim(),
    safety_score: document.getElementById('driver-safety').value || 100
  };

  if (id) {
    payload.status = document.getElementById('driver-status').value;
  }

  try {
    if (id) {
      await apiJSONCall(`/drivers/${id}`, 'PUT', payload);
    } else {
      await apiJSONCall('/drivers', 'POST', payload);
    }
    closeAllModals();
    document.getElementById('form-driver').reset();
    await navigateTo('drivers');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function editDriver(id) {
  const driver = state.drivers.find(d => d.id === parseInt(id));
  if (!driver) return;

  document.getElementById('driver-edit-id').value = driver.id;
  document.getElementById('driver-name').value = driver.name;
  document.getElementById('driver-license').value = driver.license_number;
  document.getElementById('driver-license-cat').value = driver.license_category;
  document.getElementById('driver-license-expiry').value = driver.license_expiry_date;
  document.getElementById('driver-contact').value = driver.contact_number;
  document.getElementById('driver-safety').value = driver.safety_score;
  
  // Show status group in edit mode
  document.getElementById('driver-status-group').style.display = 'block';
  document.getElementById('driver-status').value = driver.status;
  document.querySelector('#modal-driver h2').textContent = 'Modify Driver Details';

  openModal('modal-driver');
}

// 3. Create Trip
async function handleCreateTrip(e) {
  e.preventDefault();
  
  const vReg = document.getElementById('trip-vehicle').value;
  const cargoWeight = parseFloat(document.getElementById('trip-cargo').value);
  
  // Validate cargo weight client-side first
  const capacityHintEl = document.getElementById('trip-vehicle-cap-hint');
  const maxCap = parseFloat(capacityHintEl.getAttribute('data-max') || 0);
  
  if (cargoWeight > maxCap) {
    alert(`Error: Cargo weight (${cargoWeight} kg) exceeds vehicle's maximum load capacity (${maxCap} kg).`);
    return;
  }

  const payload = {
    source: document.getElementById('trip-source').value.trim(),
    destination: document.getElementById('trip-destination').value.trim(),
    vehicle_id: vReg,
    driver_id: document.getElementById('trip-driver').value,
    cargo_weight: cargoWeight,
    planned_distance: document.getElementById('trip-distance').value,
    revenue: document.getElementById('trip-revenue').value || 0
  };

  try {
    await apiJSONCall('/trips', 'POST', payload);
    closeAllModals();
    document.getElementById('form-trip').reset();
    document.getElementById('trip-vehicle-cap-hint').textContent = '';
    await navigateTo('trips');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Trip Dispatch/Cancel Actions
async function dispatchTrip(id) {
  if (!confirm('Are you sure you want to dispatch this trip? Both driver and vehicle statuses will change to On Trip.')) return;
  try {
    await apiJSONCall(`/trips/${id}/dispatch`, 'PUT');
    await navigateTo('trips');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function cancelTrip(id) {
  if (!confirm('Are you sure you want to cancel this trip? Any active driver/vehicle assignments will be restored to Available.')) return;
  try {
    await apiJSONCall(`/trips/${id}/cancel`, 'PUT');
    await navigateTo('trips');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// 4. Complete Trip Modal Actions
function openCompleteTripModal(id, odometerStart) {
  document.getElementById('complete-trip-id').value = id;
  document.getElementById('complete-odo-start').value = odometerStart;
  document.getElementById('complete-odo-end').value = '';
  document.getElementById('complete-odo-end').min = odometerStart;
  document.getElementById('complete-fuel').value = '';
  openModal('modal-complete-trip');
}

async function handleCompleteTrip(e) {
  e.preventDefault();
  const id = document.getElementById('complete-trip-id').value;
  const payload = {
    odometer_end: document.getElementById('complete-odo-end').value,
    fuel_consumed: document.getElementById('complete-fuel').value
  };

  try {
    await apiJSONCall(`/trips/${id}/complete`, 'PUT', payload);
    closeAllModals();
    await navigateTo('trips');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// 5. Maintenance actions
async function handleLogMaintenance(e) {
  e.preventDefault();
  const payload = {
    vehicle_id: document.getElementById('maint-vehicle').value,
    description: document.getElementById('maint-desc').value.trim()
  };

  try {
    await apiJSONCall('/maintenance', 'POST', payload);
    closeAllModals();
    document.getElementById('form-maintenance').reset();
    await navigateTo('maintenance');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function openCloseMaintenanceModal(id) {
  document.getElementById('close-maint-id').value = id;
  document.getElementById('close-maint-cost').value = '';
  document.getElementById('close-maint-date').value = new Date().toISOString().split('T')[0];
  openModal('modal-close-maintenance');
}

async function handleCloseMaintenance(e) {
  e.preventDefault();
  const id = document.getElementById('close-maint-id').value;
  const payload = {
    cost: document.getElementById('close-maint-cost').value,
    end_date: document.getElementById('close-maint-date').value
  };

  try {
    await apiJSONCall(`/maintenance/${id}/close`, 'PUT', payload);
    closeAllModals();
    await navigateTo('maintenance');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// 6. Fuel & Expense Logging
async function handleLogFuel(e) {
  e.preventDefault();
  const payload = {
    vehicle_id: document.getElementById('fuel-vehicle').value,
    liters: document.getElementById('fuel-liters').value,
    cost: document.getElementById('fuel-cost').value,
    date: document.getElementById('fuel-date').value
  };

  try {
    await apiJSONCall('/fuel', 'POST', payload);
    closeAllModals();
    document.getElementById('form-fuel').reset();
    await navigateTo('expenses');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function handleLogExpense(e) {
  e.preventDefault();
  const payload = {
    vehicle_id: document.getElementById('expense-vehicle').value,
    type: document.getElementById('expense-type').value,
    cost: document.getElementById('expense-cost').value,
    date: document.getElementById('expense-date').value,
    description: document.getElementById('expense-desc').value.trim()
  };

  try {
    await apiJSONCall('/expenses', 'POST', payload);
    closeAllModals();
    document.getElementById('form-expense').reset();
    await navigateTo('expenses');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ----------------------------------------------------
// VEHICLE DOCUMENTS MANAGEMENT
// ----------------------------------------------------
async function openDocumentModal(regNumber) {
  document.getElementById('doc-vehicle-id').value = regNumber;
  document.getElementById('doc-vehicle-display').value = regNumber;
  document.getElementById('doc-file').value = '';
  
  await refreshDocumentList(regNumber);
  openModal('modal-document');
}

async function refreshDocumentList(regNumber) {
  const docListUl = document.getElementById('uploaded-docs-list');
  docListUl.innerHTML = '<li>Loading documents...</li>';
  
  try {
    const docs = await apiJSONCall(`/vehicles/${regNumber}/documents`);
    docListUl.innerHTML = '';
    
    if (docs.length === 0) {
      docListUl.innerHTML = '<li>No documents uploaded yet.</li>';
      return;
    }
    
    docs.forEach(doc => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${doc.document_type}</strong>
          <div style="font-size:11px; color:var(--text-muted);">Uploaded: ${doc.upload_date}</div>
        </div>
        <a href="http://localhost:5000${doc.file_path}" target="_blank">
          <i data-lucide="external-link"></i> View File
        </a>
      `;
      docListUl.appendChild(li);
    });
    
    lucide.createIcons();
  } catch (err) {
    docListUl.innerHTML = `<li>Error loading: ${err.message}</li>`;
  }
}

async function handleDocumentUpload(e) {
  e.preventDefault();
  const regNumber = document.getElementById('doc-vehicle-id').value;
  const docType = document.getElementById('doc-type').value;
  const fileInput = document.getElementById('doc-file');
  
  if (fileInput.files.length === 0) {
    alert('Please select a file.');
    return;
  }
  
  const formData = new FormData();
  formData.append('document', fileInput.files[0]);
  formData.append('document_type', docType);

  try {
    // Note: FormData requires omitting 'Content-Type' header so fetch sets boundaries
    await apiCall(`/vehicles/${regNumber}/documents`, {
      method: 'POST',
      body: formData
    });
    
    fileInput.value = '';
    await refreshDocumentList(regNumber);
  } catch (err) {
    alert(`Upload failed: ${err.message}`);
  }
}

// ----------------------------------------------------
// REPORTS EXPORT OPERATIONS
// ----------------------------------------------------
function exportReportsCSV() {
  if (!state.reports.length) return alert('No reports analytics data to export.');

  const headers = [
    'Vehicle Reg',
    'Model Name',
    'Type',
    'Acquisition Cost',
    'Distance Travelled (km)',
    'Fuel Consumed (L)',
    'Fuel Efficiency (km/L)',
    'Fuel Cost ($)',
    'Maintenance Cost ($)',
    'Other Expenses ($)',
    'Total Operations Cost ($)',
    'Trip Revenue ($)',
    'ROI (%)'
  ];

  const rows = state.reports.map(r => [
    r.registration_number,
    r.name,
    r.type,
    r.acquisition_cost,
    r.total_distance,
    r.total_fuel_consumed,
    r.fuel_efficiency,
    r.fuel_costs,
    r.maintenance_costs,
    r.other_costs,
    r.total_ops_cost,
    r.total_revenue,
    r.roi
  ]);

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += headers.join(",") + "\n";
  rows.forEach(row => {
    csvContent += row.map(v => typeof v === 'string' ? `"${v}"` : v).join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `transitops_fleet_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportReportsPDF() {
  if (!state.reports.length) return alert('No reports analytics data to export.');
  
  // Create print window content
  const printWindow = window.open('', '_blank');
  
  let tableRowsHtml = '';
  state.reports.forEach(r => {
    tableRowsHtml += `
      <tr>
        <td><strong>${r.registration_number}</strong></td>
        <td>${r.name}</td>
        <td>${r.type}</td>
        <td>${r.total_distance.toLocaleString()} km</td>
        <td>${r.fuel_efficiency > 0 ? `${r.fuel_efficiency} km/L` : '-'}</td>
        <td>$${r.total_ops_cost.toLocaleString()}</td>
        <td>$${r.total_revenue.toLocaleString()}</td>
        <td style="font-weight:bold; color:${r.roi >= 0 ? '#10b981' : '#ef4444'};">${r.roi}%</td>
      </tr>
    `;
  });

  printWindow.document.write(`
    <html>
      <head>
        <title>TransitOps Fleet ROI and Operational Report</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h1 { margin: 0; font-size: 28px; color: #6366f1; }
          .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f1f5f9; padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .footer { margin-top: 40px; text-align: right; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TransitOps Smart Transport Operations</h1>
          <p>Fleet Performance & ROI Analytics Report</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Reg Number</th>
              <th>Model Name</th>
              <th>Type</th>
              <th>Distance</th>
              <th>Fuel Efficiency</th>
              <th>Operational Cost</th>
              <th>Revenue</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
        <div class="footer">
          TransitOps Digital Management Systems &copy; 2026. All rights reserved.
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ----------------------------------------------------
// UTILITY DELETE ACTIONS
// ----------------------------------------------------
async function deleteVehicle(regNumber) {
  if (!confirm(`Are you sure you want to delete vehicle ${regNumber}?`)) return;
  try {
    await apiJSONCall(`/vehicles/${regNumber}`, 'DELETE');
    await navigateTo('vehicles');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function deleteDriver(id) {
  if (!confirm('Are you sure you want to delete this driver?')) return;
  try {
    await apiJSONCall(`/drivers/${id}`, 'DELETE');
    await navigateTo('drivers');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
