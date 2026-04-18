/**
 * AutoInsureX — Main Application Logic
 * ======================================
 * All data persistence uses localStorage.
 * Objects follow Java DTO naming conventions.
 *
 * FUTURE SCOPE: Each localStorage call is wrapped in a helper
 * so it can be swapped with fetch() calls to a Java Spring Boot backend.
 */

/* ====================================================================
   UTILITY :  localStorage helpers (future REST-API swap point)
   ==================================================================== */

/**
 * Save a DTO to localStorage.
 * FUTURE: Replace with POST /api/v1/{resource}
 */
function saveDTO(key, dto) {
  localStorage.setItem(key, JSON.stringify(dto));
}

/**
 * Load a DTO from localStorage.
 * FUTURE: Replace with GET /api/v1/{resource}/{id}
 */
function loadDTO(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Remove a key from localStorage.
 * FUTURE: Replace with DELETE /api/v1/{resource}/{id}
 */
function removeDTO(key) {
  localStorage.removeItem(key);
}


/* ====================================================================
   STEPPER :  highlight the correct step on each page
   ==================================================================== */

function initStepper(currentStep) {
  const steps = document.querySelectorAll('.stepper-step');
  const lines = document.querySelectorAll('.stepper-line');

  steps.forEach((el, i) => {
    const stepNum = i + 1;
    if (stepNum < currentStep) {
      el.classList.add('done');
      el.classList.remove('active');
    } else if (stepNum === currentStep) {
      el.classList.add('active');
      el.classList.remove('done');
    } else {
      el.classList.remove('active', 'done');
    }
  });

  lines.forEach((el, i) => {
    if (i + 1 < currentStep) {
      el.classList.add('done');
    } else {
      el.classList.remove('done');
    }
  });
}


/* ====================================================================
   PAGE 1 — Landing (index.html)
   ==================================================================== */

function initLandingPage() {
  initStepper(1);

  const form  = document.getElementById('regForm');
  const input = document.getElementById('regNumber');
  const error = document.getElementById('regError');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const value = input.value.trim().toUpperCase();

    // Indian vehicle registration regex:  XX00XX0000  (2-letter state, 2-digit district, 1-2 letter series, 1-4 digit number)
    const regex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{1,4}$/;

    if (!regex.test(value)) {
      input.classList.add('is-invalid');
      error.style.display = 'block';
      return;
    }

    input.classList.remove('is-invalid');
    error.style.display = 'none';

    /** @type {VehicleRegistrationDTO} */
    const registrationDTO = {
      registrationNumber: value,
      submittedAt: new Date().toISOString()
    };

    // FUTURE: POST /api/v1/vehicle/lookup  body: registrationDTO
    saveDTO('aix_registration', registrationDTO);

    window.location.href = 'vehicle.html';
  });
}


/* ====================================================================
   PAGE 2 — Vehicle Details (vehicle.html)
   ==================================================================== */

function initVehiclePage() {
  initStepper(2);

  const reg = loadDTO('aix_registration');
  if (!reg) {
    window.location.href = 'index.html';
    return;
  }

  // Show registration number
  const regDisplay = document.getElementById('regDisplay');
  if (regDisplay) regDisplay.textContent = reg.registrationNumber;

  const form = document.getElementById('vehicleForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Basic validation
    const type  = document.getElementById('vehicleType').value;
    const brand = document.getElementById('vehicleBrand').value;
    const model = document.getElementById('vehicleModel').value.trim();
    const year  = document.getElementById('vehicleYear').value;

    if (!type || !brand || !model || !year) {
      alert('Please fill all vehicle details.');
      return;
    }

    /** @type {VehicleDTO} */
    const vehicleDTO = {
      registrationNumber: reg.registrationNumber,
      vehicleType: type,
      brand: brand,
      model: model,
      manufacturingYear: parseInt(year, 10),
      submittedAt: new Date().toISOString()
    };

    // FUTURE: POST /api/v1/vehicle  body: vehicleDTO
    saveDTO('aix_vehicle', vehicleDTO);

    window.location.href = 'plans.html';
  });
}


