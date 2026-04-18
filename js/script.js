/**
 * AutoInsureX — Full-Stack Application Logic
 * ==========================================
 * Data is persisted in localStorage during the step-by-step flow until 
 * authentication, then pushed to the backend. JWT is used for authorization.
 */

const API_BASE = 'http://localhost:3000/api';

/* ====================================================================
   UTILITY :  localStorage helpers
   ==================================================================== */
function saveDTO(key, dto) { localStorage.setItem(key, JSON.stringify(dto)); }
function loadDTO(key) { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
function removeDTO(key) { localStorage.removeItem(key); }
function getToken() { return localStorage.getItem('aix_token'); }
function setToken(token) { localStorage.setItem('aix_token', token); }

async function fetchJSON(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(API_BASE + endpoint, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

/* ====================================================================
   STEPPER
   ==================================================================== */
function initStepper(currentStep) {
  const steps = document.querySelectorAll('.stepper-step');
  const lines = document.querySelectorAll('.stepper-line');
  steps.forEach((el, i) => {
    const stepNum = i + 1;
    if (stepNum < currentStep) { el.classList.add('done'); el.classList.remove('active'); }
    else if (stepNum === currentStep) { el.classList.add('active'); el.classList.remove('done'); }
    else { el.classList.remove('active', 'done'); }
  });
  lines.forEach((el, i) => { if (i + 1 < currentStep) el.classList.add('done'); else el.classList.remove('done'); });
}

/* ====================================================================
   PAGE 1 — Landing (index.html)
   ==================================================================== */
function initLandingPage() {
  initStepper(1);
  const form = document.getElementById('regForm');
  const input = document.getElementById('regNumber');
  const error = document.getElementById('regError');

  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const value = input.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const regex = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
    if (!regex.test(value)) {
      input.classList.add('is-invalid');
      error.style.display = 'block';
      return;
    }
    input.classList.remove('is-invalid');
    error.style.display = 'none';

    saveDTO('aix_registration', { registrationNumber: value });
    window.location.href = 'vehicle.html';
  });
}

/* ====================================================================
   PAGE 2 — Vehicle Details (vehicle.html)
   ==================================================================== */
function initVehiclePage() {
  initStepper(2);
  const reg = loadDTO('aix_registration');
  if (!reg) return window.location.href = 'index.html';

  const regDisplay = document.getElementById('regDisplay');
  if (regDisplay) regDisplay.textContent = reg.registrationNumber;

  const form = document.getElementById('vehicleForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const type = document.getElementById('vehicleType').value;
    const brand = document.getElementById('vehicleBrand').value;
    const model = document.getElementById('vehicleModel').value.trim();
    const year = document.getElementById('vehicleYear').value;

    if (!type || !brand || !model || !year) return alert('Please fill all vehicle details.');

    const vehicleDTO = { registration_number: reg.registrationNumber, type, brand, model, year: parseInt(year, 10) };
    saveDTO('aix_vehicle', vehicleDTO);
    window.location.href = 'plans.html';
  });
}

/* ====================================================================
   PAGE 3 — Insurance Plans (plans.html)
   ==================================================================== */
