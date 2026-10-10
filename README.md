# MediSync PHC (மெடிசின்க் ஆரம்ப சுகாதார நிலையம்)

> **Tamil Nadu Primary Health Centre Medicine Stock Monitoring & Inter-PHC Sharing System**  
> Prevent medicine stock-outs, forecast depletion dates, and automatically share surplus stock between nearby health centres using geospatial Haversine matching.

---

## 1. Problem Context

In Tamil Nadu's public healthcare network, Primary Health Centres (PHCs) order medicines from the district medical warehouse (TNMSC) on a monthly cycle. When high OPD patient flows or local fever clusters cause stocks to fall unnoticed, a health centre can suddenly run out of critical medicines (e.g., pediatric paracetamol syrup, antibiotics, anti-snake venom). Patients are turned away even while a neighbouring PHC just 3 to 10 km away holds ample surplus.

**MediSync PHC** solves this by:
1. Tracking daily stock velocity and **Days of Stock Remaining** across all formulary medicines.
2. Detecting abnormal consumption surges and monsoon fever spikes using statistical **Z-Score anomaly detection**.
3. Dynamically matching shortages with nearby surplus using **Haversine geodesic distance**.
4. Powering an **end-to-end Inter-PHC transfer workflow** with cold-chain verification, approvals, automated stock adjustments, and printable official transfer slips.

---

## 2. Tech Stack

- **Frontend:** React 19 (Vite) + Tailwind CSS v4, React Router, Recharts, Leaflet / OpenStreetMap, Lucide Icons.
- **Backend:** Node.js (Express), SQLite (`better-sqlite3`) with WAL mode.
- **Algorithms / AI:** 
  - Time-series consumption velocity (7-day and 30-day weighted moving averages).
  - Statistical Z-Score outlier detection for epidemic clusters.
  - Tamil Nadu seasonal disease multipliers (Northeast Monsoon, Southwest Monsoon, Summer dehydration).
  - Geodesic Haversine nearby surplus matching and multi-item delivery route consolidation.
- **Notifications:** Pluggable SMS and WhatsApp gateway (with development log drawer).
- **Localization:** Bilingual English and Tamil (தமிழ்) toggle.

---

## 3. User Roles & Pre-configured Logins

| Role | Username | Password | Scope & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Pharmacist (Shortage PHC)** | `pharmacist1` | `password123` | PHC Alapakkam — logs daily stock, views alerts, requests transfers |
| **Medical Officer (PHC Level)** | `doctor1` | `password123` | PHC Alapakkam — approves indents, signs off on transfers, verifies cold-chain |
| **Pharmacist (Donor PHC)** | `pharmacist2` | `password123` | PHC Melamaiyur (2.9 km away) — holds surplus, fulfills transfer requests |
| **Block Medical Officer** | `bmo1` | `password123` | Chengalpattu Block (5 PHCs) — oversees block stock health and risk maps |
| **District Admin** | `admin` | `admin123` | DDHS Chengalpattu (15 PHCs) — district KPIs, automated rebalancing engine |
| **Public Citizen** | *(No login)* | — | Public availability checker (In Stock / Low / Out of Stock) |

*(A handy **Role Switcher** is also available at the top right of the application for instant one-click switching during testing and demos!)*

---

## 4. Seed Data & Scenario

The database is pre-seeded with:
- **1 District:** Chengalpattu District, Tamil Nadu.
- **3 Medical Blocks:** Chengalpattu Block, Maduranthakam Block, Tirukalukundram Coastal Block.
- **15 PHCs:** Real coordinates, phone numbers, Medical Officer names, and populations.
- **30 Formulary Medicines:** Paracetamol Syrup, ORS Sachets, Amoxicillin, Metformin, Insulin, Anti-Snake Venom (ASV), Anti-Rabies Vaccine (ARV), etc.
- **90-Day Stock History:**
  - **Orchestrated Scenario:** **PHC Alapakkam** has run out of **Paracetamol Pediatric Suspension** (0 bottles) and is critically low on **Amoxicillin Dry Syrup** (3.6 days left).
  - **Nearby Solution:** Nearby **PHC Melamaiyur** (only 2.9 km away) holds a surplus of **380 bottles** of Paracetamol and **210 bottles** of Amoxicillin, ready to share!

---

## 5. How Forecasting and Recommendations Work

### A. Days-of-Stock Formula
$$\text{Average Daily Consumption} = 0.7 \times \text{Avg}_{7\text{d}} + 0.3 \times \text{Avg}_{30\text{d}}$$
$$\text{Days Remaining} = \frac{\text{Current Stock}}{\text{Average Daily Consumption}}$$
- **Red Alert:** $< 15$ days (or $< 20$ days for critical life-saving items).
- **Amber Warning:** $15$ to $30$ days.
- **Green Safe:** $30$ to $60$ days.
- **Purple Surplus:** $> 60$ days (stock exceeding a 45-day safety buffer is marked as **spareable surplus**).

### B. Haversine Nearby Distance
Calculates geodesic road distance between two PHC GPS coordinates:
$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
where $R = 6371\text{ km}$. Donors are ranked nearest first.

### C. Z-Score Anomaly Detection
$$Z = \frac{X_{\text{today}} - \mu}{\sigma}$$
Surges where $Z \ge 2.0$ and demand is $\ge 2.2\times$ normal baseline trigger an outbreak advisory alert.

### D. Tamil Nadu Seasonal Multipliers
- **Northeast Monsoon (Oct – Dec):** Paracetamol $1.6\times$, ORS $1.8\times$, ASV $1.6\times$, buffer raised to 45 days.
- **Southwest Monsoon (Jun – Sep):** ORS $1.6\times$, Metronidazole $1.4\times$.
- **Summer (Mar – May):** ORS $1.9\times$, IV Normal Saline $1.7\times$.

---

## 6. How to Run Locally

This project is combined into a **single application**: the Express backend serves the API and the built React frontend from one port (`http://localhost:5000`).

### Step 1: Install Dependencies & Seed Database
```bash
# From the project root
npm run setup    # Installs frontend + backend dependencies
npm run seed     # Seeds 15 PHCs, 30 medicines, 90-day history
npm test         # Runs automated unit tests for math and algorithms
```

### Step 2: Build & Start (one command)
```bash
npm start        # Builds the frontend, then starts the combined server
```

Open `http://localhost:5000` in your browser. The API is served under `http://localhost:5000/api`.

### Development Mode (optional, two servers with hot reload)
```bash
npm run dev:backend    # API server on http://localhost:5000
npm run dev:frontend   # Vite React UI on http://localhost:3000 (proxies /api -> :5000)
```