/* ====================================================================
   PAGE 3 — Insurance Plans (plans.html)
   ==================================================================== */

function initPlansPage() {
  initStepper(3);

  // Guard: need vehicle data
  if (!loadDTO('aix_vehicle')) {
    window.location.href = 'index.html';
    return;
  }

  const container   = document.getElementById('plansContainer');
  const compareBtn  = document.getElementById('compareBtn');
  const countBadge  = document.getElementById('selectedCount');

  if (!container || !compareBtn) return;

  let selected = new Set();

  // Render plans — data comes from dummyData.js (INSURANCE_PLANS global)
  // FUTURE: GET /api/v1/plans?vehicleType=...
  INSURANCE_PLANS.forEach(function (plan) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';

    const stars = '★'.repeat(Math.floor(plan.rating)) + (plan.rating % 1 >= 0.5 ? '½' : '');

    col.innerHTML =
      '<div class="plan-card" id="plan-' + plan.planId + '">' +
        '<div class="plan-provider">' + plan.providerName + '</div>' +
        '<div class="plan-name">' + plan.planName + '</div>' +
        '<span class="plan-type-badge">' + plan.planType + '</span>' +
        '<div class="plan-rating">' + stars + '  ' + plan.rating + '</div>' +
        '<div class="plan-price">₹' + plan.annualPremium.toLocaleString('en-IN') + ' <span>/ ' + plan.durationMonths + ' mo</span></div>' +
        '<div class="plan-coverage">Coverage up to ₹' + plan.coverageAmount.toLocaleString('en-IN') + '</div>' +
        '<ul class="plan-highlights">' +
          plan.highlights.map(function (h) { return '<li>' + h + '</li>'; }).join('') +
        '</ul>' +
        '<button class="aix-btn aix-btn-outline aix-btn-block toggle-compare" data-id="' + plan.planId + '">' +
          'Add to Compare' +
        '</button>' +
      '</div>';

    container.appendChild(col);
  });

  // Toggle compare selection
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('.toggle-compare');
    if (!btn) return;

    const id   = btn.getAttribute('data-id');
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

    updateCompareButton();
  });

  function updateCompareButton() {
    const count = selected.size;
    countBadge.textContent = count;
    compareBtn.disabled = count < 2;
  }

  compareBtn.addEventListener('click', function () {
    const ids = Array.from(selected);

    /** @type {CompareRequestDTO} */
    const compareRequestDTO = {
      planIds: ids,
      createdAt: new Date().toISOString()
    };

    // FUTURE: POST /api/v1/plans/compare  body: compareRequestDTO
    saveDTO('aix_compare', compareRequestDTO);

    window.location.href = 'compare.html';
  });
}


/* ====================================================================
   PAGE 4 — Compare Plans (compare.html)
   ==================================================================== */