async function initPlansPage() {
  initStepper(3);
  if (!loadDTO('aix_vehicle')) return window.location.href = 'index.html';

  const container = document.getElementById('plansContainer');
  const compareBtn = document.getElementById('compareBtn');
  const countBadge = document.getElementById('selectedCount');
  if (!container || !compareBtn) return;

  let selected = new Set();
  let vehicleCode = loadDTO('aix_vehicle').type;
  if (vehicleCode === 'Two-Wheeler') {
    vehicleCode = 'Two Wheeler';
  } else {
    vehicleCode = 'Four Wheeler';
  }
  
  try {
    const plans = await fetchJSON('/policies?vehicleType=' + encodeURIComponent(vehicleCode));
    saveDTO('global_plans', plans); // save for next page

    plans.forEach(plan => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4 mb-4';
      const stars = '★'.repeat(Math.floor(plan.rating)) + (plan.rating % 1 >= 0.5 ? '½' : '');

      col.innerHTML = `
        <div class="plan-card" id="plan-${plan.id}">
          <div class="plan-provider">${plan.provider_name}</div>
          <div class="plan-name">${plan.plan_name}</div>
          <span class="plan-type-badge">${plan.plan_type}</span>
          <div class="plan-rating">${stars} ${plan.rating}</div>
          <div class="plan-price">₹${plan.annual_premium.toLocaleString('en-IN')} <span>/ ${plan.duration_months} mo</span></div>
          <div class="plan-coverage">Coverage up to ₹${plan.coverage_amount.toLocaleString('en-IN')}</div>
          <ul class="plan-highlights">
            ${plan.highlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
          <button class="aix-btn aix-btn-outline aix-btn-block toggle-compare" data-id="${plan.id}">Add to Compare</button>
        </div>`;
      container.appendChild(col);
    });
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Failed to load policies: ${err.message}</p>`;
  }

  container.addEventListener('click', e => {
    const btn = e.target.closest('.toggle-compare');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const card = document.getElementById('plan-' + id);

    if (selected.has(id)) {
      selected.delete(id);
      btn.textContent = 'Add to Compare';
      btn.classList.remove('selected');
      card.classList.remove('selected');
    } else {
      selected.add(id);
      btn.textContent = '✓ Selected';
      btn.classList.add('selected');
      card.classList.add('selected');
    }
    const count = selected.size;
    countBadge.textContent = count;
    compareBtn.disabled = count < 2;
  });

  compareBtn.addEventListener('click', () => {
    saveDTO('aix_compare', { planIds: Array.from(selected) });
    window.location.href = 'compare.html';
  });
}

/* ====================================================================
   PAGE 4 — Compare Plans (compare.html)
   ==================================================================== */
function initComparePage() {
  initStepper(4);
  const compareReq = loadDTO('aix_compare');
  const allPlans = loadDTO('global_plans');
  if (!compareReq || compareReq.planIds.length < 2 || !allPlans) return window.location.href = 'plans.html';

  const plans = allPlans.filter(p => compareReq.planIds.includes(p.id));
  const thead = document.getElementById('compareThead');
  const tbody = document.getElementById('compareTbody');
  
  if (!thead || !tbody) return;

  let headerHTML = '<th>Feature</th>';
  plans.forEach(p => headerHTML += `<th>${p.plan_name}<br><small style="font-weight:400;opacity:.7">${p.provider_name}</small></th>`);
  thead.innerHTML = `<tr>${headerHTML}</tr>`;

  const attributes = [
    { label: 'Plan Type', key: p => p.plan_type },
    { label: 'Annual Premium', key: p => '₹' + p.annual_premium.toLocaleString('en-IN') },
    { label: 'Coverage Amount', key: p => '₹' + p.coverage_amount.toLocaleString('en-IN') },
    { label: 'Duration', key: p => p.duration_months + ' months' },
    { label: 'Rating', key: p => '★ ' + p.rating + ' / 5' },
    { label: 'Highlight 1', key: p => p.highlights[0] || '—' },
    { label: 'Highlight 2', key: p => p.highlights[1] || '—' },
    { label: 'Highlight 3', key: p => p.highlights[2] || '—' }
  ];

  let bodyHTML = '';
  attributes.forEach(attr => {
    bodyHTML += `<tr><td class="attr-label">${attr.label}</td>`;
    plans.forEach(p => bodyHTML += `<td>${attr.key(p)}</td>`);
    bodyHTML += `</tr>`;
  });
  tbody.innerHTML = bodyHTML;

  const proceedBtn = document.getElementById('proceedBtn');
  const planSelect = document.getElementById('planSelect');

  if (planSelect) {
    plans.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.plan_name} — ₹${p.annual_premium.toLocaleString('en-IN')}`;
      planSelect.appendChild(opt);
    });
  }

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      const chosenId = planSelect ? planSelect.value : plans[0].id;
      const chosen = plans.find(p => p.id === chosenId);
      saveDTO('aix_selectedPlan', chosen);
      window.location.href = getToken() ? 'payment.html' : 'login.html';
    });
  }
}

/* ====================================================================
   REGISTER (register.html)
   ==================================================================== */
function initRegisterPage() {
  initStepper(1);
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      full_name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      password: document.getElementById('regPassword').value,
    };
    
    try {
      await fetchJSON('/register', 'POST', body);
      alert('Registration successful! Please login.');
      window.location.href = 'login.html';
    } catch (err) {
      alert(err.message);
    }
  });
}

/* ====================================================================
   LOGIN (login.html)
   ==================================================================== */
function initLoginPage() {
  initStepper(5);
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    try {
      const resp = await fetchJSON('/login', 'POST', { email, password: pass });
      setToken(resp.token);
      saveDTO('aix_user', resp.user);
      
      if (resp.user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = loadDTO('aix_selectedPlan') ? 'payment.html' : 'dashboard.html';
      }
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  });
}

