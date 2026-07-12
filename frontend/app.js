// ==========================================================================
// TransitOps Frontend Core Logic (Aligned with Excalidraw Mockups)
// ==========================================================================

const API_BASE = 'http://localhost:5000/api';

const ROLE_DISPLAY_LABELS = {
  fleet_manager: 'Fleet Manager',
  driver: 'Driver',
  safety_officer: 'Safety Officer',
  financial_analyst: 'Financial Analyst'
};

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
  selectedDriverId: null,
  // Sorting Configuration
  sort: {
    vehicles: { column: null, direction: 'asc' },
    drivers: { column: null, direction: 'asc' },
    trips: { column: null, direction: 'asc' },
    reports: { column: null, direction: 'asc' }
  },
  // Chart instances
  charts: {
    revenue: null
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
    const landing = getLandingViewForRole(state.currentUser.role);
    navigateTo(landing);
  } else {
    showLoginLayout();
  }
  
  // Theme initialization
  const storedTheme = localStorage.getItem('transitops_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);
  
  // Initialize Lucide Icons
  lucide.createIcons();
}

function showLoginLayout() {
  document.getElementById('login-screen').style.display = 'grid';
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
  
  // Top nav indicator
  document.getElementById('top-user-name').textContent = state.currentUser.name;
  
  // Set role class and badge text
  roleEl.className = 'role-badge';
  const topBadge = document.getElementById('top-user-badge');
  topBadge.className = 'role-pill';

  if (state.currentUser.role === 'fleet_manager') {
    roleEl.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
    roleEl.classList.add('manager');
    topBadge.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
  } else if (state.currentUser.role === 'driver') {
    if (state.currentUser.email === 'driver@transitops.com') {
      roleEl.textContent = 'Dispatcher';
      roleEl.classList.add('dispatcher');
      topBadge.textContent = 'Dispatcher';
    } else {
      roleEl.textContent = 'Driver';
      roleEl.classList.add('driver');
      topBadge.textContent = 'Driver';
    }
  } else if (state.currentUser.role === 'safety_officer') {
    roleEl.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
    roleEl.classList.add('safety');
    topBadge.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
  } else if (state.currentUser.role === 'financial_analyst') {
    roleEl.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
    roleEl.classList.add('finance');
    topBadge.textContent = ROLE_DISPLAY_LABELS[state.currentUser.role];
  }
  
  // Initials
  const initials = state.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  initialsEl.textContent = initials;
  
  // Apply role permissions
  applyRolePermissions();
}

function getLandingViewForRole(role) {
  if (role === 'fleet_manager') return 'vehicles';
  if (role === 'driver') {
    if (state.currentUser && state.currentUser.email === 'driver@transitops.com') {
      return 'dashboard';
    }
    return 'driver_portal';
  }
  if (role === 'safety_officer') return 'drivers';
  if (role === 'financial_analyst') return 'expenses';
  return 'settings';
}

