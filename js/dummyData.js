/**
 * AutoInsureX — Dummy Insurance Plan Data
 * ========================================
 * Structured as Java DTO-style objects.
 *
 * FUTURE SCOPE: Replace this static array with a REST API call:
 *   fetch('/api/v1/plans').then(res => res.json()).then(plans => { ... });
 */

const INSURANCE_PLANS = [
  {
    planId: "PL001",
    planName: "Basic Shield",
    providerName: "HDFC ERGO",
    annualPremium: 4999,
    coverageAmount: 200000,
    durationMonths: 12,
    planType: "Third Party",
    highlights: [
      "Third-party liability cover",
      "Personal accident cover ₹15L",
      "Legal liability to paid driver"
    ],
    rating: 3.8
  },
  {
    planId: "PL002",
    planName: "Silver Guard",
    providerName: "Bajaj Allianz",
    annualPremium: 7499,
    coverageAmount: 500000,
    durationMonths: 12,
    planType: "Comprehensive",
    highlights: [
      "Own damage + Third-party cover",
      "Cashless repairs at 4,500+ garages",
      "Zero depreciation (partial)"
    ],
    rating: 4.1
  },
  {
    planId: "PL003",
    planName: "Gold Protect",
    providerName: "ICICI Lombard",
    annualPremium: 10999,
    coverageAmount: 800000,
    durationMonths: 12,
    planType: "Comprehensive",
    highlights: [
      "Full zero depreciation cover",
      "Engine & gearbox protection",
      "24/7 roadside assistance"
    ],
    rating: 4.4
  },
  {
    planId: "PL004",
    planName: "Platinum Elite",
    providerName: "Tata AIG",
    annualPremium: 14999,
    coverageAmount: 1200000,
    durationMonths: 12,
    planType: "Comprehensive",
    highlights: [
      "Return-to-invoice cover",
      "Consumables cover included",
      "No-claim bonus protection"
    ],
    rating: 4.6
  },
  {
    planId: "PL005",
    planName: "Ultimate Armour",
    providerName: "New India Assurance",
    annualPremium: 18999,
    coverageAmount: 1500000,
    durationMonths: 24,
    planType: "Comprehensive",
    highlights: [
      "2-year comprehensive cover",
      "Key replacement cover",
      "Tyre & rim damage protection"
    ],
    rating: 4.7
  },
  {
    planId: "PL006",
    planName: "Flexi Saver",
    providerName: "SBI General",
    annualPremium: 5999,
    coverageAmount: 350000,
    durationMonths: 12,
    planType: "Third Party+",
    highlights: [
      "Third-party + fire & theft",
      "Personal belongings cover",
      "EMI-friendly monthly payment"
    ],
    rating: 3.9
  }
];

/**
 * Dummy User DTO — simulates a JWT-authenticated session.
 * FUTURE SCOPE: Replace with POST /api/v1/auth/login response.
 */
function createDummyUserDTO(email) {
  return {
    userId: "USR" + Date.now(),
    fullName: "Demo User",
    email: email || "demo@autoinsurex.in",
    phone: "9876543210",
    authToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.DEMO_TOKEN",
    isAuthenticated: true,
    createdAt: new Date().toISOString()
  };
}
