/**
 * MediSync PHC - Staff AI Chatbot Engine
 * Answers clinical stock queries in English and Tamil with live database tool execution
 */

const { findNearbySurplus, calculateHaversineDistance } = require('./recommender');
const { calculateConsumptionMetrics } = require('./forecasting');

function handleChatbotQuery(db, user, queryText) {
  const query = (queryText || '').trim().toLowerCase();
  const currentPhcId = (user && user.phc_id) ? user.phc_id : 'phc_cpt_01'; // Default if admin/block officer
  const currentPhc = db.prepare('SELECT * FROM phcs WHERE id = ?').get(currentPhcId);

  // 1. Check for nearby surplus query: "Who nearby has [medicine] and how far is it?" / "யாரிடம் உள்ளது"
  const nearbyKeywords = ['nearby', 'who has', 'where can i get', 'surplus', 'how far', 'spare', 'எங்கே', 'யாரிடம்', 'அருகில்'];
  const hasNearbyIntent = nearbyKeywords.some(k => query.includes(k));

  // Find mentioned medicine
  const medicines = db.prepare('SELECT id, name, generic_name FROM medicines').all();
  let matchedMed = null;
  for (const m of medicines) {
    const medNameLower = m.name.toLowerCase();
    const genericLower = m.generic_name.toLowerCase();
    // match single word like 'ors', 'paracetamol', 'amoxicillin', 'insulin'
    const words = medNameLower.split(/[\s-]+/);
    if (query.includes(medNameLower) || words.some(w => w.length > 2 && query.includes(w))) {
      matchedMed = m;
      break;
    }
  }

  // Handle Nearby Stock query
  if (hasNearbyIntent || (matchedMed && (query.includes('have') || query.includes('find') || query.includes('stock')) && (query.includes('who') || query.includes('where') || query.includes('nearby')))) {
    if (!matchedMed) {
      return {
        reply: `I can help you locate surplus stock at nearby PHCs! Which medicine are you looking for? (e.g., Paracetamol, ORS, Amoxicillin, Insulin, Anti-Snake Venom)`,
        action: 'PROMPT_MEDICINE'
      };
    }

    const surplusData = findNearbySurplus(db, currentPhcId, matchedMed.id, 50);
    if (!surplusData.donors || surplusData.donors.length === 0) {
      return {
        reply: `⚠️ No nearby PHCs currently have excess spareable surplus for **${matchedMed.name}** within 50 km of ${currentPhc ? currentPhc.name : 'your PHC'}. I recommend raising an **Emergency Indent** directly to the District Warehouse.`,
        action: 'EMERGENCY_INDENT_SUGGESTION',
        medicine_id: matchedMed.id
      };
    }

    const donorListText = surplusData.donors.slice(0, 3).map((d, idx) => {
      const match = d.matches[0];
      return `${idx + 1}. **${d.donor_phc_name}** — **${d.distance_km} km away**\n   • Spareable surplus: **${match.spareable_surplus} ${match.unit}** (Total stock: ${match.total_stock})\n   • Earliest expiry: ${match.earliest_expiry || 'N/A'}\n   • Contact: ${d.phone}`;
    }).join('\n\n');

    return {
      reply: `Here are the nearest PHCs with surplus stock of **${matchedMed.name}** near ${currentPhc ? currentPhc.name : 'your centre'}:\n\n${donorListText}\n\n💡 Would you like me to prepare an inter-PHC transfer request from **${surplusData.donors[0].donor_phc_name}**?`,
      action: 'TRANSFER_OPTION',
      data: {
        medicine: matchedMed,
        nearest_donor: surplusData.donors[0]
      }
    };
  }

  // 2. Check for "How many days of [medicine] do we have?" / "இருப்பு எவ்வளவு நாள் வரும்"
  const daysLeftKeywords = ['how many days', 'days left', 'run out', 'how long', 'velocity', 'எத்தனை நாள்', 'எவ்வளவு நாள்'];
  if (daysLeftKeywords.some(k => query.includes(k)) || (matchedMed && query.includes('days'))) {
    if (!matchedMed) {
      return {
        reply: `Please specify the medicine name to check remaining days of stock (e.g. "How many days of Amoxicillin do we have?").`,
        action: 'PROMPT_MEDICINE'
      };
    }

    const metrics = calculateConsumptionMetrics(db, currentPhcId, matchedMed.id);
    if (!metrics) {
      return { reply: `Could not retrieve stock metrics for ${matchedMed.name}.` };
    }

    return {
      reply: `📊 **Stock Status at ${currentPhc ? currentPhc.name : 'Current PHC'} for ${metrics.medicine_name}**:\n` +
             `• **Current stock:** ${metrics.current_stock} ${metrics.unit}\n` +
             `• **Average daily consumption:** ${metrics.effective_daily_rate} ${metrics.unit}/day (7-day: ${metrics.avg_daily_7}, 30-day: ${metrics.avg_daily_30})\n` +
             `• **Estimated days left:** **${metrics.days_left} days** (${metrics.status_text})\n` +
             `• **Projected run-out date:** ${metrics.run_out_date || 'N/A'}\n` +
             `• **Status code:** ${metrics.status.toUpperCase()}\n\n` +
             (metrics.days_left < metrics.min_threshold 
              ? `🚨 **Alert:** Stock is below the minimum ${metrics.min_threshold}-day threshold! You should request an emergency transfer or indent.` 
              : `✅ Stock level is within safe operating parameters.`),
      action: 'STOCK_SUMMARY',
      data: metrics
    };
  }

  // 3. Expiry query: "What medicines are expiring soon?" / "காலாவதி"
  if (query.includes('expir') || query.includes('காலாவதி')) {
    const expiringBatches = db.prepare(`
      SELECT b.batch_number, b.expiry_date, b.quantity, m.name as medicine_name, m.unit
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.phc_id = ? AND b.quantity > 0 AND date(b.expiry_date) <= date('now', '+90 days')
      ORDER BY b.expiry_date ASC
      LIMIT 5
    `).all(currentPhcId);

    if (expiringBatches.length === 0) {
      return {
        reply: `Great news! No medicine batches at ${currentPhc ? currentPhc.name : 'your PHC'} are scheduled to expire within the next 90 days. All stock is fresh.`
      };
    }

    const expText = expiringBatches.map(b => 
      `• **${b.medicine_name}** (Batch: ${b.batch_number}): **${b.quantity} ${b.unit}** expiring on **${b.expiry_date}**`
    ).join('\n');

    return {
      reply: `⚠️ **Batches Expiring Soon (Next 90 Days) at ${currentPhc ? currentPhc.name : 'your PHC'}**:\n\n${expText}\n\n💡 Tip: Consider prioritizing these batches for dispensing or offering surplus transfer to higher-consumption centres before expiry.`,
      action: 'EXPIRY_LIST'
    };
  }

  // 4. Critical Stockout / Shortage query: "What is low?" / "Show shortages" / "பற்றாக்குறை"
  if (query.includes('shortage') || query.includes('critical') || query.includes('low stock') || query.includes('stockout') || query.includes('பற்றாக்குறை')) {
    const lowStockAlerts = db.prepare(`
      SELECT a.title, a.message, a.severity, m.name as medicine_name
      FROM alerts a
      JOIN medicines m ON a.medicine_id = m.id
      WHERE a.phc_id = ? AND a.status = 'new'
      ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END
      LIMIT 5
    `).all(currentPhcId);

    if (lowStockAlerts.length === 0) {
      return {
        reply: `All monitored medicines at ${currentPhc ? currentPhc.name : 'your PHC'} are currently above minimum safety thresholds. No active shortage alerts!`
      };
    }

    const alertText = lowStockAlerts.map(a => `• **${a.medicine_name}** [${a.severity.toUpperCase()}]: ${a.message}`).join('\n');
    return {
      reply: `🚨 **Active Shortages & Alerts for ${currentPhc ? currentPhc.name : 'your PHC'}**:\n\n${alertText}\n\nWould you like to auto-match these shortages with nearby PHCs?`,
      action: 'SHORTAGE_LIST'
    };
  }

  // 5. Default Tamil or English conversational greeting & guide
  if (query.includes('வணக்கம்') || query.includes('ஹலோ') || query.includes('help') || query.includes('உதவி')) {
    return {
      reply: `வணக்கம்! நான் உங்கள் **MediSync PHC AI உதவியாளர்** (Smart Health Assistant).\n\nநீங்கள் கேட்கக்கூடிய கேள்விகள்:\n1. *"Who nearby has Paracetamol syrup and how far is it?"*\n2. *"How many days of Amoxicillin do we have?"*\n3. *"Which medicines are expiring within 60 days?"*\n4. *"Show critical shortages at my PHC."*\n\nஎவ்வாறு உதவ வேண்டும் என்று தட்டச்சு செய்யவும்!`
    };
  }

  return {
    reply: `I can help you monitor medicine stock, find nearby surplus, estimate days-of-stock, and track expiry.\n\nTry asking:\n• *"Who nearby has ORS and how far is it?"*\n• *"How many days of Metformin do we have?"*\n• *"Show me medicines expiring soon"*\n• *"What are our active stock shortages?"*`
  };
}

module.exports = {
  handleChatbotQuery
};