function applyRolePermissions() {
  const role = state.currentUser.role;
  
  // Navigation tabs elements mapping
  const tabs = {
    dashboard: document.getElementById('nav-dashboard'),
    vehicles: document.getElementById('nav-vehicles'),
    drivers: document.getElementById('nav-drivers'),
    trips: document.getElementById('nav-trips'),
    maintenance: document.getElementById('nav-maintenance'),
    expenses: document.getElementById('nav-expenses'),
    reports: document.getElementById('nav-reports'),
    settings: document.getElementById('nav-settings'),
    driver_portal: document.getElementById('nav-driver-portal')
  };

  // Hide all navigation links by default
  for (const key in tabs) {
    if (tabs[key]) tabs[key].style.display = 'none';
  }

  // Show only specific links based on Mockup rules
  if (role === 'fleet_manager') {
    if (tabs.vehicles) tabs.vehicles.style.display = 'flex';
    if (tabs.maintenance) tabs.maintenance.style.display = 'flex';
  } else if (role === 'driver') {
    if (state.currentUser && state.currentUser.email === 'driver@transitops.com') {
      if (tabs.dashboard) tabs.dashboard.style.display = 'flex';
      if (tabs.trips) tabs.trips.style.display = 'flex';
    } else {
      if (tabs.driver_portal) tabs.driver_portal.style.display = 'flex';
    }
  } else if (role === 'safety_officer') {
    if (tabs.drivers) tabs.drivers.style.display = 'flex';
  } else if (role === 'financial_analyst') {
    if (tabs.expenses) tabs.expenses.style.display = 'flex';
    if (tabs.reports) tabs.reports.style.display = 'flex';
  }
  
  // All roles have access to settings view
  if (tabs.settings) tabs.settings.style.display = 'flex';

  // Apply button level role scopes
  const managerOnlyButtons = document.querySelectorAll('.action-restricted-manager');
  managerOnlyButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager') ? 'inline-flex' : 'none';
  });

  const managerSafetyButtons = document.querySelectorAll('.action-restricted-manager-safety');
  managerSafetyButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'safety_officer') ? 'inline-flex' : 'none';
  });

  const managerDriverButtons = document.querySelectorAll('.action-restricted-manager-driver');
  managerDriverButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'driver') ? 'inline-flex' : 'none';
  });

  const managerFinanceButtons = document.querySelectorAll('.action-restricted-manager-finance');
  managerFinanceButtons.forEach(btn => {
    btn.style.display = (role === 'fleet_manager' || role === 'financial_analyst') ? 'inline-flex' : 'none';
  });
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS SYSTEM
// ----------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-octagon';
  else if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div style="flex-grow: 1;">${message}</div>
  `;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}

// ----------------------------------------------------
// EVENT LISTENERS SETUP
// ----------------------------------------------------
function setupEventListeners() {
  // Login Form Submission
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const selectedRole = document.getElementById('login-role').value;
    
    // Check lockout attempts count
    let failedAttempts = JSON.parse(localStorage.getItem('failed_logins') || '{}');
    if (failedAttempts[email] >= 5) {
      document.getElementById('login-error-card').style.display = 'block';
      document.getElementById('login-error-msg').textContent = 'Account locked after 5 failed attempts.';
      showToast('Login blocked: This account is currently locked.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to authenticate');
      
      // Clear failed count on success
      failedAttempts[email] = 0;
      localStorage.setItem('failed_logins', JSON.stringify(failedAttempts));
      document.getElementById('login-error-card').style.display = 'none';

      // Override role with the selected dropdown value for demonstration flexibility
      data.role = selectedRole;

      state.currentUser = data;
      localStorage.setItem('transitops_user', JSON.stringify(data));
      
      showAppLayout();
      const landing = getLandingViewForRole(data.role);
      navigateTo(landing);
      showToast(`Logged in as ${data.name}!`, 'success');
    } catch (err) {
      // Increment failed count
      failedAttempts[email] = (failedAttempts[email] || 0) + 1;
      localStorage.setItem('failed_logins', JSON.stringify(failedAttempts));

      const remaining = 5 - failedAttempts[email];
      const errorCard = document.getElementById('login-error-card');
      errorCard.style.display = 'block';

      if (failedAttempts[email] >= 5) {
        document.getElementById('login-error-msg').textContent = 'Account locked after 5 failed attempts.';
        showToast('Login Error: Account locked due to too many failed attempts.', 'error');
      } else {
        document.getElementById('login-error-msg').textContent = `Invalid credentials. Account will lock after ${remaining} more attempt(s).`;
        showToast(`Login Failed: ${err.message}`, 'error');
      }
    }
  });
  
  // Quick Login Demo Buttons
  const quickLoginButtons = document.querySelectorAll('.quick-login-btn');
  quickLoginButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const role = btn.getAttribute('data-role');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = 'password123';
      document.getElementById('login-role').value = role;
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    });
  });
  
  // Logout Button
  document.getElementById('logout-btn').addEventListener('click', () => {
    showToast('Signed out successfully.', 'info');
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
    if (state.activeView === 'reports') {
      loadReportsData();
    }
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

  // Close Notification bar button
  document.querySelector('.btn-close-notification').addEventListener('click', () => {
    document.getElementById('notification-bar').style.display = 'none';
  });

  // --- FILTERS & SEARCH EVENT LISTENERS ---
  document.getElementById('db-filter-type').addEventListener('change', () => loadDashboardData());
  document.getElementById('db-filter-status').addEventListener('change', () => loadDashboardData());
  document.getElementById('db-filter-region').addEventListener('change', () => loadDashboardData());
  document.getElementById('db-reset-filters').addEventListener('click', () => {
    document.getElementById('db-filter-type').value = '';
    document.getElementById('db-filter-status').value = '';
    document.getElementById('db-filter-region').value = '';
    loadDashboardData();
  });

  document.getElementById('veh-search').addEventListener('input', () => renderVehiclesTable());
  document.getElementById('veh-filter-status').addEventListener('change', () => renderVehiclesTable());
  document.getElementById('veh-filter-type').addEventListener('change', () => renderVehiclesTable());

  document.getElementById('drv-search').addEventListener('input', () => renderDriversTable());
  document.getElementById('drv-filter-status').addEventListener('change', () => renderDriversTable());

  // --- MODAL TRIGGERS ---
  const closeButtons = document.querySelectorAll('.btn-close-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
    });
  });

  document.getElementById('btn-add-vehicle').addEventListener('click', () => {
    document.getElementById('vehicle-edit-id').value = '';
    document.getElementById('form-vehicle').reset();
    document.getElementById('vehicle-reg').readOnly = false;
    document.getElementById('vehicle-reg').classList.remove('input-readonly');
    document.getElementById('vehicle-status-group').style.display = 'none';
    document.querySelector('#modal-vehicle h2').textContent = 'Register New Vehicle';
    openModal('modal-vehicle');
  });

  document.getElementById('btn-add-driver').addEventListener('click', () => {
    document.getElementById('driver-edit-id').value = '';
    document.getElementById('form-driver').reset();
    document.getElementById('driver-status-group').style.display = 'none';
    document.querySelector('#modal-driver h2').textContent = 'Register New Driver';
    openModal('modal-driver');
  });

  document.getElementById('trip-vehicle').addEventListener('change', (e) => {
    updateCargoCapacityHint();
  });
  
  document.getElementById('trip-cargo').addEventListener('input', (e) => {
    updateCargoCapacityHint();
  });

  document.getElementById('btn-log-fuel').addEventListener('click', () => {
    setupExpenseFormDropdowns('fuel-vehicle');
    document.getElementById('fuel-vehicle').disabled = false;
    document.getElementById('fuel-trip-id').value = '';
    document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-fuel');
  });

  document.getElementById('btn-log-expense').addEventListener('click', () => {
    setupExpenseFormDropdowns('expense-vehicle');
    document.getElementById('expense-vehicle').disabled = false;
    document.getElementById('expense-trip-id').value = '';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-expense');
  });

  // --- DRIVERS VIEW QUICK STATUS TOGGLES ---
  const toggleButtons = document.querySelectorAll('.drivers-toggle-status-panel button');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const driverId = document.getElementById('selected-driver-id-for-toggle').value;
      if (!driverId) {
        showToast('Please select a driver from the roster table first.', 'warning');
        return;
      }
      const newStatus = btn.getAttribute('data-status');
      try {
        const driver = state.drivers.find(d => d.id === parseInt(driverId));
        if (!driver) return;

        const payload = {
          name: driver.name,
          license_number: driver.license_number,
          license_category: driver.license_category,
          license_expiry_date: driver.license_expiry_date,
          contact_number: driver.contact_number,
          safety_score: driver.safety_score,
          status: newStatus
        };

        await apiJSONCall(`/drivers/${driverId}`, 'PUT', payload);
        showToast(`Driver ${driver.name} status updated to ${newStatus}.`, 'success');
        await loadDriversData();
        
        // Highlight row again
        selectDriverRow(driverId);
      } catch (err) {
        showToast(`Failed to toggle status: ${err.message}`, 'error');
      }
    });
  });

  // --- TIMELINE FORM CHANGE SETUP FOR MAINTENANCE ---
  document.getElementById('maint-status').addEventListener('change', (e) => {
    const isClosed = e.target.value === 'Closed';
    document.getElementById('maint-cost-group').style.display = isClosed ? 'block' : 'none';
  });

  // --- GENERAL SETTINGS FORM ---
  document.getElementById('form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('General depot settings updated successfully.', 'success');
  });

  setupTableSorting();

  // --- FORM SUBMISSIONS ---
  document.getElementById('form-vehicle').addEventListener('submit', handleAddVehicle);
  document.getElementById('form-driver').addEventListener('submit', handleAddDriver);
  document.getElementById('form-trip').addEventListener('submit', handleCreateTrip);
  document.getElementById('form-complete-trip').addEventListener('submit', handleCompleteTrip);
  document.getElementById('form-maintenance').addEventListener('submit', handleLogMaintenance);
  document.getElementById('form-close-maintenance').addEventListener('submit', handleCloseMaintenance);
  document.getElementById('form-fuel').addEventListener('submit', handleLogFuel);
  document.getElementById('form-expense').addEventListener('submit', handleLogExpense);
  document.getElementById('form-document').addEventListener('submit', handleDocumentUpload);

  document.getElementById('btn-export-csv').addEventListener('click', exportReportsCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportReportsPDF);

  // Driver Portal Actions
  document.getElementById('driver-portal-log-fuel').addEventListener('click', () => {
    const activeTrip = getActiveTripForCurrentDriver();
    const vehicleId = activeTrip ? activeTrip.vehicle_id : '';
    openDriverLogFuel(vehicleId, activeTrip ? activeTrip.id : null);
  });

  document.getElementById('driver-portal-log-expense').addEventListener('click', () => {
    const activeTrip = getActiveTripForCurrentDriver();
    const vehicleId = activeTrip ? activeTrip.vehicle_id : '';
    openDriverLogExpense(vehicleId, activeTrip ? activeTrip.id : null);
  });
}

// Helper to parse weights
function parseCapacityToKg(capacityStr) {
  if (!capacityStr) return 0;
  const clean = capacityStr.toLowerCase().trim();
  if (clean.includes('ton')) {
    return parseFloat(clean) * 1000;
  }
  return parseFloat(clean) || 0;
}

// Enforce vehicle load validation dynamically
function updateCargoCapacityHint() {
  const regNum = document.getElementById('trip-vehicle').value;
  const cargoInput = document.getElementById('trip-cargo');
  const cargoWeight = parseFloat(cargoInput.value || 0);
  
  const capacityHintEl = document.getElementById('trip-vehicle-cap-hint');
  const warningBox = document.getElementById('trip-overload-warning');
  const warningTitle = document.getElementById('trip-warning-title');
  const warningBody = document.getElementById('trip-warning-body');
  const submitBtn = document.getElementById('btn-submit-trip');

  if (!regNum) {
    capacityHintEl.textContent = '';
    warningBox.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-outline');
    return;
  }

  const vehicle = state.vehicles.find(v => v.registration_number === regNum);
  if (vehicle) {
    const capacityKg = parseCapacityToKg(vehicle.max_load_capacity);
    capacityHintEl.innerHTML = `Vehicle Capacity: <strong>${vehicle.max_load_capacity}</strong> (${capacityKg} kg).`;

    if (cargoWeight > capacityKg) {
      const diff = cargoWeight - capacityKg;
      warningTitle.textContent = `Vehicle Capacity: ${vehicle.max_load_capacity}`;
      warningBody.textContent = `Cargo Weight: ${cargoWeight} kg. Capacity exceeded by ${diff} kg — dispatch blocked.`;
      warningBox.style.display = 'block';
      
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-outline');
      submitBtn.textContent = 'Dispatch (disabled)';
    } else {
      warningBox.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn-outline');
      submitBtn.textContent = 'Dispatch';
    }
  }
}

// ----------------------------------------------------
// TABLE SORTING CONFIGURATION
// ----------------------------------------------------
function setupTableSorting() {
  const vehHeaders = document.querySelectorAll('#vehicles-table th[data-col]');
  vehHeaders.forEach(th => {
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      toggleSort('vehicles', th.getAttribute('data-col'), th);
      renderVehiclesTable();
    });
  });

  const drvHeaders = document.querySelectorAll('#drivers-table th[data-col]');
  drvHeaders.forEach(th => {
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      toggleSort('drivers', th.getAttribute('data-col'), th);
      renderDriversTable();
    });
  });

  const repHeaders = document.querySelectorAll('#reports-table th[data-col]');
  repHeaders.forEach(th => {
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      toggleSort('reports', th.getAttribute('data-col'), th);
      loadReportsData();
    });
  });
}

function toggleSort(tableKey, columnName, element) {
  const current = state.sort[tableKey];
  const tableEl = element.closest('table');
  tableEl.querySelectorAll('th').forEach(th => {
    if (th !== element) th.className = 'sortable';
  });

  if (current.column === columnName) {
    current.direction = current.direction === 'asc' ? 'desc' : 'asc';
  } else {
    current.column = columnName;
    current.direction = 'asc';
  }
  element.className = `sortable ${current.direction}`;
}

function sortArray(array, column, direction) {
  if (!column) return array;
  
  return array.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    if (typeof valA === 'string' && !isNaN(valA) && valA.trim() !== '') valA = parseFloat(valA);
    if (typeof valB === 'string' && !isNaN(valB) && valB.trim() !== '') valB = parseFloat(valB);

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === 'string') {
      return direction === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return direction === 'asc' 
        ? valA - valB 
        : valB - valA;
    }
  });
}

// ----------------------------------------------------
// VIEW NAVIGATION & ROUTING
// ----------------------------------------------------
async function navigateTo(view) {
  state.activeView = view;
  
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.style.display = 'none');
  
  // Show active view
  const activeEl = document.getElementById(`view-${view}`);
  if (activeEl) activeEl.style.display = 'block';

  // Highlight active link in sidebar
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === view) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

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
      case 'driver_portal':
        await loadDriverPortalData();
        break;
    }
  } catch (err) {
    console.error(`Error loading data for view ${view}:`, err);
  }
}

// Helper to query API
async function apiCall(endpoint, options = {}) {
  const headers = options.headers || {};
  if (state.currentUser) {
    headers['x-user-role'] = state.currentUser.role;
    headers['x-user-email'] = state.currentUser.email;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }
  return data;
}

async function apiJSONCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return apiCall(endpoint, options);
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => m.classList.remove('active'));
}

// ----------------------------------------------------
// VIEW-SPECIFIC CODE
// ----------------------------------------------------

// 1. Dashboard View
async function loadDashboardData() {
  const typeFilter = document.getElementById('db-filter-type').value;
  const statusFilter = document.getElementById('db-filter-status').value;
  const regionFilter = document.getElementById('db-filter-region').value;
  
  try {
    const kpis = await apiJSONCall('/dashboard/kpis');
    state.vehicles = await apiJSONCall('/vehicles');
    state.drivers = await apiJSONCall('/drivers');
    state.trips = await apiJSONCall('/trips');

    let filteredVehicles = [...state.vehicles];
    let filteredTrips = [...state.trips];

    if (typeFilter) {
      filteredVehicles = filteredVehicles.filter(v => v.type.toLowerCase() === typeFilter.toLowerCase());
      filteredTrips = filteredTrips.filter(t => {
        const v = state.vehicles.find(veh => veh.registration_number === t.vehicle_id);
        return v && v.type.toLowerCase() === typeFilter.toLowerCase();
      });
    }
    if (statusFilter) {
      filteredVehicles = filteredVehicles.filter(v => v.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (regionFilter) {
      filteredVehicles = filteredVehicles.filter(v => v.region.toLowerCase() === regionFilter.toLowerCase());
      filteredTrips = filteredTrips.filter(t => {
        const v = state.vehicles.find(veh => veh.registration_number === t.vehicle_id);
        return v && v.region.toLowerCase() === regionFilter.toLowerCase();
      });
    }

    // Recalculate KPIs based on filtered subset
    const activeVehicles = filteredVehicles.filter(v => v.status === 'On Trip').length;
    const availableVehicles = filteredVehicles.filter(v => v.status === 'Available').length;
    const inMaint = filteredVehicles.filter(v => v.status === 'In Shop').length;
    const retiredCount = filteredVehicles.filter(v => v.status === 'Retired').length;
    
    const activeTrips = filteredTrips.filter(t => t.status === 'Dispatched').length;
    const pendingTrips = filteredTrips.filter(t => t.status === 'Draft').length;

    const totalActiveOrAvail = filteredVehicles.filter(v => v.status !== 'Retired').length;
    const utilization = totalActiveOrAvail > 0 ? Math.round((activeVehicles / totalActiveOrAvail) * 100) : 0;
    const drvsOnDuty = state.drivers.filter(d => d.status === 'Available' || d.status === 'On Trip').length;

    // Update HTML
    document.getElementById('kpi-active-vehicles').textContent = activeVehicles;
    document.getElementById('kpi-available-vehicles').textContent = availableVehicles;
    document.getElementById('kpi-maintenance-vehicles').textContent = inMaint;
    document.getElementById('kpi-active-trips').textContent = activeTrips;
    document.getElementById('kpi-trips-summary').textContent = pendingTrips;
    document.getElementById('kpi-drivers-duty').textContent = drvsOnDuty;
    document.getElementById('kpi-utilization').textContent = `${utilization}%`;

    // Render Recent Trips Table
    renderRecentTripsTable(filteredTrips);

    // Render Vehicle Status Progress Bars matching Image 2
    renderVehicleStatusGauges(filteredVehicles);

    // Scan alerts
    scanComplianceAlerts();
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

function renderRecentTripsTable(tripsList) {
  const tbody = document.querySelector('#dashboard-trips-table tbody');
  tbody.innerHTML = '';

  // Get newest 4 trips
  const recent = tripsList.slice(-4).reverse();
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No recent trips found.</td></tr>';
    return;
  }

  recent.forEach(t => {
    let etaNote = '-';
    if (t.status === 'Draft') {
      etaNote = 'Awaiting vehicle';
    } else if (t.status === 'Dispatched') {
      etaNote = t.planned_distance > 100 ? '2h 15m' : '45 min';
    } else if (t.status === 'Cancelled') {
      etaNote = 'Vehicle went to shop';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>TR-${t.id}</td>
      <td><strong>${t.vehicle_id || '-'}</strong></td>
      <td>${t.driver_name || '-'}</td>
      <td><span class="badge ${t.status.toLowerCase()}">${t.status}</span></td>
      <td>${etaNote}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderVehicleStatusGauges(vehiclesList) {
  const total = vehiclesList.length || 1;
  const counts = { Available: 0, 'On Trip': 0, 'In Shop': 0, Retired: 0 };
  vehiclesList.forEach(v => {
    if (counts[v.status] !== undefined) counts[v.status]++;
  });

  const getPercent = (count) => Math.round((count / total) * 100);

  document.getElementById('gauge-val-avail').textContent = counts.Available;
  document.querySelector('.fill-available').style.width = `${getPercent(counts.Available)}%`;

  document.getElementById('gauge-val-ontrip').textContent = counts['On Trip'];
  document.querySelector('.fill-ontrip').style.width = `${getPercent(counts['On Trip'])}%`;

  document.getElementById('gauge-val-inshop').textContent = counts['In Shop'];
  document.querySelector('.fill-inshop').style.width = `${getPercent(counts['In Shop'])}%`;

  document.getElementById('gauge-val-retired').textContent = counts.Retired;
  document.querySelector('.fill-retired').style.width = `${getPercent(counts.Retired)}%`;
}

function scanComplianceAlerts() {
  const alertBar = document.getElementById('notification-bar');
  const alertMsg = document.getElementById('notification-message');
  
  const today = new Date().toISOString().split('T')[0];
  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + 30);
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
    if (expiredCount > 0) parts.push(`<span class="badge badge-sm suspended">${expiredCount} License(s) expired!</span>`);
    if (expiringSoonCount > 0) parts.push(`<span class="badge badge-sm draft">${expiringSoonCount} Expiring within 30 days.</span>`);
    if (lowSafetyCount > 0) parts.push(`<span class="badge badge-sm cancelled">${lowSafetyCount} Low safety score (<60).</span>`);
    
    alertMsg.innerHTML = message + parts.join(' | ');
    alertBar.style.display = 'flex';
  } else {
    alertBar.style.display = 'none';
  }
}

// 2. Vehicles View
async function loadVehiclesData() {
  state.vehicles = await apiJSONCall('/vehicles');
  renderVehiclesTable();
}

function renderVehiclesTable() {
  const query = document.getElementById('veh-search').value.toLowerCase().trim();
  const statusFilter = document.getElementById('veh-filter-status').value;
  const typeFilter = document.getElementById('veh-filter-type').value;

  let displayList = [...state.vehicles];

  if (query) {
    displayList = displayList.filter(v => 
      v.registration_number.toLowerCase().includes(query) || 
      v.name.toLowerCase().includes(query)
    );
  }
  if (statusFilter) {
    displayList = displayList.filter(v => v.status === statusFilter);
  }
  if (typeFilter) {
    displayList = displayList.filter(v => v.type === typeFilter);
  }

  const sortCol = state.sort.vehicles.column;
  const sortDir = state.sort.vehicles.direction;
  if (sortCol) {
    displayList = sortArray(displayList, sortCol, sortDir);
  }

  const tbody = document.querySelector('#vehicles-table tbody');
  tbody.innerHTML = '';

  if (displayList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">No matching vehicles found.</td></tr>`;
    return;
  }

  displayList.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${v.registration_number}</strong></td>
      <td>${v.name}</td>
      <td>${v.type}</td>
      <td>${v.max_load_capacity}</td>
      <td>${v.odometer.toLocaleString()} km</td>
      <td>₹${v.acquisition_cost.toLocaleString()}</td>
      <td><span class="badge ${v.status.toLowerCase().replace(' ', '')}">${v.status}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="openDocumentModal('${v.registration_number}')">
            <i data-lucide="file-text" style="width:12px;height:12px;"></i> Docs
          </button>
          <button class="btn btn-outline btn-sm action-restricted-manager" onclick="editVehicle('${v.registration_number}')" style="${state.currentUser.role === 'fleet_manager' ? '' : 'display:none;'}">
            <i data-lucide="edit" style="width:12px;height:12px;"></i> Edit
          </button>
          <button class="btn btn-outline btn-sm action-restricted-manager" onclick="deleteVehicle('${v.registration_number}')" style="${state.currentUser.role === 'fleet_manager' ? '' : 'display:none;'}">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i> Delete
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
  renderDriversTable();
}