function initComparePage() {
  initStepper(4);

  const compareReq = loadDTO('aix_compare');
  if (!compareReq || !compareReq.planIds || compareReq.planIds.length < 2) {
    window.location.href = 'plans.html';
    return;
  }

  // FUTURE: GET /api/v1/plans/compare?ids=PL001,PL002
  const plans = INSURANCE_PLANS.filter(function (p) {
    return compareReq.planIds.indexOf(p.planId) !== -1;
  });

  const thead = document.getElementById('compareThead');
  const tbody = document.getElementById('compareTbody');
  if (!thead || !tbody) return;

  // Build header
  let headerHTML = '<th>Feature</th>';
  plans.forEach(function (p) {
    headerHTML += '<th>' + p.planName + '<br><small style="font-weight:400;opacity:.7">' + p.providerName + '</small></th>';
  });
  thead.innerHTML = '<tr>' + headerHTML + '</tr>';

  // Attribute rows
  const attributes = [
    { label: 'Plan Type',         key: function (p) { return p.planType; } },
    { label: 'Annual Premium',    key: function (p) { return '₹' + p.annualPremium.toLocaleString('en-IN'); } },
    { label: 'Coverage Amount',   key: function (p) { return '₹' + p.coverageAmount.toLocaleString('en-IN'); } },
    { label: 'Duration',          key: function (p) { return p.durationMonths + ' months'; } },
    { label: 'Rating',            key: function (p) { return '★ ' + p.rating + ' / 5'; } },
    { label: 'Highlight 1',       key: function (p) { return p.highlights[0] || '—'; } },
    { label: 'Highlight 2',       key: function (p) { return p.highlights[1] || '—'; } },
    { label: 'Highlight 3',       key: function (p) { return p.highlights[2] || '—'; } }
  ];

  let bodyHTML = '';
  attributes.forEach(function (attr) {
    bodyHTML += '<tr><td class="attr-label">' + attr.label + '</td>';
    plans.forEach(function (p) {
      bodyHTML += '<td>' + attr.key(p) + '</td>';
    });
    bodyHTML += '</tr>';
  });
  tbody.innerHTML = bodyHTML;

  // Proceed to Buy — pick cheapest as default, or first plan
  const proceedBtn = document.getElementById('proceedBtn');
  const planSelect = document.getElementById('planSelect');

  if (planSelect) {
    plans.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.planId;
      opt.textContent = p.planName + ' — ₹' + p.annualPremium.toLocaleString('en-IN');
      planSelect.appendChild(opt);
    });
  }

  if (proceedBtn) {
    proceedBtn.addEventListener('click', function () {
      const chosenId = planSelect ? planSelect.value : plans[0].planId;
      const chosen = plans.find(function (p) { return p.planId === chosenId; });

      /** @type {SelectedPlanDTO} */
      const selectedPlanDTO = {
        planId: chosen.planId,
        planName: chosen.planName,
        providerName: chosen.providerName,
        annualPremium: chosen.annualPremium,
        coverageAmount: chosen.coverageAmount,
        durationMonths: chosen.durationMonths,
        selectedAt: new Date().toISOString()
      };

      // FUTURE: POST /api/v1/order/select  body: selectedPlanDTO
      saveDTO('aix_selectedPlan', selectedPlanDTO);

      window.location.href = 'login.html';
    });
  }
}


/* ====================================================================
   PAGE 5 — Login (login.html)
   ==================================================================== */

function initLoginPage() {
  initStepper(5);

  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPassword').value;

    if (!email || !pass) {
      alert('Please enter both email and password.');
      return;
    }

    // FUTURE: POST /api/v1/auth/login  body: { email, password }
    // On success, server returns a JWT token inside UserDTO.
    const userDTO = createDummyUserDTO(email);
    saveDTO('aix_user', userDTO);

    window.location.href = 'payment.html';
  });
}


/* ====================================================================
   PAGE 6 — Payment (payment.html)
   ==================================================================== */

function initPaymentPage() {
  initStepper(6);

  const plan    = loadDTO('aix_selectedPlan');
  const user    = loadDTO('aix_user');
  const vehicle = loadDTO('aix_vehicle');

  if (!plan || !user) {
    window.location.href = 'index.html';
    return;
  }

  // Populate summary
  setText('payPlanName', plan.planName);
  setText('payProvider', plan.providerName);
  setText('payPremium', '₹' + plan.annualPremium.toLocaleString('en-IN'));
  setText('payCoverage', '₹' + plan.coverageAmount.toLocaleString('en-IN'));
  setText('payDuration', plan.durationMonths + ' months');
  setText('payUserName', user.fullName);
  setText('payUserEmail', user.email);

  if (vehicle) {
    setText('payVehicle', vehicle.brand + ' ' + vehicle.model + ' (' + vehicle.manufacturingYear + ')');
    setText('payRegNo', vehicle.registrationNumber);
  }

  // Tax calculation (18% GST)
  const gst   = Math.round(plan.annualPremium * 0.18);
  const total = plan.annualPremium + gst;
  setText('payGST', '₹' + gst.toLocaleString('en-IN'));
  setText('payTotal', '₹' + total.toLocaleString('en-IN'));

  const payBtn = document.getElementById('payNowBtn');
  if (payBtn) {
    payBtn.addEventListener('click', function () {
      /** @type {PaymentDTO} */
      const paymentDTO = {
        orderId: 'ORD' + Date.now(),
        planId: plan.planId,
        userId: user.userId,
        amountPaid: total,
        currency: 'INR',
        paymentStatus: 'SUCCESS',
        paidAt: new Date().toISOString()
      };

      // FUTURE: POST /api/v1/payment/process  body: paymentDTO
      saveDTO('aix_payment', paymentDTO);

      alert('Payment of ₹' + total.toLocaleString('en-IN') + ' successful!  Order ID: ' + paymentDTO.orderId);
      window.location.href = 'upload.html';
    });
  }
}


