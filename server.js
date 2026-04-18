const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { db, initDb } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'supersecretkey_autoinsurex'; // in production, use process.env

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS) from root folder

// Configure Multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize Database
initDb();

/* ==========================================================
   AUTHENTICATION ROUTES
   ========================================================== */

app.post('/api/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, 'user')",
      [full_name, email, phone || '', hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'Registration successful', userId: this.lastID });
      });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    });
  });
});

/* ==========================================================
   MIDDLEWARE: VERIFY TOKEN
   ========================================================== */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied, token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

/* ==========================================================
   VEHICLE AND POLICY ROUTES
   ========================================================== */

app.post('/api/vehicle', authenticateToken, (req, res) => {
  const { registration_number, type, brand, model, year } = req.body;
  db.run("INSERT INTO vehicles (user_id, registration_number, type, brand, model, year) VALUES (?, ?, ?, ?, ?, ?)",
    [req.user.userId, registration_number, type, brand, model, year],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to save vehicle details' });
      res.json({ message: 'Vehicle saved successfully', vehicleId: this.lastID });
    });
});

app.get('/api/policies', (req, res) => {
  const type = req.query.vehicleType;
  let query = "SELECT * FROM policies";
  let params = [];
  
  if (type) {
    query += " WHERE vehicle_type = ?";
    params.push(type);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Parse highlights array
    const mapped = rows.map(r => ({ ...r, highlights: r.highlights.split(',') }));
    res.json(mapped);
  });
});

/* ==========================================================
   PURCHASE AND UPLOAD (USER FLOW)
   ========================================================== */

app.post('/api/purchase', authenticateToken, (req, res) => {
  const { policy_id, vehicle_id, amount_paid } = req.body;
  const orderId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  
  db.run("INSERT INTO purchases (order_id, user_id, policy_id, vehicle_id, amount_paid, status) VALUES (?, ?, ?, ?, ?, ?)",
    [orderId, req.user.userId, policy_id, vehicle_id, amount_paid, 'PENDING_VERIFICATION'],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to process purchase' });
      res.json({ message: 'Payment successful', orderId, purchaseId: this.lastID });
    });
});

app.post('/api/upload', authenticateToken, upload.single('videoFile'), (req, res) => {
  const { orderId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  db.run("UPDATE purchases SET video_path = ?, status = 'VERIFICATION_PENDING' WHERE order_id = ? AND user_id = ?",
    [req.file.path, orderId, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to upload video' });
      res.json({ message: 'Video uploaded successfully', filePath: req.file.path });
    });
});

app.get('/api/user/purchases', authenticateToken, (req, res) => {
  const sql = `
    SELECT p.order_id, p.amount_paid, p.status, p.purchase_date, p.video_path,
           pol.plan_name, pol.provider_name, pol.duration_months,
           v.registration_number, v.brand, v.model
    FROM purchases p
    JOIN policies pol ON p.policy_id = pol.id
    JOIN vehicles v ON p.vehicle_id = v.id
    WHERE p.user_id = ?
    ORDER BY p.purchase_date DESC
  `;
  db.all(sql, [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to retrieve purchases' });
    res.json(rows);
  });
});

/* ==========================================================
   ADMIN ROUTES
   ========================================================== */

app.get('/api/admin/purchases', authenticateToken, verifyAdmin, (req, res) => {
  const sql = `
    SELECT p.id, p.order_id, p.amount_paid, p.status, p.purchase_date, p.video_path,
           u.full_name, u.email, u.phone,
           pol.plan_name, pol.provider_name,
           v.registration_number, v.brand, v.model
    FROM purchases p
    JOIN users u ON p.user_id = u.id
    JOIN policies pol ON p.policy_id = pol.id
    JOIN vehicles v ON p.vehicle_id = v.id
    ORDER BY p.purchase_date DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/admin/verify', authenticateToken, verifyAdmin, (req, res) => {
  const { purchaseId, action } = req.body; // action: 'APPROVE' or 'REJECT'
  const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
  
  db.run("UPDATE purchases SET status = ? WHERE id = ?", [newStatus, purchaseId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update status' });
    res.json({ message: 'Status updated to ' + newStatus });
  });
});

/* ==========================================================
   CHATBOT ROUTE
   ========================================================== */
app.post('/api/chat', (req, res) => {
  const message = (req.body.message || '').toLowerCase();
  let reply = "I'm vehi-Bot! How can I assist you with your insurance today?";

  if (message.includes('hello') || message.includes('hi')) {
    reply = "Hello! Welcome to AutoInsureX. I'm vehi-Bot. Need held finding a policy?";
  } else if (message.includes('claim') || message.includes('damage')) {
    reply = "Filing a claim is easy! Just log into your Dashboard, go to your Active Policy, and click 'File Claim'. Our 24/7 surveyor team will be with you.";
  } else if (message.includes('compare') || message.includes('best')) {
    reply = "To find the best plan, complete step 2 (Vehicle Details) and you'll see a customized list of plans. Click 'Add to Compare' on up to 3 plans!";
  } else if (message.includes('depreciation') || message.includes('zero dep')) {
    reply = "Zero Depreciation means during a claim, the full cost of replacing parts is covered without deducting for wear and tear. It's highly recommended!";
  } else if (message.includes('upload') || message.includes('video')) {
    reply = "After purchasing a policy, you will be prompted to upload a short 360° video of your vehicle's exterior. This is for quick verification by our team.";
  } else if (message.includes('third party') || message.includes('comprehensive')) {
    reply = "Third Party only covers damage you cause to others. Comprehensive covers damage to *your* vehicle as well. Comprehensive is much safer.";
  } else if (message.includes('why') && message.includes('insurance')) {
    reply = "Insurance protects you financially from unexpected damages, theft, and legal liabilities. Most importantly, having at least Third-Party insurance is a mandatory legal requirement for all vehicles on Indian roads!";
  } else if (message.includes('two wheeler') || message.includes('bike') || message.includes('scooter')) {
    reply = "We offer excellent plans for two-wheelers! While basic Third-Party is cheaper, we highly recommend Comprehensive coverage to protect your bike against theft and severe accident damage.";
  } else if (message.includes('four wheeler') || message.includes('car')) {
    reply = "For four-wheelers, repair costs can be enormous. We strongly recommend a Comprehensive Plan with a 'Zero Depreciation' add-on to ensure full peace of mind for your car.";
  } else if (message.length > 5) {
    reply = "That's a great question! For a detailed answer, you can always reach our human support team at support@autoinsurex.com, but I'm here if you have standard policy questions about coverages, why you need it, or vehicle types.";
  }

  // Simulate thinking time
  setTimeout(() => {
    res.json({ reply });
  }, 600);
});

/* ==========================================================
   START SERVER
   ========================================================== */
app.listen(PORT, () => {
  console.log('Server is running on http://localhost:' + PORT);
});