function renderDriversTable() {
  const query = document.getElementById('drv-search').value.toLowerCase().trim();
  const statusFilter = document.getElementById('drv-filter-status').value;

  let displayList = [...state.drivers];

  if (query) {
    displayList = displayList.filter(d => 
      d.name.toLowerCase().includes(query) || 
      d.license_number.toLowerCase().includes(query) ||
      d.license_category.toLowerCase().includes(query)
    );
  }
  if (statusFilter) {
    displayList = displayList.filter(d => d.status === statusFilter);
  }

  const sortCol = state.sort.drivers.column;
  const sortDir = state.sort.drivers.direction;
  if (sortCol) {
    displayList = sortArray(displayList, sortCol, sortDir);
  }

  const tbody = document.querySelector('#drivers-table tbody');
  tbody.innerHTML = '';

  if (displayList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--text-muted);">No matching drivers found.</td></tr>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  displayList.forEach(d => {
    const isExpired = d.license_expiry_date < today;
    const licenseStyle = isExpired ? 'style="color: #ef4444; font-weight: 600;"' : '';
    const safetyColor = d.safety_score < 60 ? 'color: #ef4444; font-weight: 600;' : (d.safety_score >= 90 ? 'color: #10b981;' : '');
    const completionRate = d.id % 2 === 0 ? '96%' : '88%';

    const tr = document.createElement('tr');
    tr.setAttribute('data-driver-id', d.id);
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => selectDriverRow(d.id));

    tr.innerHTML = `
      <td><strong>${d.name}</strong></td>
      <td>${d.license_number}</td>
      <td>${d.license_category}</td>
      <td ${licenseStyle}>
        ${d.license_expiry_date} 
        ${isExpired ? '<span class="badge badge-sm cancelled" style="margin-left: 6px;">Expired</span>' : ''}
      </td>
      <td>${d.contact_number}</td>
      <td>${completionRate}</td>
      <td><span style="${safetyColor}">${d.safety_score} / 100</span></td>
      <td><span class="badge ${d.status.toLowerCase().replace(' ', '')}">${d.status}</span></td>
      <td>
        <div class="btn-group">
          ${isExpired || d.status === 'Suspended' ? `
            <button class="btn btn-outline btn-sm action-restricted-manager-safety" onclick="event.stopPropagation(); sendEmailReminder('${d.id}')" title="Send Email Reminder" style="border-color: var(--color-inshop); color: var(--color-inshop); ${(state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'safety_officer') ? '' : 'display:none;'}">
              <i data-lucide="mail" style="width:12px;height:12px;"></i> Remind
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm action-restricted-manager-safety" onclick="event.stopPropagation(); editDriver('${d.id}')" style="${(state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'safety_officer') ? '' : 'display:none;'}">
            <i data-lucide="edit" style="width:12px;height:12px;"></i> Edit
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