/* ====================================================================
   PAGE 7 — Upload Video (upload.html)
   ==================================================================== */

function initUploadPage() {
  initStepper(7);

  if (!loadDTO('aix_payment')) {
    window.location.href = 'index.html';
    return;
  }

  const fileInput = document.getElementById('videoFile');
  const zone      = document.getElementById('uploadZone');
  const fileName  = document.getElementById('fileName');
  const submitBtn = document.getElementById('uploadSubmitBtn');

  if (!fileInput || !submitBtn) return;

  // Click zone to open file picker
  if (zone) {
    zone.addEventListener('click', function () {
      fileInput.click();
    });
  }

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      fileName.textContent = '📁 ' + fileInput.files[0].name;
      fileName.style.display = 'block';
      submitBtn.disabled = false;
    }
  });

  submitBtn.addEventListener('click', function () {
    if (fileInput.files.length === 0) {
      alert('Please select a video file first.');
      return;
    }

    /** @type {VideoUploadDTO} */
    const videoUploadDTO = {
      fileName: fileInput.files[0].name,
      fileSize: fileInput.files[0].size,
      mimeType: fileInput.files[0].type,
      uploadedAt: new Date().toISOString(),
      status: 'UPLOADED'
    };

    // FUTURE: POST /api/v1/upload/video  body: FormData (multipart)
    saveDTO('aix_videoUpload', videoUploadDTO);

    window.location.href = 'status.html';
  });
}


/* ====================================================================
   PAGE 8 — Status (status.html)
   ==================================================================== */

function initStatusPage() {
  initStepper(8);

  const iconEl    = document.getElementById('statusIcon');
  const titleEl   = document.getElementById('statusTitle');
  const subEl     = document.getElementById('statusSub');
  const detailsEl = document.getElementById('statusDetails');

  if (!titleEl) return;

  // Show pending state
  iconEl.textContent = '⏳';
  iconEl.className   = 'aix-status-icon pending';
  titleEl.textContent = 'Verification Pending';
  subEl.textContent   = 'Our team is reviewing your video and documents…';

  // Populate order details
  const payment = loadDTO('aix_payment');
  const plan    = loadDTO('aix_selectedPlan');
  const vehicle = loadDTO('aix_vehicle');

  if (detailsEl && payment && plan) {
    detailsEl.innerHTML =
      '<div class="aix-summary-row"><span>Order ID</span><span>' + payment.orderId + '</span></div>' +
      '<div class="aix-summary-row"><span>Plan</span><span>' + plan.planName + '</span></div>' +
      (vehicle ? '<div class="aix-summary-row"><span>Vehicle</span><span>' + vehicle.registrationNumber + '</span></div>' : '') +
      '<div class="aix-summary-row"><span>Amount Paid</span><span>₹' + payment.amountPaid.toLocaleString('en-IN') + '</span></div>';
  }

  // Simulate verification completing after 3 seconds
  // FUTURE: WebSocket or polling  GET /api/v1/order/{orderId}/status
  setTimeout(function () {
    iconEl.textContent  = '✓';
    iconEl.className    = 'aix-status-icon success';
    titleEl.textContent = 'Policy Issued Successfully';
    titleEl.style.color = '#059669';
    subEl.textContent   = 'Your policy documents have been sent to your registered email.';
  }, 3000);
}


/* ====================================================================
   UTILITY
   ==================================================================== */

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}