/* ====================================================================
   PAYMENT (payment.html)
   ==================================================================== */
async function initPaymentPage() {
  initStepper(6);
  const plan = loadDTO('aix_selectedPlan');
  const user = loadDTO('aix_user');
  const vehicle = loadDTO('aix_vehicle');

  if (!plan || !user || !vehicle) return window.location.href = 'index.html';

  document.getElementById('payPlanName').textContent = plan.plan_name;
  document.getElementById('payProvider').textContent = plan.provider_name;
  document.getElementById('payPremium').textContent = '₹' + plan.annual_premium.toLocaleString('en-IN');
  document.getElementById('payCoverage').textContent = '₹' + plan.coverage_amount.toLocaleString('en-IN');
  document.getElementById('payDuration').textContent = plan.duration_months + ' months';
  document.getElementById('payUserName').textContent = user.full_name;
  document.getElementById('payUserEmail').textContent = user.email;
  document.getElementById('payVehicle').textContent = `${vehicle.brand} ${vehicle.model} (${vehicle.year})`;
  document.getElementById('payRegNo').textContent = vehicle.registration_number;

  const gst = Math.round(plan.annual_premium * 0.18);
  const total = plan.annual_premium + gst;
  document.getElementById('payGST').textContent = '₹' + gst.toLocaleString('en-IN');
  document.getElementById('payTotal').textContent = '₹' + total.toLocaleString('en-IN');

  const payBtn = document.getElementById('payNowBtn');
  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      try {
        payBtn.disabled = true;
        payBtn.textContent = 'Processing...';

        // Show simulated payment gateway overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;flex-direction:column;font-family:sans-serif;';
        overlay.innerHTML = `
          <div style="background:var(--card-bg);color:var(--text-color);padding:3rem;border-radius:12px;text-align:center;max-width:400px;width:90%;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom:1rem;font-weight:700;">Secure Payment Gateway</h3>
            <p>Processing payment of <strong>₹${total.toLocaleString('en-IN')}</strong>...</p>
            <div style="margin:2rem 0;font-size:2.5rem;animation:spin 1.5s linear infinite;">⏳</div>
            <p style="font-size:0.9rem;color:var(--text-muted);">Confirming with the bank. Please do not refresh.</p>
          </div>
          <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);

        // 1. Save vehicle to backend
        const vehResp = await fetchJSON('/vehicle', 'POST', vehicle);
        
        // 2. Process purchase
        const payResp = await fetchJSON('/purchase', 'POST', {
          policy_id: plan.id,
          vehicle_id: vehResp.vehicleId,
          amount_paid: total
        });

        // Simulate a short network/bank delay for effect
        setTimeout(() => {
          overlay.innerHTML = `
            <div style="background:var(--card-bg);color:var(--text-color);padding:3rem;border-radius:12px;text-align:center;max-width:400px;width:90%;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
              <div style="font-size:3.5rem;color:#10b981;margin-bottom:1rem;">✅</div>
              <h3 style="margin-bottom:0.5rem;font-weight:700;">Payment Successful!</h3>
              <p>Order ID: <strong>${payResp.orderId}</strong></p>
              <p style="margin-top:1.5rem;font-size:0.9rem;color:var(--text-muted);"><span style="animation:pulse 1s infinite alternate;">Redirecting to document upload...</span></p>
              <style>@keyframes pulse { to { opacity: 0.5; } }</style>
            </div>
          `;
          saveDTO('aix_payment', { orderId: payResp.orderId, amountPaid: total });
          
          setTimeout(() => {
            window.location.href = 'upload.html';
          }, 2500);
        }, 1500);

      } catch (err) {
        alert('Error processing purchase: ' + err.message);
        if(document.body.lastChild.style && document.body.lastChild.style.zIndex == "9999") {
            document.body.removeChild(document.body.lastChild);
        }
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Now';
      }
    });
  }
}

/* ====================================================================
   UPLOAD VIDEO (upload.html)
   ==================================================================== */
function initUploadPage() {
  initStepper(7);
  const payment = loadDTO('aix_payment');
  if (!payment) return window.location.href = 'index.html';

  const fileInput = document.getElementById('videoFile');
  const zone = document.getElementById('uploadZone');
  const fileName = document.getElementById('fileName');
  const submitBtn = document.getElementById('uploadSubmitBtn');

  if (!fileInput || !submitBtn) return;
  if (zone) zone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileName.textContent = '📁 ' + fileInput.files[0].name;
      fileName.style.display = 'block';
      submitBtn.disabled = false;
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (fileInput.files.length === 0) return alert('Select a video file first.');
    const formData = new FormData();
    formData.append('videoFile', fileInput.files[0]);
    formData.append('orderId', payment.orderId);

    const token = getToken();
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      const res = await fetch(API_BASE + '/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.location.href = 'status.html';
    } catch (err) {
      alert('Upload failed: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Video';
    }
  });
}

/* ====================================================================
   STATUS (status.html)
   ==================================================================== */
async function initStatusPage() {
  initStepper(8);
  const user = loadDTO('aix_user');
  
  if (user && user.role !== 'admin') {
     document.getElementById('aix-navbar').innerHTML += '<li><a class="nav-link" href="dashboard.html">Dashboard</a></li>';
  }

  try {
    const list = await fetchJSON('/user/purchases');
    if (list && list.length > 0) {
      const latest = list[0]; // Most recent purchase
      const sIcon = document.getElementById('statusIcon');
      const sTitle = document.getElementById('statusTitle');
      const sSub = document.getElementById('statusSub');
      const sDetails = document.getElementById('statusDetails');

      const sActions = document.getElementById('statusActions');

      if (latest.status === 'ACTIVE') {
        sIcon.innerHTML = '✅';
        sIcon.className = 'aix-status-icon success';
        sIcon.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        sTitle.textContent = 'Policy Active!';
        sSub.textContent = 'Your verification was approved. You are protected!';
        
        sActions.innerHTML = `
          <button id="downloadPdfBtn" class="aix-btn aix-btn-primary" style="margin-right:10px;">📄 Download Policy (PDF)</button>
          <a href="dashboard.html" class="aix-btn aix-btn-outline">Go to Dashboard →</a>
        `;
        document.getElementById('downloadPdfBtn').addEventListener('click', () => {
          downloadPolicyPDF(latest, user);
        });
      } else if (latest.status === 'REJECTED') {
        sIcon.innerHTML = '❌';
        sIcon.className = 'aix-status-icon';
        sIcon.style.color = 'var(--danger)';
        sIcon.style.background = 'var(--danger-light)';
        sIcon.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        sTitle.textContent = 'Verification Rejected';
        sSub.textContent = 'Your video did not meet our criteria. Please contact support.';
        
        sActions.innerHTML = `<a href="index.html" class="aix-btn aix-btn-outline">← Start Over</a>`;
      } else {
        sIcon.innerHTML = '⏳';
        sIcon.className = 'aix-status-icon pending';
        sTitle.textContent = 'Verification Pending';
        sSub.textContent = 'Our team is reviewing your video and documents…';
        
        sActions.innerHTML = `<a href="dashboard.html" class="aix-btn aix-btn-outline">Go to Dashboard →</a>`;
      }

      sDetails.innerHTML = `
        <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; margin-top:1rem; font-size:0.9rem; text-align:left; border: 1px solid var(--border-color);">
          <div style="margin-bottom:0.3rem"><strong>Order ID:</strong> ${latest.order_id}</div>
          <div style="margin-bottom:0.3rem"><strong>Plan:</strong> ${latest.plan_name} (${latest.provider_name})</div>
          <div><strong>Vehicle:</strong> ${latest.registration_number}</div>
        </div>
      `;
    }
  } catch (e) {
    console.error('Failed to load status:', e);
  }
}

function downloadPolicyPDF(purchase, user) {
  // Create hidden template
  const element = document.createElement('div');
  element.style.padding = '40px';
  element.style.fontFamily = 'Helvetica, Arial, sans-serif';
  element.style.color = '#333';
  element.innerHTML = `
    <div style="text-align:center; padding-bottom: 20px; border-bottom: 2px solid #0ea5e9; margin-bottom: 30px;">
      <h1 style="color: #1e293b; margin: 0; font-size: 28px;">Auto<span style="color:#0ea5e9;">InsureX</span></h1>
      <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Official Certificate of Insurance</p>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 30px; font-size: 14px;">
      <div>
        <p><strong>Insured Name:</strong> ${user.full_name}</p>
        <p><strong>Email Address:</strong> ${user.email}</p>
        <p><strong>Order ID:</strong> ${purchase.order_id}</p>
      </div>
      <div style="text-align:right;">
        <p><strong>Issue Date:</strong> ${new Date(purchase.purchase_date).toLocaleDateString()}</p>
        <p><strong>Status:</strong> <span style="color:#059669; font-weight:bold;">ACTIVE</span></p>
      </div>
    </div>
    <div style="background:#f8fafc; padding:20px; border-radius:8px; border: 1px solid #e2e8f0; margin-bottom:30px;">
      <h3 style="margin-top:0; color:#0f172a;">Vehicle & Coverage Details</h3>
      <table style="width:100%; font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding:8px 0; border-bottom:1px solid #e2e8f0; width:40%;"><strong>Registration Number:</strong></td><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;">${purchase.registration_number}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;"><strong>Make & Model:</strong></td><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;">${purchase.brand} ${purchase.model}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;"><strong>Insurance Provider:</strong></td><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;">${purchase.provider_name}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;"><strong>Plan Selected:</strong></td><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;">${purchase.plan_name}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #e2e8f0;"><strong>Premium Paid:</strong></td><td style="padding:8px 0; border-bottom:1px solid #e2e8f0; font-weight:bold;">₹${purchase.amount_paid.toLocaleString('en-IN')}</td></tr>
      </table>
    </div>
    <div style="text-align:center; font-size:12px; color:#94a3b8; margin-top:50px;">
      <p>This is a digitally generated document and requires no physical signature.<br>For verification, please contact support@autoinsurex.com.</p>
    </div>
  `;

  // html2pdf options
  const opt = {
    margin:       0.5,
    filename:     `AutoInsureX_Policy_${purchase.order_id}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save();
  } else {
    alert("PDF library is still loading. Please try again in a few seconds.");
  }
}

