const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedData() {
  console.log('Starting MediSync PHC database seeding...');

  // 1. Clear existing tables
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM alerts;
    DELETE FROM emergency_indent_items;
    DELETE FROM emergency_indents;
    DELETE FROM transfer_items;
    DELETE FROM transfer_requests;
    DELETE FROM stock_entries;
    DELETE FROM batches;
    DELETE FROM users;
    DELETE FROM medicines;
    DELETE FROM phcs;
    DELETE FROM blocks;
    DELETE FROM districts;
  `);

  // 2. Insert District
  const insertDistrict = db.prepare('INSERT INTO districts (id, name, state) VALUES (?, ?, ?)');
  insertDistrict.run('dist_01', 'Chengalpattu', 'Tamil Nadu');

  // 3. Insert Blocks
  const insertBlock = db.prepare('INSERT INTO blocks (id, name, district_id) VALUES (?, ?, ?)');
  insertBlock.run('blk_cpt', 'Chengalpattu Central Block', 'dist_01');
  insertBlock.run('blk_mdk', 'Maduranthakam Block', 'dist_01');
  insertBlock.run('blk_tkd', 'Tirukalukundram Coastal Block', 'dist_01');

  // 4. Insert 15 PHCs with realistic Tamil Nadu coordinates
  const phcs = [
    // Chengalpattu Block (5 PHCs)
    { id: 'phc_cpt_01', name: 'PHC Alapakkam', block_id: 'blk_cpt', district_id: 'dist_01', lat: 12.6841, lon: 79.9830, pop: 34000, phone: '044-27420101', mo: 'Dr. S. Karthi, MBBS', pharm: 'Mr. R. Murugan, D.Pharm' },
    { id: 'phc_cpt_02', name: 'PHC Melamaiyur', block_id: 'blk_cpt', district_id: 'dist_01', lat: 12.7052, lon: 79.9678, pop: 41000, phone: '044-27420102', mo: 'Dr. M. Deepa, MBBS', pharm: 'Mrs. K. Banumathi, B.Pharm' },
    { id: 'phc_cpt_03', name: 'PHC Vallam', block_id: 'blk_cpt', district_id: 'dist_01', lat: 12.7230, lon: 80.0120, pop: 28500, phone: '044-27420103', mo: 'Dr. K. Vignesh, MD', pharm: 'Mr. T. Selvam, D.Pharm' },
    { id: 'phc_cpt_04', name: 'PHC Singaperumal Koil', block_id: 'blk_cpt', district_id: 'dist_01', lat: 12.7635, lon: 80.0034, pop: 52000, phone: '044-27420104', mo: 'Dr. P. Revathi, MBBS', pharm: 'Mr. A. Manikandan, D.Pharm' },
    { id: 'phc_cpt_05', name: 'PHC Maraimalai Nagar', block_id: 'blk_cpt', district_id: 'dist_01', lat: 12.7981, lon: 80.0247, pop: 58000, phone: '044-27420105', mo: 'Dr. R. Anand, MBBS', pharm: 'Mrs. S. Gomathi, B.Pharm' },

    // Maduranthakam Block (5 PHCs)
    { id: 'phc_mdk_01', name: 'PHC Karunguzhi', block_id: 'blk_mdk', district_id: 'dist_01', lat: 12.5180, lon: 79.9021, pop: 31000, phone: '044-27560201', mo: 'Dr. V. Arunkumar, MBBS', pharm: 'Mr. P. Velu, D.Pharm' },
    { id: 'phc_mdk_02', name: 'PHC Padalam', block_id: 'blk_mdk', district_id: 'dist_01', lat: 12.5721, lon: 79.9324, pop: 33500, phone: '044-27560202', mo: 'Dr. B. Kavitha, MBBS', pharm: 'Mrs. N. Lakshmi, D.Pharm' },
    { id: 'phc_mdk_03', name: 'PHC Acharapakkam', block_id: 'blk_mdk', district_id: 'dist_01', lat: 12.4332, lon: 79.8156, pop: 39000, phone: '044-27560203', mo: 'Dr. G. Natarajan, MBBS', pharm: 'Mr. C. Rajendran, B.Pharm' },
    { id: 'phc_mdk_04', name: 'PHC Orathi', block_id: 'blk_mdk', district_id: 'dist_01', lat: 12.4820, lon: 79.7912, pop: 26000, phone: '044-27560204', mo: 'Dr. T. Geetha, MBBS', pharm: 'Mr. E. Saravanan, D.Pharm' },
    { id: 'phc_mdk_05', name: 'PHC Chunampet', block_id: 'blk_mdk', district_id: 'dist_01', lat: 12.3385, lon: 79.9214, pop: 29000, phone: '044-27560205', mo: 'Dr. N. Dinesh, MBBS', pharm: 'Mrs. J. Malathi, D.Pharm' },

    // Tirukalukundram Block (5 PHCs)
    { id: 'phc_tkd_01', name: 'PHC Anupuram', block_id: 'blk_tkd', district_id: 'dist_01', lat: 12.5412, lon: 80.1345, pop: 36000, phone: '044-27440301', mo: 'Dr. K. Jayasree, MBBS', pharm: 'Mr. G. Kumar, D.Pharm' },
    { id: 'phc_tkd_02', name: 'PHC Nerumbur', block_id: 'blk_tkd', district_id: 'dist_01', lat: 12.4891, lon: 80.0912, pop: 27500, phone: '044-27440302', mo: 'Dr. S. Mohan, MBBS', pharm: 'Mrs. V. Radhika, B.Pharm' },
    { id: 'phc_tkd_03', name: 'PHC Sadras / Kalpakkam', block_id: 'blk_tkd', district_id: 'dist_01', lat: 12.5189, lon: 80.1610, pop: 44000, phone: '044-27440303', mo: 'Dr. R. Senthamil, MD', pharm: 'Mr. D. Baskaran, D.Pharm' },
    { id: 'phc_tkd_04', name: 'PHC Mamallapuram', block_id: 'blk_tkd', district_id: 'dist_01', lat: 12.6269, lon: 80.1927, pop: 48000, phone: '044-27440304', mo: 'Dr. H. Priya, MBBS', pharm: 'Mrs. M. Anitha, D.Pharm' },
    { id: 'phc_tkd_05', name: 'PHC Mullikolathur', block_id: 'blk_tkd', district_id: 'dist_01', lat: 12.5630, lon: 80.0821, pop: 31500, phone: '044-27440305', mo: 'Dr. Y. Naveen, MBBS', pharm: 'Mr. S. Balaji, D.Pharm' }
  ];

  const insertPhc = db.prepare(`
    INSERT INTO phcs (id, name, block_id, district_id, latitude, longitude, population_served, phone, medical_officer_name, pharmacist_name, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of phcs) {
    insertPhc.run(p.id, p.name, p.block_id, p.district_id, p.lat, p.lon, p.pop, p.phone, p.mo, p.pharm, `${p.name}, ${p.block_id}, Chengalpattu`);
  }

  // 5. Insert 30 Medicines
  const medicines = [
    { id: 'med_01', code: 'TN-0101', name: 'Paracetamol Pediatric Oral Suspension', generic_name: 'Paracetamol', form: 'Syrup', strength: '125mg / 5ml (60ml)', category: 'Analgesic & Antipyretic', unit: 'bottles', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 45, seasonal: 'monsoon_surge' },
    { id: 'med_02', code: 'TN-0102', name: 'Paracetamol Tablets', generic_name: 'Paracetamol', form: 'Tablet', strength: '500mg', category: 'Analgesic & Antipyretic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'monsoon_surge' },
    { id: 'med_03', code: 'TN-0201', name: 'Oral Rehydration Salts (ORS)', generic_name: 'ORS WHO Formula', form: 'Sachet', strength: '20.5g / sachet', category: 'Fluid & Electrolyte', unit: 'sachets', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 45, seasonal: 'summer_gastro' },
    { id: 'med_04', code: 'TN-0301', name: 'Amoxicillin Trihydrate Capsules', generic_name: 'Amoxicillin', form: 'Capsule', strength: '500mg', category: 'Antibiotic', unit: 'capsules', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'monsoon_surge' },
    { id: 'med_05', code: 'TN-0302', name: 'Amoxicillin Pediatric Dry Syrup', generic_name: 'Amoxicillin', form: 'Suspension', strength: '125mg / 5ml (60ml)', category: 'Antibiotic', unit: 'bottles', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 40, seasonal: 'monsoon_surge' },
    { id: 'med_06', code: 'TN-0401', name: 'Metformin Hydrochloride Tablets', generic_name: 'Metformin', form: 'Tablet', strength: '500mg', category: 'NCD / Chronic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 20, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_07', code: 'TN-0402', name: 'Amlodipine Besylate Tablets', generic_name: 'Amlodipine', form: 'Tablet', strength: '5mg', category: 'NCD / Chronic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 20, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_08', code: 'TN-0501', name: 'Iron & Folic Acid (Large) Tablets', generic_name: 'Ferrous Sulphate + Folic Acid', form: 'Tablet', strength: '100mg Fe + 0.5mg FA', category: 'Maternal & Child Health', unit: 'tablets', cold_chain: 0, critical: 1, min_days: 25, buffer_days: 45, seasonal: 'normal' },
    { id: 'med_09', code: 'TN-0502', name: 'Albendazole Chewable Tablets', generic_name: 'Albendazole', form: 'Tablet', strength: '400mg', category: 'Anthelmintic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_10', code: 'TN-0303', name: 'Azithromycin Tablets', generic_name: 'Azithromycin', form: 'Tablet', strength: '500mg', category: 'Antibiotic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_11', code: 'TN-0601', name: 'Human Insulin Regular Injection', generic_name: 'Insulin (rDNA)', form: 'Vial', strength: '40 IU / ml (10ml)', category: 'NCD / Chronic', unit: 'vials', cold_chain: 1, critical: 1, min_days: 25, buffer_days: 45, seasonal: 'normal' },
    { id: 'med_12', code: 'TN-0701', name: 'Anti-Snake Venom Polyvalent Lyophilized', generic_name: 'Polyvalent ASV', form: 'Vial', strength: '10ml reconstituted', category: 'Emergency / Antidote', unit: 'vials', cold_chain: 1, critical: 1, min_days: 30, buffer_days: 60, seasonal: 'monsoon_surge' },
    { id: 'med_13', code: 'TN-0702', name: 'Anti-Rabies Vaccine (ARV) Cell Culture', generic_name: 'Purified Chick Embryo Cell Vaccine', form: 'Vial', strength: '0.5ml IM/ID', category: 'Vaccine', unit: 'vials', cold_chain: 1, critical: 1, min_days: 30, buffer_days: 60, seasonal: 'normal' },
    { id: 'med_14', code: 'TN-0703', name: 'Tetanus Toxoid (TT) Injection', generic_name: 'Tetanus Vaccine (Adsorbed)', form: 'Ampoule', strength: '0.5ml', category: 'Vaccine', unit: 'ampoules', cold_chain: 1, critical: 1, min_days: 20, buffer_days: 40, seasonal: 'normal' },
    { id: 'med_15', code: 'TN-0304', name: 'Doxycycline Hydrochloride Capsules', generic_name: 'Doxycycline', form: 'Capsule', strength: '100mg', category: 'Antibiotic', unit: 'capsules', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 45, seasonal: 'monsoon_surge' },
    { id: 'med_16', code: 'TN-0801', name: 'Cetirizine Hydrochloride Tablets', generic_name: 'Cetirizine', form: 'Tablet', strength: '10mg', category: 'Antihistamine', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'monsoon_surge' },
    { id: 'med_17', code: 'TN-0901', name: 'Ciprofloxacin Eye / Ear Drops', generic_name: 'Ciprofloxacin', form: 'Drops', strength: '0.3% w/v (5ml)', category: 'Ophthalmic / ENT', unit: 'bottles', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_18', code: 'TN-0305', name: 'Metronidazole Tablets', generic_name: 'Metronidazole', form: 'Tablet', strength: '400mg', category: 'Antiprotozoal', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'summer_gastro' },
    { id: 'med_19', code: 'TN-0202', name: 'Normal Saline (0.9% NaCl) IV Infusion', generic_name: 'Sodium Chloride 0.9%', form: 'Bottle', strength: '500ml FFS bottle', category: 'Fluid & Electrolyte', unit: 'bottles', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 40, seasonal: 'summer_gastro' },
    { id: 'med_20', code: 'TN-0203', name: 'Dextrose 5% IV Infusion', generic_name: 'Dextrose anhydrous', form: 'Bottle', strength: '500ml bottle', category: 'Fluid & Electrolyte', unit: 'bottles', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_21', code: 'TN-0204', name: 'Zinc Sulphate Dispersible Tablets', generic_name: 'Zinc Sulphate', form: 'Tablet', strength: '20mg', category: 'Maternal & Child Health', unit: 'tablets', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 40, seasonal: 'summer_gastro' },
    { id: 'med_22', code: 'TN-1001', name: 'Pantoprazole Gastro-Resistant Tablets', generic_name: 'Pantoprazole', form: 'Tablet', strength: '40mg', category: 'Gastrointestinal', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_23', code: 'TN-1101', name: 'Salbutamol Sulphate Inhaler', generic_name: 'Salbutamol', form: 'Inhaler', strength: '100mcg / dose (200 doses)', category: 'Respiratory', unit: 'canisters', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 40, seasonal: 'normal' },
    { id: 'med_24', code: 'TN-0306', name: 'Co-trimoxazole Pediatric Suspension', generic_name: 'Trimethoprim + Sulfamethoxazole', form: 'Suspension', strength: '40mg + 200mg / 5ml (50ml)', category: 'Antibiotic', unit: 'bottles', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_25', code: 'TN-0103', name: 'Ibuprofen Tablets', generic_name: 'Ibuprofen', form: 'Tablet', strength: '400mg', category: 'Analgesic & Antipyretic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_26', code: 'TN-0503', name: 'Vitamin A Oral Solution', generic_name: 'Retinol Palmitate', form: 'Solution', strength: '100,000 IU / ml (100ml)', category: 'Maternal & Child Health', unit: 'bottles', cold_chain: 0, critical: 1, min_days: 25, buffer_days: 45, seasonal: 'normal' },
    { id: 'med_27', code: 'TN-0403', name: 'Enalapril Maleate Tablets', generic_name: 'Enalapril', form: 'Tablet', strength: '5mg', category: 'NCD / Chronic', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 20, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_28', code: 'TN-1201', name: 'Povidone Iodine Antiseptic Ointment', generic_name: 'Povidone Iodine', form: 'Ointment', strength: '5% w/w (15g)', category: 'Antiseptic & Wound Care', unit: 'tubes', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' },
    { id: 'med_29', code: 'TN-0104', name: 'Diclofenac Sodium Injection', generic_name: 'Diclofenac', form: 'Ampoule', strength: '75mg / 3ml', category: 'Emergency / Analgesic', unit: 'ampoules', cold_chain: 0, critical: 1, min_days: 20, buffer_days: 35, seasonal: 'normal' },
    { id: 'med_30', code: 'TN-0504', name: 'Vitamin B-Complex Tablets NFI', generic_name: 'B-Complex Vitamins', form: 'Tablet', strength: 'Standard NFI formula', category: 'Nutritional', unit: 'tablets', cold_chain: 0, critical: 0, min_days: 15, buffer_days: 30, seasonal: 'normal' }
  ];

  const insertMed = db.prepare(`
    INSERT INTO medicines (id, code, name, generic_name, form, strength, category, unit, cold_chain, critical, min_threshold_days, emergency_buffer_days, seasonal_sensitivity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of medicines) {
    insertMed.run(m.id, m.code, m.name, m.generic_name, m.form, m.strength, m.category, m.unit, m.cold_chain, m.critical, m.min_days, m.buffer_days, m.seasonal);
  }

  // 6. Insert Users (Password: password123, Admin: admin123)
  const passwordHash = await bcrypt.hash('password123', 8);
  const adminHash = await bcrypt.hash('admin123', 8);

  const users = [
    { id: 'usr_pharm_01', username: 'pharmacist1', pass: passwordHash, name: 'R. Murugan (Pharmacist)', role: 'pharmacist', phc: 'phc_cpt_01', blk: 'blk_cpt', dist: 'dist_01', phone: '9840112233', email: 'murugan.pharm@tnhealth.gov.in' },
    { id: 'usr_mo_01', username: 'doctor1', pass: passwordHash, name: 'Dr. S. Karthi (Medical Officer)', role: 'medical_officer', phc: 'phc_cpt_01', blk: 'blk_cpt', dist: 'dist_01', phone: '9840223344', email: 'karthi.mo@tnhealth.gov.in' },
    { id: 'usr_pharm_02', username: 'pharmacist2', pass: passwordHash, name: 'K. Banumathi (Pharmacist)', role: 'pharmacist', phc: 'phc_cpt_02', blk: 'blk_cpt', dist: 'dist_01', phone: '9840334455', email: 'banu.pharm@tnhealth.gov.in' },
    { id: 'usr_mo_02', username: 'doctor2', pass: passwordHash, name: 'Dr. M. Deepa (Medical Officer)', role: 'medical_officer', phc: 'phc_cpt_02', blk: 'blk_cpt', dist: 'dist_01', phone: '9840445566', email: 'deepa.mo@tnhealth.gov.in' },
    { id: 'usr_bmo_01', username: 'bmo1', pass: passwordHash, name: 'Dr. T. Rajan (Block Medical Officer)', role: 'block_medical_officer', phc: null, blk: 'blk_cpt', dist: 'dist_01', phone: '9840556677', email: 'rajan.bmo@tnhealth.gov.in' },
    { id: 'usr_admin_01', username: 'admin', pass: adminHash, name: 'Dr. P. Sundaram (Deputy Director Health Services / Admin)', role: 'district_admin', phc: null, blk: null, dist: 'dist_01', phone: '9840998877', email: 'ddhs.chengalpattu@tnhealth.gov.in' }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role, phc_id, block_id, district_id, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(u.id, u.username, u.pass, u.name, u.role, u.phc, u.blk, u.dist, u.phone, u.email);
  }

  // 7. Seed Batches and 90-day Stock History
  console.log('Seeding stock batches and 90-day consumption history...');

  const insertBatch = db.prepare(`
    INSERT INTO batches (id, phc_id, medicine_id, batch_number, expiry_date, quantity, supplier_source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStockEntry = db.prepare(`
    INSERT INTO stock_entries (id, phc_id, medicine_id, batch_id, entry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Target date range: 90 days up to today
  const today = new Date();
  const daysCount = 90;

  // Real-world orchestrated test scenario:
  // PHC Alapakkam (phc_cpt_01):
  // - Paracetamol syrup (med_01) ran out 3 days ago! (closing_stock = 0, current stock = 0)
  // - Amoxicillin dry syrup (med_05) has only 18 bottles left (daily usage 5 -> only ~3.6 days left, CRITICAL!)
  // - Anti-snake venom (med_12) has only 3 vials (min threshold 30 days, CRITICAL!)
  //
  // Meanwhile, nearby PHC Melamaiyur (phc_cpt_02, 4.2 km away):
  // - Paracetamol syrup (med_01) has SURPLUS 380 bottles (>75 days!)
  // - Amoxicillin dry syrup (med_05) has SURPLUS 210 bottles (>50 days!)
  //
  // And PHC Vallam (phc_cpt_03, 6.1 km away):
  // - Anti-Snake Venom (med_12) has 35 vials (>60 days!)
  // - ORS Sachets (med_03) has 650 sachets (>60 days surplus!)

  let batchCounter = 1;
  let entryCounter = 1;

  for (const phc of phcs) {
    for (const med of medicines) {
      let isShortage = false;
      let isSurplus = false;
      let targetCurrentStock = 120; // default baseline
      let baseDailyUsage = med.critical ? 6 : 8;

      if (phc.id === 'phc_cpt_01') {
        if (med.id === 'med_01') {
          // Out of stock scenario!
          isShortage = true;
          targetCurrentStock = 0;
          baseDailyUsage = 12;
        } else if (med.id === 'med_05') {
          // Critical shortage!
          isShortage = true;
          targetCurrentStock = 18;
          baseDailyUsage = 5;
        } else if (med.id === 'med_12') {
          // Snake venom low!
          isShortage = true;
          targetCurrentStock = 3;
          baseDailyUsage = 1;
        }
      } else if (phc.id === 'phc_cpt_02') {
        if (med.id === 'med_01') {
          // Big surplus nearby!
          isSurplus = true;
          targetCurrentStock = 380;
          baseDailyUsage = 5;
        } else if (med.id === 'med_05') {
          // Surplus nearby!
          isSurplus = true;
          targetCurrentStock = 210;
          baseDailyUsage = 4;
        }
      } else if (phc.id === 'phc_cpt_03') {
        if (med.id === 'med_12') {
          // Surplus ASV nearby!
          isSurplus = true;
          targetCurrentStock = 35;
          baseDailyUsage = 0.5;
        } else if (med.id === 'med_03') {
          isSurplus = true;
          targetCurrentStock = 650;
          baseDailyUsage = 12;
        }
      } else {
        // Vary stock between 40 and 280
        const hash = (phc.id.charCodeAt(5) || 0) + (med.id.charCodeAt(4) || 0);
        targetCurrentStock = 40 + (hash % 160);
      }

      // Create 1-2 active batches
      const batchId = `b_${batchCounter++}`;
      const batchNo = `TN26-${(1000 + batchCounter)}`;
      
      // Expiry dates: some normal (18-24 months), some near-expiry (<90 days) for testing
      const expDate = new Date();
      if (phc.id === 'phc_cpt_02' && med.id === 'med_01') {
        // Near-expiry surplus batch (expires in 75 days) - perfect for rebalancing demonstration!
        expDate.setDate(expDate.getDate() + 75);
      } else {
        expDate.setMonth(expDate.getMonth() + 18);
      }
      const expDateStr = expDate.toISOString().split('T')[0];

      insertBatch.run(batchId, phc.id, med.id, batchNo, expDateStr, targetCurrentStock, 'TNMSC Central Medical Store');

      // Generate 90 days of history
      let runningStock = targetCurrentStock + Math.round(baseDailyUsage * 60);

      for (let dayOffset = daysCount; dayOffset >= 0; dayOffset--) {
        const entryDate = new Date(today);
        entryDate.setDate(entryDate.getDate() - dayOffset);
        const dateStr = entryDate.toISOString().split('T')[0];

        // Random variation in daily dispensed
        let issued = Math.max(0, Math.round(baseDailyUsage + ((Math.sin(dayOffset) * 2.5))));
        
        // Simulate anomaly spike on day 15 for Paracetamol at Alapakkam (viral fever cluster in village)
        if (phc.id === 'phc_cpt_01' && med.id === 'med_01' && dayOffset === 15) {
          issued = 45; // 4x spike!
        }

        // Periodic monthly delivery from TNMSC on day 60 and day 30
        let received = 0;
        if (dayOffset === 60 || dayOffset === 30) {
          if (!isShortage || dayOffset > 20) {
            received = Math.round(baseDailyUsage * 30);
          }
        }

        let opening = runningStock;
        let closing = Math.max(0, opening + received - issued);

        if (dayOffset === 0) {
          closing = targetCurrentStock;
        }

        runningStock = closing;

        insertStockEntry.run(
          `se_${entryCounter++}`,
          phc.id,
          med.id,
          batchId,
          dateStr,
          opening,
          received,
          issued,
          closing,
          issued > 30 ? 'High seasonal viral OP flow' : 'Routine daily OPD dispensing',
          'Mr. R. Murugan'
        );
      }
    }
  }

  // 8. Seed Pre-configured Alerts
  console.log('Seeding initial alerts...');
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, phc_id, medicine_id, alert_type, severity, title, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAlert.run(
    'alt_01',
    'phc_cpt_01',
    'med_01',
    'stockout',
    'critical',
    'Zero Stock Alert: Paracetamol Pediatric Suspension',
    'PHC Alapakkam has 0 bottles remaining. Stock was depleted 3 days ago. Immediate inter-PHC transfer or indent recommended.',
    'new',
    new Date(Date.now() - 3600000 * 48).toISOString()
  );

  insertAlert.run(
    'alt_02',
    'phc_cpt_01',
    'med_05',
    'low_stock',
    'high',
    'Critical Shortage: Amoxicillin Pediatric Dry Syrup',
    'Current stock is 18 bottles (~3.6 days of stock left). Below 20-day critical threshold.',
    'new',
    new Date(Date.now() - 3600000 * 24).toISOString()
  );

  insertAlert.run(
    'alt_03',
    'phc_cpt_01',
    'med_12',
    'low_stock',
    'critical',
    'Emergency Antidote Shortage: Anti-Snake Venom',
    'Only 3 vials remaining at PHC Alapakkam. Critical life-saving medicine requirement is minimum 30 days buffer.',
    'acknowledged',
    new Date(Date.now() - 3600000 * 12).toISOString()
  );

  insertAlert.run(
    'alt_04',
    'phc_cpt_02',
    'med_01',
    'near_expiry',
    'medium',
    'Near Expiry Notice: Paracetamol Syrup (Batch TN26-1002)',
    '380 bottles expiring within 75 days. PHC has 75+ days of stock. Consider redistributing to nearby high-velocity centres.',
    'new',
    new Date(Date.now() - 3600000 * 36).toISOString()
  );

  // 9. Seed Transfer Requests (Active & Completed examples)
  console.log('Seeding transfers and emergency indents...');
  const insertTransfer = db.prepare(`
    INSERT INTO transfer_requests (id, request_number, from_phc_id, to_phc_id, status, urgency, notes, cold_chain_verified, distance_km, created_by, approved_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransferItem = db.prepare(`
    INSERT INTO transfer_items (id, transfer_id, medicine_id, batch_id, requested_qty, approved_qty, received_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Transfer 1: In Progress (Approved by donor MO, in transit)
  insertTransfer.run(
    'tr_01',
    'TR-2026-CPT-0042',
    'phc_cpt_02', // From Melamaiyur
    'phc_cpt_01', // To Alapakkam
    'approved',
    'critical',
    'Emergency shortage of pediatric paracetamol due to viral fever cluster. Dispatched via 108 ambulance transport run.',
    0,
    4.2,
    'Mr. R. Murugan (Pharmacist)',
    'Dr. M. Deepa (MO)',
    new Date(Date.now() - 3600000 * 14).toISOString(),
    new Date(Date.now() - 3600000 * 4).toISOString()
  );

  insertTransferItem.run('tri_01', 'tr_01', 'med_01', null, 150, 150, null);
  insertTransferItem.run('tri_02', 'tr_01', 'med_05', null, 60, 60, null);

  // Transfer 2: Completed transfer for historical review and PDF printing
  insertTransfer.run(
    'tr_02',
    'TR-2026-CPT-0038',
    'phc_cpt_03', // From Vallam
    'phc_cpt_01', // To Alapakkam
    'completed',
    'emergency',
    'Cold chain Anti-Snake Venom rebalancing. Ice gel packs and vaccine carrier verified.',
    1,
    6.1,
    'Mr. R. Murugan (Pharmacist)',
    'Dr. K. Vignesh (MO)',
    new Date(Date.now() - 3600000 * 72).toISOString(),
    new Date(Date.now() - 3600000 * 48).toISOString()
  );

  insertTransferItem.run('tri_03', 'tr_02', 'med_12', null, 10, 10, 10);

  // 10. Seed Emergency Indents
  const insertIndent = db.prepare(`
    INSERT INTO emergency_indents (id, indent_number, phc_id, status, reason, total_items, auto_drafted, created_by, approved_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIndentItem = db.prepare(`
    INSERT INTO emergency_indent_items (id, indent_id, medicine_id, requested_qty, approved_qty, justification)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertIndent.run(
    'ind_01',
    'EI-2026-TNMSC-089',
    'phc_cpt_01',
    'submitted',
    'Unexpected monsoon fever surge in Alapakkam village zone; weekly consumption exceeded monthly forecast.',
    2,
    1,
    'Dr. S. Karthi (Medical Officer)',
    null,
    new Date(Date.now() - 3600000 * 8).toISOString()
  );

  insertIndentItem.run('indi_01', 'ind_01', 'med_01', 500, null, 'Current stock 0, active OP surge of pediatric viral fever');
  insertIndentItem.run('indi_02', 'ind_01', 'med_03', 1000, null, 'Buffer exhausted during seasonal gastro cases');

  // 11. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('aud_01', 'usr_mo_02', 'APPROVE_TRANSFER', 'transfer_requests', 'tr_01', 'Approved transfer of 150 Paracetamol bottles and 60 Amoxicillin to PHC Alapakkam');
  insertAudit.run('aud_02', 'usr_pharm_01', 'STOCK_UPDATE', 'stock_entries', 'se_latest', 'Logged daily closing stock entry for PHC Alapakkam');

  // 12. Seed Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, recipient_phone, recipient_role, channel, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotification.run(
    'notif_01',
    '9840223344',
    'Medical Officer',
    'WHATSAPP',
    '🟢 [WhatsApp - MediSync TN PHC Portal]\nURGENT: Transfer Request TR-2026-CPT-0042 from PHC Melamaiyur has been approved. Ambulance dispatch assigned.',
    'delivered',
    new Date(Date.now() - 3600000 * 4).toISOString()
  );

  insertNotification.run(
    'notif_02',
    '9840112233',
    'Pharmacist',
    'SMS',
    '📱 [SMS - TN Health Dept MediSync]\nCRITICAL ALERT: Paracetamol Pediatric Suspension stock is 0 at PHC Alapakkam. Donor Melamaiyur matched (4.2 km).',
    'delivered',
    new Date(Date.now() - 3600000 * 48).toISOString()
  );

  console.log('✅ MediSync PHC database seeded successfully with 15 PHCs, 30 Medicines, and 90-day history!');
}

seedData().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
