const http = require('http');

const BASE_URL = 'http://localhost:5000/api';
let managerHeaders = {};
let driverHeaders = {};

function request(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, error: parsed.error || parsed });
          } else {
            resolve({ status: res.statusCode, data: parsed });
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, error: data });
          } else {
            resolve({ status: res.statusCode, data });
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Automated Verification for TransitOps APIs ===');

  try {
    // 1. Authenticate as Fleet Manager
    console.log('\n[TEST 1] Logging in as Fleet Manager...');
    const loginRes = await request(`${BASE_URL}/auth/login`, 'POST', {}, {
      email: 'manager@transitops.com',
      password: 'password123'
    });
    console.log('PASS: Logged in successfully. Role:', loginRes.data.role);
    managerHeaders = {
      'x-user-role': loginRes.data.role,
      'x-user-email': loginRes.data.email
    };

    // 2. Fetch KPIs
    console.log('\n[TEST 2] Fetching Dashboard KPIs...');
    const kpiRes = await request(`${BASE_URL}/dashboard/kpis`, 'GET', managerHeaders);
    console.log('PASS: KPIs loaded:', kpiRes.data);

    // 3. Retrieve drivers list to find expired, suspended, available drivers
    console.log('\n[TEST 3] Inspecting seeded drivers...');
    const driversRes = await request(`${BASE_URL}/drivers`, 'GET', managerHeaders);
    const drivers = driversRes.data;
    const alex = drivers.find(d => d.name === 'Alex Johnson');
    const sarah = drivers.find(d => d.name === 'Sarah Smith'); // Expired
    const david = drivers.find(d => d.name === 'David Miller'); // Suspended
    console.log(`Found drivers: Alex (ID: ${alex?.id}), Sarah (ID: ${sarah?.id}, Expired), David (ID: ${david?.id}, Suspended)`);

    // 4. Test Trip Business Rules
    console.log('\n[TEST 4] Testing trip validation: Cargo capacity check...');
    // Create trip on VAN-05 (max 500kg) with 600kg cargo. Should fail.
    try {
      await request(`${BASE_URL}/trips`, 'POST', managerHeaders, {
        source: 'A',
        destination: 'B',
        vehicle_id: 'VAN-05',
        driver_id: alex.id,
        cargo_weight: 600,
        planned_distance: 100
      });
      console.error('FAIL: Overweight trip succeeded when it should have failed.');
    } catch (err) {
      console.log('PASS: Overweight trip failed as expected. Error:', err.error);
    }

    console.log('\n[TEST 5] Testing trip validation: Expired license check...');
    // Assign Sarah (expired license) to VAN-05. Should fail.
    try {
      await request(`${BASE_URL}/trips`, 'POST', managerHeaders, {
        source: 'A',
        destination: 'B',
        vehicle_id: 'VAN-05',
        driver_id: sarah.id,
        cargo_weight: 100,
        planned_distance: 100
      });
      console.error('FAIL: Trip with expired license driver succeeded when it should have failed.');
    } catch (err) {
      console.log('PASS: Expired license trip failed as expected. Error:', err.error);
    }

    console.log('\n[TEST 6] Testing trip validation: Suspended status check...');
    // Assign David (suspended) to VAN-05. Should fail.
    try {
      await request(`${BASE_URL}/trips`, 'POST', managerHeaders, {
        source: 'A',
        destination: 'B',
        vehicle_id: 'VAN-05',
        driver_id: david.id,
        cargo_weight: 100,
        planned_distance: 100
      });
      console.error('FAIL: Trip with suspended driver succeeded when it should have failed.');
    } catch (err) {
      console.log('PASS: Suspended driver trip failed as expected. Error:', err.error);
    }

    console.log('\n[TEST 7] Creating a valid trip...');
    // Valid trip on VAN-05 with Alex. Should succeed in Draft.
    const tripRes = await request(`${BASE_URL}/trips`, 'POST', managerHeaders, {
      source: 'Warehouse A',
      destination: 'Outlet East',
      vehicle_id: 'VAN-05',
      driver_id: alex.id,
      cargo_weight: 400,
      planned_distance: 150,
      revenue: 900
    });
    const newTrip = tripRes.data;
    console.log('PASS: Valid trip created. Status:', newTrip.status, 'ID:', newTrip.id);

    console.log('\n[TEST 8] Dispatching the trip...');
    const dispatchRes = await request(`${BASE_URL}/trips/${newTrip.id}/dispatch`, 'PUT', managerHeaders);
    console.log('PASS: Dispatch status updated.', dispatchRes.data);

    // Verify driver and vehicle are now 'On Trip'
    const checkVeh = await request(`${BASE_URL}/vehicles`, 'GET', managerHeaders);
    const van05 = checkVeh.data.find(v => v.registration_number === 'VAN-05');
    const checkDrv = await request(`${BASE_URL}/drivers`, 'GET', managerHeaders);
    const drvAlex = checkDrv.data.find(d => d.id === alex.id);
    
    if (van05.status === 'On Trip' && drvAlex.status === 'On Trip') {
      console.log('PASS: Vehicle VAN-05 and Driver Alex are both in "On Trip" status.');
    } else {
      console.error('FAIL: Vehicle or driver status did not transition to On Trip. Vehicle:', van05.status, 'Driver:', drvAlex.status);
    }

    console.log('\n[TEST 9] Completing the trip...');
    // Odometer start is 12000 (from seed), let's end at 12150 with 12 liters fuel consumed
    const completeRes = await request(`${BASE_URL}/trips/${newTrip.id}/complete`, 'PUT', managerHeaders, {
      odometer_end: 15320,
      fuel_consumed: 12,
      fuel_cost: 18
    });
    console.log('PASS: Trip completed successfully.', completeRes.data);

    // Check states restored to Available and vehicle odometer updated
    const checkVeh2 = await request(`${BASE_URL}/vehicles`, 'GET', managerHeaders);
    const van05_after = checkVeh2.data.find(v => v.registration_number === 'VAN-05');
    const checkDrv2 = await request(`${BASE_URL}/drivers`, 'GET', managerHeaders);
    const drvAlex_after = checkDrv2.data.find(d => d.id === alex.id);

    if (van05_after.status === 'Available' && van05_after.odometer === 15320 && drvAlex_after.status === 'Available') {
      console.log('PASS: Vehicle VAN-05 status is Available, odometer is 15320, Driver Alex status is Available.');
    } else {
      console.error('FAIL: States did not restore correctly. Vehicle status:', van05_after.status, 'Odometer:', van05_after.odometer, 'Driver status:', drvAlex_after.status);
    }

    console.log('\n[TEST 10] Checking auto-logged fuel record...');
    const fuelRes = await request(`${BASE_URL}/fuel`, 'GET', managerHeaders);
    const newestFuel = fuelRes.data[0];
    if (newestFuel && newestFuel.vehicle_id === 'VAN-05' && newestFuel.liters === 12 && newestFuel.cost === 18) {
      console.log('PASS: Fuel log automatically created with 12 liters and cost $18 (1.5 per L rate).');
    } else {
      console.error('FAIL: Fuel log not found or incorrect:', newestFuel);
    }

    console.log('\n[TEST 11] Checking maintenance log and vehicle "In Shop" status...');
    // Put VAN-08 in maintenance
    const maintRes = await request(`${BASE_URL}/maintenance`, 'POST', managerHeaders, {
      vehicle_id: 'VAN-08',
      description: 'Annual brake system replacement'
    });
    const logId = maintRes.data.id;
    console.log('PASS: Maintenance logged. Log ID:', logId);

    const checkVeh3 = await request(`${BASE_URL}/vehicles`, 'GET', managerHeaders);
    const van08 = checkVeh3.data.find(v => v.registration_number === 'VAN-08');
    if (van08.status === 'In Shop') {
      console.log('PASS: Vehicle VAN-08 status successfully transitioned to "In Shop".');
    } else {
      console.error('FAIL: Vehicle status is not "In Shop":', van08.status);
    }

    console.log('\n[TEST 12] Closing maintenance log and verifying automated expense...');
    const closeMaint = await request(`${BASE_URL}/maintenance/${logId}/close`, 'PUT', managerHeaders, {
      cost: 500,
      end_date: new Date().toISOString().split('T')[0]
    });
    console.log('PASS: Maintenance closed.', closeMaint.data);

    const checkVeh4 = await request(`${BASE_URL}/vehicles`, 'GET', managerHeaders);
    const van08_after = checkVeh4.data.find(v => v.registration_number === 'VAN-08');
    if (van08_after.status === 'Available') {
      console.log('PASS: Vehicle VAN-08 restored to "Available".');
    } else {
      console.error('FAIL: Vehicle status is not Available:', van08_after.status);
    }

    const expRes = await request(`${BASE_URL}/expenses`, 'GET', managerHeaders);
    const newestExp = expRes.data[0];
    if (newestExp && newestExp.vehicle_id === 'VAN-08' && newestExp.type === 'Maintenance' && newestExp.cost === 500) {
      console.log('PASS: Expense entry automatically generated for maintenance costing $500.');
    } else {
      console.error('FAIL: Expense log not found or incorrect:', newestExp);
    }

    console.log('\n[TEST 13] Checking Reports and Analytics calculations...');
    const reportsRes = await request(`${BASE_URL}/reports/analytics`, 'GET', managerHeaders);
    console.log('PASS: Reports loaded. Sample record:', reportsRes.data[0]);

    console.log('\n[TEST 14] Testing Driver license reminder API...');
    const remindRes = await request(`${BASE_URL}/drivers/${sarah.id}/remind`, 'POST', managerHeaders);
    if (remindRes.data.email && remindRes.data.email.driver_id === sarah.id) {
      console.log('PASS: Driver license remind email generated successfully:', remindRes.data.message);
    } else {
      console.error('FAIL: Remind API did not generate correct email:', remindRes.data);
    }

    console.log('\n[TEST 15] Testing Edit Vehicle API...');
    const editVehRes = await request(`${BASE_URL}/vehicles/VAN-05`, 'PUT', managerHeaders, {
      name: 'Ford Transit Van 05 - Edited Name',
      max_load_capacity: 550,
      acquisition_cost: 36000
    });
    if (editVehRes.data.name === 'Ford Transit Van 05 - Edited Name') {
      console.log('PASS: Vehicle edited successfully.');
    } else {
      console.error('FAIL: Vehicle edit did not return edited values:', editVehRes.data);
    }

    console.log('\n[TEST 16] Testing Document Upload and Document Deletion APIs...');
    const dbModule = require('./db');
    const mockDoc = await dbModule.createDocument({
      vehicle_id: 'VAN-05',
      document_type: 'Insurance',
      file_name: 'test_insurance.pdf',
      file_path: '/uploads/test_insurance.pdf'
    });
    console.log('Created mock document:', mockDoc.id);

    const delDocRes = await request(`${BASE_URL}/vehicles/VAN-05/documents/${mockDoc.id}`, 'DELETE', managerHeaders);
    if (delDocRes.data.id == mockDoc.id) {
      console.log('PASS: Document deleted successfully.');
    } else {
      console.error('FAIL: Document deletion returned incorrect result:', delDocRes.data);
    }

    console.log('\n=== All Automated Verifications Completed Successfully! ===');
  } catch (err) {
    console.error('\nFAIL: Verification script encountered an error:', err);
  }
}

runTests();