/* ====================================================================
   DASHBOARD (dashboard.html)
   ==================================================================== */
async function initDashboardPage() {
  const user = loadDTO('aix_user');
  if (!user) return window.location.href = 'login.html';
  document.getElementById('userWelcome').textContent = `Welcome back, ${user.full_name}!`;

  setupLogout();

  const container = document.getElementById('purchasesContainer');
  try {
    const purchases = await fetchJSON('/user/purchases');
    if (purchases.length === 0) {
      container.innerHTML = '<p>You have not purchased any policies yet.</p>';
      return;
    }
    
    let html = '';
    purchases.forEach(p => {
      let badgeClass = p.status === 'ACTIVE' ? 'badge-active' : (p.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending');
      html += `
        <div class="policy-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
            <div>
              <h5 style="margin:0">${p.plan_name} (${p.provider_name})</h5>
              <small class="text-muted">Order ID: ${p.order_id} • Paid: ₹${p.amount_paid.toLocaleString('en-IN')} • Date: ${new Date(p.purchase_date).toLocaleDateString()}</small>
            </div>
            <span class="badge-status ${badgeClass}">${p.status.replace('_', ' ')}</span>
          </div>
          <div>
            <strong>Vehicle:</strong> ${p.brand} ${p.model} (${p.registration_number})
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Failed to load purchases: ${err.message}</p>`;
  }
}

/* ====================================================================
   ADMIN (admin.html)
   ==================================================================== */
async function initAdminPage() {
  const user = loadDTO('aix_user');
  if (!user || user.role !== 'admin') return window.location.href = 'index.html';
  setupLogout();

  const tbody = document.getElementById('adminPurchasesTbody');
  try {
    const list = await fetchJSON('/admin/purchases');
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No purchases found.</td></tr>';
      return;
    }
    
    let html = '';
    list.forEach(p => {
      let badgeClass = p.status === 'ACTIVE' ? 'badge-active' : (p.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending');
      html += `
        <tr>
          <td>${p.order_id}</td>
          <td>${p.full_name}<br><small>${p.email}</small></td>
          <td>${p.registration_number}<br><small>${p.brand} ${p.model}</small></td>
          <td>${p.plan_name}<br><small>${p.provider_name}</small></td>
          <td>₹${p.amount_paid.toLocaleString('en-IN')}</td>
          <td><span class="badge-status ${badgeClass}">${p.status}</span></td>
          <td>${p.video_path ? `<a href="http://localhost:3000/${p.video_path}" target="_blank">View Video</a>` : 'No Video'}</td>
          <td>
            ${p.status.includes('PENDING') ? `
              <button class="aix-btn aix-btn-primary action-btn" onclick="verifyAction(${p.id}, 'APPROVE')">Approve</button>
              <button class="aix-btn aix-btn-outline action-btn" style="color:var(--danger);border-color:var(--danger);" onclick="verifyAction(${p.id}, 'REJECT')">Reject</button>
            ` : p.status === 'ACTIVE' ? `
              <button class="aix-btn aix-btn-outline action-btn" style="color:var(--warning);border-color:var(--warning);" onclick="sendReminder('${p.full_name}', '${p.phone}', '${p.plan_name}')">Send Expiry SMS</button>
            ` : '—'}
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger">${err.message}</td></tr>`;
  }
}

window.verifyAction = async function(id, action) {
  if (!confirm(`Are you sure you want to ${action} this policy?`)) return;
  try {
    const res = await fetchJSON('/admin/verify', 'POST', { purchaseId: id, action });
    alert(res.message);
    initAdminPage(); // reload table
  } catch (err) {
    alert('Action failed: ' + err.message);
  }
};

window.sendReminder = function(name, phone, planName) {
  if (!confirm(`Send automated SMS/Email expiry reminder to ${name} (${phone})?`)) return;
  
  // Simulate network delay for sending SMS API
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;
  
  setTimeout(() => {
    btn.textContent = 'SMS Sent ✅';
    btn.style.borderColor = 'var(--success)';
    btn.style.color = 'var(--success)';
    alert(`[SYSTEM MOCK SMS]\n\nTO: ${phone}\nMessage: "Dear ${name}, your AutoInsureX policy '${planName}' is expiring in 15 days. Please click the link to renew it instantly and save your No-Claim Bonus."`);
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.style.borderColor = 'var(--warning)';
      btn.style.color = 'var(--warning)';
    }, 4000);
  }, 1200);
};

/* ====================================================================
   COMMON
   ==================================================================== */
function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    btn.addEventListener('click', e => {
      e.preventDefault();
      removeDTO('aix_token');
      removeDTO('aix_user');
      window.location.href = 'index.html';
    });
  }
}

/* ====================================================================
   VEHI-BOT: Global Chatbot Component
   ==================================================================== */
function initChatbot() {
  // Only inject if not already present
  if (document.getElementById('vehiBotBubble')) return;

  const bubble = document.createElement('div');
  bubble.id = 'vehiBotBubble';
  bubble.className = 'chatbot-bubble';
  bubble.innerHTML = '🤖';
  document.body.appendChild(bubble);

  const win = document.createElement('div');
  win.id = 'vehiBotWindow';
  win.className = 'chatbot-window';
  win.innerHTML = `
    <div class="chatbot-header">
      <div class="chatbot-title">🤖 vehi-Bot <span class="pulse"></span></div>
      <button class="aix-btn aix-btn-outline" style="padding:0.2rem 0.5rem;font-size:0.7rem;" onclick="document.getElementById('vehiBotWindow').classList.remove('open')">✖</button>
    </div>
    <div class="chatbot-messages" id="chatMsgs">
      <div class="chat-msg bot">Hi! I'm vehi-Bot. Need help with AutoInsureX? As me anything about zero dep, claims, comparing policies, etc.</div>
    </div>
    <form class="chatbot-input-area" id="chatForm">
      <input type="text" id="chatInput" class="chat-input" placeholder="Type your message..." autocomplete="off" required>
      <button type="submit" class="chat-send-btn">➤</button>
    </form>
  `;
  document.body.appendChild(win);

  bubble.addEventListener('click', () => {
    win.classList.toggle('open');
    if (win.classList.contains('open')) document.getElementById('chatInput').focus();
  });

  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMsgs = document.getElementById('chatMsgs');

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = text;
    chatMsgs.appendChild(userMsg);
    chatInput.value = '';
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    // Show typing status
    const typingMsg = document.createElement('div');
    typingMsg.className = 'chat-msg bot typing';
    typingMsg.innerHTML = '<span style="animation:pulse 1s infinite alternate;">typing...</span>';
    chatMsgs.appendChild(typingMsg);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    try {
      const res = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      chatMsgs.removeChild(typingMsg);
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-msg bot';
      botMsg.textContent = data.reply;
      chatMsgs.appendChild(botMsg);
    } catch (err) {
      chatMsgs.removeChild(typingMsg);
      const errMsg = document.createElement('div');
      errMsg.className = 'chat-msg bot';
      errMsg.textContent = 'Oops! My circuits got tangled. Try again.';
      chatMsgs.appendChild(errMsg);
    }
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  });
}

// Call initChatbot on every page load
document.addEventListener('DOMContentLoaded', initChatbot);