function selectDriverRow(id) {
  state.selectedDriverId = id;
  document.getElementById('selected-driver-id-for-toggle').value = id;
  
  // Highlight row visually
  const rows = document.querySelectorAll('#drivers-table tbody tr');
  rows.forEach(tr => {
    if (tr.getAttribute('data-driver-id') == id) {
      tr.classList.add('row-selected');
    } else {
      tr.classList.remove('row-selected');
    }
  });

  // Activate matching button highlight in toggle status panel
  const driver = state.drivers.find(d => d.id == id);
  if (driver) {
    const toggleButtons = document.querySelectorAll('.drivers-toggle-status-panel button');
    toggleButtons.forEach(btn => {
      if (btn.getAttribute('data-status') === driver.status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

// 4. Trips Dispatcher View (Two-Column + Live Board)
async function loadTripsData() {
  state.trips = await apiJSONCall('/trips');
  state.vehicles = await apiJSONCall('/vehicles');
  state.drivers = await apiJSONCall('/drivers');
  
  setupTripFormDropdowns();
  renderLiveBoard();
}

function setupTripFormDropdowns() {
  const vehicleSelect = document.getElementById('trip-vehicle');
  const driverSelect = document.getElementById('trip-driver');
  
  vehicleSelect.innerHTML = '<option value="">Select Available Vehicle</option>';
  driverSelect.innerHTML = '<option value="">Select Available Driver</option>';

  state.vehicles.forEach(v => {
    // Only Available vehicles
    if (v.status === 'Available') {
      const opt = document.createElement('option');
      opt.value = v.registration_number;
      opt.textContent = `${v.registration_number} - ${v.name} (Cap: ${v.max_load_capacity})`;
      vehicleSelect.appendChild(opt);
    }
  });

  const today = new Date().toISOString().split('T')[0];
  state.drivers.forEach(d => {
    // Only Available, non-expired drivers
    const isExpired = d.license_expiry_date < today;
    if (d.status === 'Available' && !isExpired) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} (Safety Score: ${d.safety_score})`;
      driverSelect.appendChild(opt);
    }
  });
}

function renderLiveBoard() {
  const query = document.getElementById('trip-search').value.toLowerCase().trim();
  const boardBox = document.getElementById('live-board-box');
  boardBox.innerHTML = '';

  let displayList = [...state.trips];
  if (query) {
    displayList = displayList.filter(t => 
      t.id.toString().includes(query) ||
      t.source.toLowerCase().includes(query) ||
      t.destination.toLowerCase().includes(query) ||
      t.vehicle_id.toLowerCase().includes(query) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(query))
    );
  }

  // Display newest first
  displayList.reverse();

  if (displayList.length === 0) {
    boardBox.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding:20px 0;">No active trips on the board.</div>';
    return;
  }

  displayList.forEach(t => {
    let actionsHtml = '';
    const canManage = state.currentUser.role === 'fleet_manager' || state.currentUser.role === 'driver';

    if (canManage) {
      if (t.status === 'Draft') {
        actionsHtml = `
          <button class="btn btn-primary btn-sm" onclick="dispatchTrip('${t.id}')">
            <i data-lucide="play" style="width:12px;height:12px;"></i> Dispatch
          </button>
          <button class="btn btn-outline btn-sm" onclick="cancelTrip('${t.id}')">
            <i data-lucide="x" style="width:12px;height:12px;"></i> Cancel
          </button>
        `;
      } else if (t.status === 'Dispatched') {
        actionsHtml = `
          <button class="btn btn-outline btn-sm" onclick="openCompleteTripModal('${t.id}', ${t.odometer_start})" style="border-color: var(--primary); color: var(--primary);">
            <i data-lucide="check" style="width:12px;height:12px;"></i> Complete
          </button>
          <button class="btn btn-outline btn-sm" onclick="cancelTrip('${t.id}')">
            <i data-lucide="x" style="width:12px;height:12px;"></i> Cancel
          </button>
        `;
      }
    }

    let etaText = 'ETA: -';
    if (t.status === 'Draft') {
      etaText = 'Awaiting driver assignment';
    } else if (t.status === 'Dispatched') {
      etaText = t.planned_distance > 100 ? 'ETA: 2h 15m' : 'ETA: 45 min';
    } else if (t.status === 'Cancelled') {
      etaText = 'Note: Asset resolved in shop';
    }

    const card = document.createElement('div');
    card.className = `trip-card`;
    if (t.status === 'Dispatched') card.style.borderLeft = '4px solid var(--color-ontrip)';
    else if (t.status === 'Completed') card.style.borderLeft = '4px solid var(--color-available)';
    else if (t.status === 'Cancelled') card.style.borderLeft = '4px solid var(--color-retired)';

    card.innerHTML = `
      <div class="trip-card-header">
        <span class="trip-card-id">TRIP-${t.id}</span>
        <span class="badge ${t.status.toLowerCase()}">${t.status}</span>
      </div>
      <div class="trip-card-route">
        ${t.source} &rarr; ${t.destination}
      </div>
      <div class="trip-card-assets">
        Vehicle: <strong>${t.vehicle_id || 'Unassigned'}</strong> &bull; Driver: <strong>${t.driver_name || 'Unassigned'}</strong>
      </div>
      <div class="trip-card-footer">
        <span class="trip-card-eta">${etaText}</span>
        <div class="btn-group">
          ${actionsHtml}
        </div>
      </div>
    `;
    boardBox.appendChild(card);
  });

  lucide.createIcons();
}

// 5. Maintenance View
async function loadMaintenanceData() {
  state.maintenance = await apiJSONCall('/maintenance');
  state.vehicles = await apiJSONCall('/vehicles');

  // Fill vehicle dropdown
  const maintSelect = document.getElementById('maint-vehicle');
  maintSelect.innerHTML = '<option value="">Select Vehicle</option>';
  state.vehicles.forEach(v => {
    if (v.status !== 'Retired') {
      const opt = document.createElement('option');
      opt.value = v.registration_number;
      opt.textContent = `${v.registration_number} - ${v.name}`;
      maintSelect.appendChild(opt);
    }
  });

  // Render Service Logs Table
  const tbody = document.querySelector('#maintenance-table tbody');
  tbody.innerHTML = '';

  state.maintenance.forEach(log => {
    let action = '';
    if (log.status === 'Active' && state.currentUser.role === 'fleet_manager') {
      action = `
        <button class="btn btn-outline btn-sm" onclick="openCloseMaintenanceModal('${log.id}')" style="border-color: var(--primary); color: var(--primary); padding: 4px 8px; font-size:11px;">
          <i data-lucide="check-circle" style="width:12px;height:12px;"></i> Resolve
        </button>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${log.vehicle_id}</strong><div style="font-size:11px;color:var(--text-muted);">${log.vehicle_name || ''}</div></td>
      <td>${log.description}</td>
      <td>${log.cost ? `₹${log.cost.toLocaleString()}` : '-'}</td>
      <td><span class="badge ${log.status === 'Active' ? 'inshop' : 'completed'}">${log.status === 'Active' ? 'In Shop' : 'Completed'}</span></td>
      <td>${action || '<span class="text-muted" style="font-size:11px;">No Actions</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// 6. Fuel & Expense Management
async function loadExpensesData() {
  state.fuelLogs = await apiJSONCall('/fuel');
  state.expenses = await apiJSONCall('/expenses');

  // Render Fuel Logs Table
  const fuelTbody = document.querySelector('#fuel-table tbody');
  fuelTbody.innerHTML = '';
  state.fuelLogs.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.vehicle_id}</strong><div style="font-size:11px;color:var(--text-muted);">${f.vehicle_name || ''}</div></td>
      <td>${f.date}</td>
      <td>${f.liters} L</td>
      <td>₹${f.cost.toLocaleString()}</td>
    `;
    fuelTbody.appendChild(tr);
  });

  // Render Other Expenses Table
  const expTbody = document.querySelector('#expenses-table tbody');
  expTbody.innerHTML = '';
  state.expenses.forEach(e => {
    // Toll and Maint values split
    const isMaint = e.type === 'Maintenance';
    const isToll = e.type === 'Tolls';
    
    const tollVal = isToll ? `₹${e.cost.toLocaleString()}` : '₹0';
    const otherVal = (!isToll && !isMaint) ? `₹${e.cost.toLocaleString()}` : '₹0';
    const maintVal = isMaint ? `₹${e.cost.toLocaleString()}` : '₹0';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>TR-${e.id}</td>
      <td><strong>${e.vehicle_id}</strong></td>
      <td>${tollVal}</td>
      <td>${otherVal}</td>
      <td>${maintVal}</td>
      <td><span class="badge completed">Completed</span></td>
    `;
    expTbody.appendChild(tr);
  });

  // Calculate Total Operational Cost = Fuel + Maint + Toll/Other
  let fuelTotal = state.fuelLogs.reduce((sum, f) => sum + f.cost, 0);
  let expenseTotal = state.expenses.reduce((sum, e) => sum + e.cost, 0);
  let grandTotal = fuelTotal + expenseTotal;

  document.getElementById('calc-total-ops-cost').textContent = `₹${grandTotal.toLocaleString()}`;
}

function setupExpenseFormDropdowns(elementId) {
  const select = document.getElementById(elementId);
  select.innerHTML = '<option value="">Select Vehicle</option>';
  state.vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.registration_number;
    opt.textContent = `${v.registration_number} - ${v.name}`;
    select.appendChild(opt);
  });
}

// 7. Analytics View
async function loadReportsData() {
  state.reports = await apiJSONCall('/reports/analytics');
  state.vehicles = await apiJSONCall('/vehicles');
  state.fuelLogs = await apiJSONCall('/fuel');
  state.expenses = await apiJSONCall('/expenses');

  // Compute metrics for analytics cards matching Image 8
  let fuelTotal = state.fuelLogs.reduce((sum, f) => sum + f.cost, 0);
  let expenseTotal = state.expenses.reduce((sum, e) => sum + e.cost, 0);
  let grandTotal = fuelTotal + expenseTotal;

  let totalDistance = state.reports.reduce((sum, r) => sum + r.total_distance, 0);
  let totalFuelLiters = state.reports.reduce((sum, r) => sum + r.total_fuel_consumed, 0);
  let efficiency = totalFuelLiters > 0 ? (totalDistance / totalFuelLiters).toFixed(1) : '8.4';

  let activeVehicles = state.vehicles.filter(v => v.status === 'On Trip').length;
  let activeOrAvail = state.vehicles.filter(v => v.status !== 'Retired').length;
  let utilization = activeOrAvail > 0 ? Math.round((activeVehicles / activeOrAvail) * 100) : 81;

  let avgRoi = state.reports.length > 0 
    ? (state.reports.reduce((sum, r) => sum + r.roi, 0) / state.reports.length).toFixed(3) 
    : '0.142';

  document.getElementById('analytic-fuel-efficiency').textContent = `${efficiency} km/l`;
  document.getElementById('analytic-fleet-utilization').textContent = `${utilization}%`;
  document.getElementById('analytic-ops-cost').textContent = `₹${grandTotal.toLocaleString()}`;
  document.getElementById('analytic-vehicle-roi').textContent = `${avgRoi}`;

  // Render Detailed Vehicle Reports Table
  const tbody = document.querySelector('#reports-table tbody');
  tbody.innerHTML = '';
  
  // Sort reports if set
  let sortedReports = [...state.reports];
  const sortCol = state.sort.reports.column;
  const sortDir = state.sort.reports.direction;
  if (sortCol) {
    sortedReports = sortArray(sortedReports, sortCol, sortDir);
  }

  sortedReports.forEach(r => {
    const effStr = r.fuel_efficiency > 0 ? `${r.fuel_efficiency} km/L` : '-';
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
      <td>₹${r.fuel_costs.toLocaleString()}</td>
      <td>₹${r.maintenance_costs.toLocaleString()}</td>
      <td>₹${r.other_costs.toLocaleString()}</td>
      <td><strong>₹${r.total_ops_cost.toLocaleString()}</strong></td>
      <td>₹${r.total_revenue.toLocaleString()}</td>
      <td ${roiClass}>${Number(r.roi).toFixed(3)}</td>
      <td ${roiClass}>${r.extended_roi}%</td>
    `;
    tbody.appendChild(tr);
  });

  // Render Costliest Vehicles Vertical Bars List matching Image 8
  renderCostliestVehiclesList();

  // Render Monthly Revenue Bar Chart matching Image 8
  renderRevenueBarChart();
}

function renderCostliestVehiclesList() {
  const box = document.getElementById('costliest-vehicles-box');
  box.innerHTML = '';

  // Get costliest vehicles based on operational cost
  const sorted = [...state.reports].sort((a, b) => b.total_ops_cost - a.total_ops_cost).slice(0, 3);
  const maxCost = sorted.length > 0 ? sorted[0].total_ops_cost : 1;

  sorted.forEach(r => {
    const pct = Math.round((r.total_ops_cost / maxCost) * 100);
    const row = document.createElement('div');
    row.className = 'costliest-row';
    row.innerHTML = `
      <span class="costliest-label">${r.registration_number}</span>
      <div class="costliest-bar-track">
        <div class="costliest-bar-fill" style="width: ${pct}%;"></div>
      </div>
    `;
    box.appendChild(row);
  });
}

function renderRevenueBarChart() {
  const ctx = document.getElementById('chart-monthly-revenue').getContext('2d');
  
  if (state.charts.revenue) {
    state.charts.revenue.destroy();
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const labelColor = isLight ? '#1f2937' : '#f3f4f6';

  state.charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [{
        label: 'Monthly Revenue ($)',
        data: [12000, 15000, 14000, 18500, 17200, 21000, 19500],
        backgroundColor: '#3b82f6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: labelColor }, grid: { display: false } },
        y: { ticks: { color: labelColor }, grid: { color: 'rgba(255,255,255,0.04)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ----------------------------------------------------
// FORM SUBMISSIONS API WRAPPERS
// ----------------------------------------------------

// 1. Add / Edit Vehicle
async function handleAddVehicle(e) {
  e.preventDefault();
  const id = document.getElementById('vehicle-edit-id').value;
  
  const payload = {
    registration_number: document.getElementById('vehicle-reg').value.toUpperCase().trim(),
    name: document.getElementById('vehicle-name').value.trim(),
    type: document.getElementById('vehicle-type').value,
    max_load_capacity: document.getElementById('vehicle-capacity').value.trim(),
    odometer: parseFloat(document.getElementById('vehicle-odometer').value),
    acquisition_cost: parseFloat(document.getElementById('vehicle-cost').value),
    region: document.getElementById('vehicle-region').value
  };

  if (id) {
    payload.status = document.getElementById('vehicle-status').value;
  }

  try {
    if (id) {
      await apiJSONCall(`/vehicles/${id}`, 'PUT', payload);
      showToast(`Vehicle details updated successfully.`, 'success');
    } else {
      await apiJSONCall('/vehicles', 'POST', payload);
      showToast(`Vehicle ${payload.registration_number} registered.`, 'success');
    }
    closeAllModals();
    document.getElementById('form-vehicle').reset();
    await navigateTo('vehicles');
  } catch (err) {
    showToast(`Error saving vehicle: ${err.message}`, 'error');
  }
}

async function editVehicle(regNumber) {
  const vehicle = state.vehicles.find(v => v.registration_number === regNumber);
  if (!vehicle) return;

  document.getElementById('vehicle-edit-id').value = vehicle.registration_number;
  document.getElementById('vehicle-reg').value = vehicle.registration_number;
  document.getElementById('vehicle-reg').readOnly = true;
  document.getElementById('vehicle-reg').classList.add('input-readonly');
  
  document.getElementById('vehicle-name').value = vehicle.name;
  document.getElementById('vehicle-type').value = vehicle.type;
  document.getElementById('vehicle-capacity').value = vehicle.max_load_capacity;
  document.getElementById('vehicle-odometer').value = vehicle.odometer;
  document.getElementById('vehicle-cost').value = vehicle.acquisition_cost;
  document.getElementById('vehicle-region').value = vehicle.region;

  document.getElementById('vehicle-status-group').style.display = 'block';
  document.getElementById('vehicle-status').value = vehicle.status;
  document.querySelector('#modal-vehicle h2').textContent = 'Modify Vehicle Details';

  openModal('modal-vehicle');
}

// 2. Add / Edit Driver
async function handleAddDriver(e) {
  e.preventDefault();
  const id = document.getElementById('driver-edit-id').value;
  const payload = {
    name: document.getElementById('driver-name').value.trim(),
    license_number: document.getElementById('driver-license').value.trim(),
    license_category: document.getElementById('driver-license-cat').value,
    license_expiry_date: document.getElementById('driver-license-expiry').value,
    contact_number: document.getElementById('driver-contact').value.trim(),
    safety_score: parseFloat(document.getElementById('driver-safety').value || 100)
  };

  if (id) {
    payload.status = document.getElementById('driver-status').value;
  }

  try {
    if (id) {
      await apiJSONCall(`/drivers/${id}`, 'PUT', payload);
      showToast(`Driver details updated successfully.`, 'success');
    } else {
      await apiJSONCall('/drivers', 'POST', payload);
      showToast(`Driver ${payload.name} registered.`, 'success');
    }
    closeAllModals();
    document.getElementById('form-driver').reset();
    await navigateTo('drivers');
  } catch (err) {
    showToast(`Error saving driver: ${err.message}`, 'error');
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
  
  document.getElementById('driver-status-group').style.display = 'block';
  document.getElementById('driver-status').value = driver.status;
  document.querySelector('#modal-driver h2').textContent = 'Modify Driver Details';

  openModal('modal-driver');
}

async function sendEmailReminder(id) {
  try {
    const res = await apiJSONCall(`/drivers/${id}/remind`, 'POST');
    showToast(res.message, 'success');
  } catch (err) {
    showToast(`Error sending reminder: ${err.message}`, 'error');
  }
}

// 3. Create Trip
async function handleCreateTrip(e) {
  e.preventDefault();
  
  const vReg = document.getElementById('trip-vehicle').value;
  const cargoWeight = parseFloat(document.getElementById('trip-cargo').value);
  
  const vehicle = state.vehicles.find(v => v.registration_number === vReg);
  if (vehicle) {
    const capacityKg = parseCapacityToKg(vehicle.max_load_capacity);
    if (cargoWeight > capacityKg) {
      showToast(`Dispatch blocked: Cargo exceeds vehicle capacity.`, 'error');
      return;
    }
  }

  const payload = {
    source: document.getElementById('trip-source').value.trim(),
    destination: document.getElementById('trip-destination').value.trim(),
    vehicle_id: vReg,
    driver_id: parseInt(document.getElementById('trip-driver').value),
    cargo_weight: cargoWeight,
    planned_distance: parseFloat(document.getElementById('trip-distance').value),
    revenue: parseFloat(document.getElementById('trip-revenue').value || 0)
  };

  try {
    await apiJSONCall('/trips', 'POST', payload);
    showToast('Draft trip successfully generated on the board.', 'success');
    closeAllModals();
    document.getElementById('form-trip').reset();
    document.getElementById('trip-vehicle-cap-hint').textContent = '';
    await loadTripsData();
  } catch (err) {
    showToast(`Error creating trip: ${err.message}`, 'error');
  }
}

async function dispatchTrip(id) {
  try {
    await apiJSONCall(`/trips/${id}/dispatch`, 'PUT');
    showToast('Trip en route. Vehicle and driver statuses updated.', 'success');
    await loadTripsData();
  } catch (err) {
    showToast(`Failed to dispatch: ${err.message}`, 'error');
  }
}

async function cancelTrip(id) {
  if (!confirm('Are you sure you want to cancel this trip?')) return;
  try {
    await apiJSONCall(`/trips/${id}/cancel`, 'PUT');
    showToast('Trip cancelled and removed from active roster.', 'warning');
    await loadTripsData();
  } catch (err) {
    showToast(`Failed to cancel: ${err.message}`, 'error');
  }
}

// 4. Complete Trip
function openCompleteTripModal(id, odometerStart) {
  document.getElementById('complete-trip-id').value = id;
  document.getElementById('complete-odo-start').value = odometerStart;
  document.getElementById('complete-odo-end').value = '';
  document.getElementById('complete-odo-end').min = odometerStart;
  document.getElementById('complete-fuel').value = '';
  document.getElementById('complete-fuel-cost').value = '';
  openModal('modal-complete-trip');
}

async function handleCompleteTrip(e) {
  e.preventDefault();
  const id = document.getElementById('complete-trip-id').value;
  const payload = {
    odometer_end: parseFloat(document.getElementById('complete-odo-end').value),
    fuel_consumed: parseFloat(document.getElementById('complete-fuel').value),
    fuel_cost: parseFloat(document.getElementById('complete-fuel-cost').value)
  };

  try {
    await apiJSONCall(`/trips/${id}/complete`, 'PUT', payload);
    showToast('Trip completed. Fuel addition logged.', 'success');
    closeAllModals();
    if (state.activeView === 'driver_portal') {
      await loadDriverPortalData();
    } else {
      await loadTripsData();
    }
  } catch (err) {
    showToast(`Failed to complete: ${err.message}`, 'error');
  }
}

// 5. Maintenance Logs
async function handleLogMaintenance(e) {
  e.preventDefault();
  const regNumber = document.getElementById('maint-vehicle').value;
  const isClosed = document.getElementById('maint-status').value === 'Closed';

  const payload = {
    vehicle_id: regNumber,
    description: document.getElementById('maint-desc').value.trim()
  };

  try {
    const log = await apiJSONCall('/maintenance', 'POST', payload);
    
    if (isClosed) {
      const cost = parseFloat(document.getElementById('maint-cost').value || 0);
      await apiJSONCall(`/maintenance/${log.id}/close`, 'PUT', {
        cost,
        end_date: document.getElementById('maint-date').value
      });
      showToast('Maintenance service record logged and closed.', 'success');
    } else {
      showToast(`Vehicle ${regNumber} checked in shop.`, 'warning');
    }

    closeAllModals();
    document.getElementById('form-maintenance').reset();
    document.getElementById('maint-cost-group').style.display = 'none';
    await navigateTo('maintenance');
  } catch (err) {
    showToast(`Failed to log maintenance: ${err.message}`, 'error');
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
    cost: parseFloat(document.getElementById('close-maint-cost').value),
    end_date: document.getElementById('close-maint-date').value
  };

  try {
    await apiJSONCall(`/maintenance/${id}/close`, 'PUT', payload);
    showToast('Maintenance closed. Vehicle restored to Available.', 'success');
    closeAllModals();
    await loadMaintenanceData();
  } catch (err) {
    showToast(`Failed to close: ${err.message}`, 'error');
  }
}

// 6. Fuel & Expense Logging
async function handleLogFuel(e) {
  e.preventDefault();
  const tripIdEl = document.getElementById('fuel-trip-id');
  const payload = {
    vehicle_id: document.getElementById('fuel-vehicle').value,
    trip_id: tripIdEl && tripIdEl.value ? parseInt(tripIdEl.value) : null,
    liters: parseFloat(document.getElementById('fuel-liters').value),
    cost: parseFloat(document.getElementById('fuel-cost').value),
    date: document.getElementById('fuel-date').value
  };

  try {
    await apiJSONCall('/fuel', 'POST', payload);
    showToast(`Fuel receipt logged successfully.`, 'success');
    closeAllModals();
    document.getElementById('form-fuel').reset();
    if (state.currentUser && state.currentUser.role === 'driver') {
      await navigateTo('driver_portal');
    } else {
      await navigateTo('expenses');
    }
  } catch (err) {
    showToast(`Failed to log fuel: ${err.message}`, 'error');
  }
}

async function handleLogExpense(e) {
  e.preventDefault();
  const payload = {
    vehicle_id: document.getElementById('expense-vehicle').value,
    type: document.getElementById('expense-type').value,
    cost: parseFloat(document.getElementById('expense-cost').value),
    date: document.getElementById('expense-date').value,
    description: document.getElementById('expense-desc').value.trim()
  };

  try {
    await apiJSONCall('/expenses', 'POST', payload);
    showToast(`Operational expense details saved.`, 'success');
    closeAllModals();
    document.getElementById('form-expense').reset();
    if (state.currentUser && state.currentUser.role === 'driver') {
      await navigateTo('driver_portal');
    } else {
      await navigateTo('expenses');
    }
  } catch (err) {
    showToast(`Failed to log expense: ${err.message}`, 'error');
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
          <div style="font-size:11px; color:var(--text-muted);">${doc.file_name} (Uploaded: ${doc.upload_date})</div>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <a href="http://localhost:5000${doc.file_path}" target="_blank" style="font-size:12px;">
            <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;"></i> View
          </a>
          <button type="button" class="btn btn-outline btn-sm action-restricted-manager" onclick="deleteDocument('${regNumber}', '${doc.id}')" style="padding: 2px 6px; border-color: rgba(239, 68, 68, 0.3); color: #ef4444; ${state.currentUser.role === 'fleet_manager' ? '' : 'display:none;'}">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </div>
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
    showToast('Please select a document file to upload.', 'warning');
    return;
  }
  
  const formData = new FormData();
  formData.append('document', fileInput.files[0]);
  formData.append('document_type', docType);

  try {
    await apiCall(`/vehicles/${regNumber}/documents`, {
      method: 'POST',
      body: formData
    });
    
    showToast('Document uploaded successfully.', 'success');
    fileInput.value = '';
    await refreshDocumentList(regNumber);
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  }
}

async function deleteDocument(regNumber, docId) {
  if (!confirm('Are you sure you want to delete this document from the server?')) return;
  try {
    await apiJSONCall(`/vehicles/${regNumber}/documents/${docId}`, 'DELETE');
    showToast('Document deleted.', 'warning');
    await refreshDocumentList(regNumber);
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}

// ----------------------------------------------------
// REPORTS EXPORT OPERATIONS
// ----------------------------------------------------
function exportReportsCSV() {
  if (!state.reports.length) return showToast('No data to export.', 'warning');

  const headers = [
    'Vehicle Reg', 'Model Name', 'Type', 'Acquisition Cost',
    'Distance (km)', 'Fuel Consumed (L)', 'Fuel Efficiency (km/L)',
    'Fuel Cost ($)', 'Maintenance Cost ($)', 'Other Expenses ($)',
    'Total Ops Cost (₹)', 'Trip Revenue (₹)', 'ROI (ratio)', 'Extended ROI (%)'
  ];

  const rows = state.reports.map(r => [
    r.registration_number, r.name, r.type, r.acquisition_cost,
    r.total_distance, r.total_fuel_consumed, r.fuel_efficiency,
    r.fuel_costs, r.maintenance_costs, r.other_costs,
    r.total_ops_cost, r.total_revenue, Number(r.roi).toFixed(3), r.extended_roi
  ]);

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += headers.join(",") + "\n";
  rows.forEach(row => {
    csvContent += row.map(v => typeof v === 'string' ? `"${v}"` : v).join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `transitops_fleet_report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Reports CSV exported successfully.', 'success');
}

function exportReportsPDF() {
  if (!state.reports.length) return showToast('No reports data to export.', 'warning');
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
        <td>₹${r.total_ops_cost.toLocaleString()}</td>
        <td>₹${r.total_revenue.toLocaleString()}</td>
        <td style="font-weight:bold; color:${r.roi >= 0 ? '#10b981' : '#ef4444'};">${Number(r.roi).toFixed(3)}</td>
        <td style="font-weight:bold; color:${r.extended_roi >= 0 ? '#10b981' : '#ef4444'};">${r.extended_roi}%</td>
      </tr>
    `;
  });

  printWindow.document.write(`
    <html>
      <head>
        <title>TransitOps Fleet Report</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #1e293b; }
          h1 { color: #d97706; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f1f5f9; padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <h1>TransitOps Fleet Performance Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Reg Number</th><th>Model</th><th>Type</th><th>Distance</th><th>Efficiency</th><th>Ops Cost</th><th>Revenue</th><th>ROI (ratio)</th><th>Ext. ROI (%)</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
        <script>
          window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }
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
    showToast(`Vehicle ${regNumber} deleted successfully.`, 'warning');
    await navigateTo('vehicles');
  } catch (err) {
    showToast(`Error deleting vehicle: ${err.message}`, 'error');
  }
}

async function deleteDriver(id) {
  if (!confirm('Are you sure you want to delete this driver?')) return;
  try {
    await apiJSONCall(`/drivers/${id}`, 'DELETE');
    showToast('Driver profile removed.', 'warning');
    await navigateTo('drivers');
  } catch (err) {
    showToast(`Error deleting driver: ${err.message}`, 'error');
  }
}

// ----------------------------------------------------
// DRIVER PORTAL FUNCTIONS
// ----------------------------------------------------
async function loadDriverPortalData() {
  if (!state.currentUser || state.currentUser.role !== 'driver') return;
  
  try {
    state.drivers = await apiJSONCall('/drivers');
    state.trips = await apiJSONCall('/trips');
    state.vehicles = await apiJSONCall('/vehicles');

    const cleanUserName = state.currentUser.name.replace(/\s*\(Driver\)\s*/i, '').trim().toLowerCase();
    const myDriver = state.drivers.find(d => d.name.toLowerCase() === cleanUserName);

    if (!myDriver) {
      document.getElementById('driver-portal-welcome').textContent = `Welcome, ${state.currentUser.name}!`;
      document.getElementById('driver-portal-active-trip-container').innerHTML = `
        <div class="alert alert-warning" style="margin: 0; background: rgba(245,158,11,0.08); border: 1px dashed var(--color-inshop); padding: 12px; border-radius: 8px; color: var(--color-inshop);">
          Driver profile matching "${state.currentUser.name}" not found in roster. Please contact the administrator.
        </div>
      `;
      return;
    }

    document.getElementById('driver-portal-welcome').textContent = `Welcome back, ${myDriver.name}!`;
    document.getElementById('driver-my-license-category').textContent = myDriver.license_category || '-';
    document.getElementById('driver-my-license-expiry').textContent = myDriver.license_expiry_date || '-';
    document.getElementById('driver-my-contact').textContent = myDriver.contact_number || '-';
    
    const statusEl = document.getElementById('driver-my-status');
    statusEl.textContent = myDriver.status;
    statusEl.className = `badge ${myDriver.status.toLowerCase().replace(/\s+/g, '')}`;

    const score = myDriver.safety_score || 0;
    document.getElementById('driver-safety-percentage').textContent = `${score}%`;
    
    const circle = document.getElementById('driver-safety-circle');
    if (circle) {
      const offset = 314.16 - (score / 100) * 314.16;
      circle.style.strokeDashoffset = offset;
      if (score >= 90) {
        circle.style.stroke = 'var(--color-available)';
      } else if (score >= 70) {
        circle.style.stroke = 'var(--color-inshop)';
      } else {
        circle.style.stroke = 'var(--color-retired)';
      }
    }

    const feedbackEl = document.getElementById('driver-safety-feedback');
    if (feedbackEl) {
      if (score >= 95) feedbackEl.textContent = 'Exceptional driving! Keep up the great safety standards.';
      else if (score >= 85) feedbackEl.textContent = 'Good safety record. Stay alert on the road.';
      else if (score >= 70) feedbackEl.textContent = 'Average safety rating. Minor improvements recommended.';
      else feedbackEl.textContent = 'Caution: Please review driving safety guidelines.';
    }

    const myTrips = state.trips.filter(t => t.driver_id === myDriver.id);
    const activeTrip = myTrips.find(t => t.status === 'Active' || t.status === 'Dispatched' || t.status === 'Draft');
    
    const activeTripContainer = document.getElementById('driver-portal-active-trip-container');
    const vehicleModelEl = document.getElementById('driver-vehicle-model');
    const vehicleRegEl = document.getElementById('driver-vehicle-reg');
    const vehicleTypeEl = document.getElementById('driver-vehicle-type');
    const vehicleOdometerEl = document.getElementById('driver-vehicle-odometer');

    if (activeTrip) {
      const assignedVehicle = state.vehicles.find(v => v.registration_number === activeTrip.vehicle_id);

      if (assignedVehicle) {
        vehicleModelEl.textContent = assignedVehicle.name || assignedVehicle.model || '-';
        vehicleRegEl.textContent = assignedVehicle.registration_number || '-';
        vehicleTypeEl.textContent = assignedVehicle.type || '-';
        vehicleOdometerEl.textContent = `${(assignedVehicle.odometer || 0).toLocaleString()} km`;
      } else {
        vehicleModelEl.textContent = '-';
        vehicleRegEl.textContent = activeTrip.vehicle_id || '-';
        vehicleTypeEl.textContent = '-';
        vehicleOdometerEl.textContent = '-';
      }

      const odo = assignedVehicle ? assignedVehicle.odometer : 0;
      activeTripContainer.innerHTML = `
        <div class="active-trip-card" style="display: flex; flex-direction: column; gap: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 18px; font-weight: 600; color: var(--text-main);">Trip #${activeTrip.id}</span>
            <span class="badge ${activeTrip.status.toLowerCase()}">${activeTrip.status}</span>
          </div>
          
          <div class="route-visualizer" style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; margin: 5px 0;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Origin</span>
              <strong style="color: var(--text-main); font-size: 15px;">${activeTrip.source}</strong>
            </div>
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; position: relative; margin: 0 15px; min-width: 60px;">
              <div style="height: 1px; background: var(--border-color); width: 100%; position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;"></div>
              <div style="z-index: 2; background: var(--bg-sidebar); padding: 0 8px; color: var(--color-ontrip);">
                <i data-lucide="navigation" style="transform: rotate(90deg); width: 16px; height: 16px; display: inline-block;"></i>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; text-align: right;">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Destination</span>
              <strong style="color: var(--text-main); font-size: 15px;">${activeTrip.destination}</strong>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; text-align: center;">
              <span style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Cargo Load</span>
              <strong style="font-size: 14px; color: var(--text-main);">${activeTrip.cargo_weight} kg</strong>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; text-align: center;">
              <span style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Est. Distance</span>
              <strong style="font-size: 14px; color: var(--text-main);">${activeTrip.planned_distance} km</strong>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; text-align: center;">
              <span style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Pay/Revenue</span>
              <strong style="font-size: 14px; color: var(--color-available);">$${activeTrip.revenue}</strong>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 10px;">
            ${activeTrip.status === 'Draft' ? `
              <button class="btn btn-primary" onclick="driverPortalDispatch(${activeTrip.id})" style="flex: 1;">
                <i data-lucide="play"></i><span>Start Trip</span>
              </button>
            ` : ''}
            ${activeTrip.status === 'Dispatched' || activeTrip.status === 'Active' ? `
              <button class="btn btn-primary" onclick="driverPortalComplete(${activeTrip.id}, ${odo})" style="flex: 1; background: var(--color-available); border-color: var(--color-available);">
                <i data-lucide="check-circle"></i><span>Complete Trip</span>
              </button>
            ` : ''}
            <button class="btn btn-outline" onclick="openDriverLogFuel('${activeTrip.vehicle_id}', ${activeTrip.id})" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; font-size: 13px;">
              <i data-lucide="droplet"></i><span>Fuel</span>
            </button>
            <button class="btn btn-outline" onclick="openDriverLogExpense('${activeTrip.vehicle_id}', ${activeTrip.id})" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; font-size: 13px;">
              <i data-lucide="receipt"></i><span>Expense</span>
            </button>
          </div>
        </div>
      `;
    } else {
      vehicleModelEl.textContent = '-';
      vehicleRegEl.textContent = '-';
      vehicleTypeEl.textContent = '-';
      vehicleOdometerEl.textContent = '-';
      
      activeTripContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 15px;">
          <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
            <i data-lucide="coffee" style="width: 24px; height: 24px;"></i>
          </div>
          <div>
            <h4 style="margin: 0; font-size: 15px; color: var(--text-main);">No Active Assignments</h4>
            <p style="margin: 4px 0 0 0; font-size: 12px;">You are currently off-duty with no active trips. Enjoy your rest!</p>
          </div>
        </div>
      `;
    }

    const pastTrips = myTrips.filter(t => t.status === 'Completed' || t.status === 'Cancelled');
    const pastTripsBody = document.getElementById('driver-portal-past-trips');
    if (pastTrips.length > 0) {
      pastTripsBody.innerHTML = pastTrips.map(t => `
        <tr>
          <td>#${t.id}</td>
          <td>
            <div style="display: flex; flex-direction: column;">
              <strong>${t.source} &rarr; ${t.destination}</strong>
              <span style="font-size: 11px; color: var(--text-muted);">${t.planned_distance} km</span>
            </div>
          </td>
          <td>${t.vehicle_id}</td>
          <td>${t.cargo_weight} kg</td>
          <td><span class="badge ${t.status.toLowerCase()}">${t.status}</span></td>
        </tr>
      `).join('');
    } else {
      pastTripsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No past trips recorded.</td></tr>`;
    }

    // Load Fuel logs and Expenses for the logged in driver
    state.fuelLogs = await apiJSONCall('/fuel');
    state.expenses = await apiJSONCall('/expenses');

    // Scoping check: Current active trip if any, else previous trip
    let targetTripId = null;
    let targetTripScopeLabel = 'No active or past trips found';

    if (activeTrip) {
      targetTripId = activeTrip.id;
      targetTripScopeLabel = `Active Trip #${activeTrip.id} (${activeTrip.source} &rarr; ${activeTrip.destination})`;
    } else if (pastTrips.length > 0) {
      const previousTrip = pastTrips[0]; // pastTrips is reversed (newest first)
      targetTripId = previousTrip.id;
      targetTripScopeLabel = `Previous Trip #${previousTrip.id} (${previousTrip.source} &rarr; ${previousTrip.destination})`;
    }

    const scopeEl = document.getElementById('driver-logged-costs-trip-scope');
    if (scopeEl) {
      scopeEl.innerHTML = `Showing costs for: <strong>${targetTripScopeLabel}</strong>`;
    }

    const myFuelLogs = state.fuelLogs.filter(f => f.logged_by === state.currentUser.email && f.trip_id === targetTripId);
    const myExpenses = state.expenses.filter(e => e.logged_by === state.currentUser.email && e.trip_id === targetTripId);

    // Calculate total cost logged by this driver
    const totalFuelCost = myFuelLogs.reduce((sum, f) => sum + f.cost, 0);
    const totalExpenseCost = myExpenses.reduce((sum, e) => sum + e.cost, 0);
    const totalDriverCost = totalFuelCost + totalExpenseCost;

    const loggedSummaryEl = document.getElementById('driver-logged-costs-summary');
    if (loggedSummaryEl) {
      loggedSummaryEl.textContent = `Total: ₹${totalDriverCost.toLocaleString()}`;
    }

    // Render Fuel Logs Table
    const fuelBody = document.getElementById('driver-portal-fuel-logs');
    if (fuelBody) {
      if (myFuelLogs.length > 0) {
        fuelBody.innerHTML = myFuelLogs.map(f => `
          <tr>
            <td>${f.date}</td>
            <td><strong>${f.vehicle_id}</strong></td>
            <td>${f.liters} L</td>
            <td>₹${f.cost.toLocaleString()}</td>
            <td>${f.trip_id ? `#${f.trip_id}` : '-'}</td>
          </tr>
        `).join('');
      } else {
        fuelBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No fuel logs recorded.</td></tr>`;
      }
    }

    // Render Expenses Table
    const expensesBody = document.getElementById('driver-portal-expenses');
    if (expensesBody) {
      if (myExpenses.length > 0) {
        expensesBody.innerHTML = myExpenses.map(e => `
          <tr>
            <td>${e.date}</td>
            <td><strong>${e.vehicle_id}</strong></td>
            <td><span class="badge ${e.type.toLowerCase().replace(/\s+/g, '')}">${e.type}</span></td>
            <td>₹${e.cost.toLocaleString()}</td>
            <td>${e.description}</td>
            <td>${e.trip_id ? `#${e.trip_id}` : '-'}</td>
          </tr>
        `).join('');
      } else {
        expensesBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No other expenses recorded.</td></tr>`;
      }
    }

    lucide.createIcons();
  } catch (err) {
    showToast(`Error loading driver portal: ${err.message}`, 'error');
  }
}

function getActiveTripForCurrentDriver() {
  if (!state.currentUser || !state.drivers || !state.trips) return null;
  const cleanUserName = state.currentUser.name.replace(/\s*\(Driver\)\s*/i, '').trim().toLowerCase();
  const myDriver = state.drivers.find(d => d.name.toLowerCase() === cleanUserName);
  if (!myDriver) return null;
  return state.trips.find(t => t.driver_id === myDriver.id && (t.status === 'Active' || t.status === 'Dispatched' || t.status === 'Draft'));
}

function openDriverLogFuel(vehicleId, tripId) {
  setupExpenseFormDropdowns('fuel-vehicle');
  const select = document.getElementById('fuel-vehicle');
  select.value = vehicleId;
  select.disabled = !!vehicleId;
  document.getElementById('fuel-trip-id').value = tripId || '';
  document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('fuel-liters').value = '';
  document.getElementById('fuel-cost').value = '';
  openModal('modal-fuel');
}

function openDriverLogExpense(vehicleId, tripId) {
  setupExpenseFormDropdowns('expense-vehicle');
  const select = document.getElementById('expense-vehicle');
  select.value = vehicleId;
  select.disabled = !!vehicleId;
  document.getElementById('expense-trip-id').value = tripId || '';
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('expense-cost').value = '';
  document.getElementById('expense-desc').value = '';
  openModal('modal-expense');
}

async function driverPortalDispatch(id) {
  await dispatchTrip(id);
  await loadDriverPortalData();
}

async function driverPortalComplete(id, odometerStart) {
  openCompleteTripModal(id, odometerStart);
}

// Driver logged costs tab switcher
window.switchDriverCostTab = function(tabName) {
  const tabs = document.querySelectorAll('.driver-cost-tab-btn');
  const contents = document.querySelectorAll('.driver-cost-tab-content');
  
  tabs.forEach(btn => {
    if (btn.id === `btn-driver-cost-tab-${tabName}`) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  contents.forEach(content => {
    if (content.id === `driver-cost-content-${tabName}`) {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  });
};
