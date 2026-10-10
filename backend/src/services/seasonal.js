/**
 * MediSync PHC - Seasonal Demand & Climate Buffer Service
 * Specific to Tamil Nadu climatic cycles (Northeast Monsoon, Southwest Monsoon, Summer)
 */

function getSeasonalProfile(targetMonth = null) {
  const month = targetMonth !== null ? targetMonth : (new Date().getMonth() + 1); // 1 to 12

  // Tamil Nadu Climate Seasons:
  // Oct - Dec: Northeast Monsoon (retreating monsoon) - highest rainfall, floods, vector-borne (Dengue, Malaria), viral fever, typhoid
  // Jun - Sep: Southwest Monsoon - moderate rain, gastro-enteritis, seasonal flu
  // Mar - May: Summer / Kathiri Veyyil - intense heat, dehydration, heat exhaustion, gastro-enteritis
  // Jan - Feb: Post-monsoon winter - mild respiratory tract infections

  if (month >= 10 && month <= 12) {
    return {
      season_name: 'Northeast Monsoon & Cyclone Season (வடகிழக்கு பருவமழை)',
      code: 'NE_MONSOON',
      risk_level: 'VERY_HIGH',
      description: 'Peak vector-borne fever, dengue, leptospirosis and respiratory illness period across coastal and inland Tamil Nadu.',
      multipliers: {
        'Paracetamol': 1.6,
        'ORS': 1.8,
        'Amoxicillin': 1.5,
        'Doxycycline': 1.7,
        'Cetirizine': 1.4,
        'Anti-Snake Venom': 1.6,
        'Zinc Sulphate': 1.5,
        'Ciprofloxacin': 1.4
      },
      recommended_buffer_days: 45 // Increase buffer from 30 to 45 days
    };
  } else if (month >= 6 && month <= 9) {
    return {
      season_name: 'Southwest Monsoon (தென்மேற்கு பருவமழை)',
      code: 'SW_MONSOON',
      risk_level: 'MODERATE_HIGH',
      description: 'Moderate rain season with water-borne gastrointestinal cases and seasonal viral fevers.',
      multipliers: {
        'ORS': 1.6,
        'Paracetamol': 1.3,
        'Metronidazole': 1.4,
        'Zinc Sulphate': 1.4,
        'Anti-Snake Venom': 1.4
      },
      recommended_buffer_days: 35
    };
  } else if (month >= 3 && month <= 5) {
    return {
      season_name: 'Summer / Kathiri Season (கோடை காலம்)',
      code: 'SUMMER_HEAT',
      risk_level: 'MODERATE',
      description: 'High heat index, acute dehydration, sunstroke and diarrheal diseases.',
      multipliers: {
        'ORS': 1.9,
        'Normal Saline IV': 1.7,
        'Dextrose Normal Saline': 1.5,
        'Zinc Sulphate': 1.4
      },
      recommended_buffer_days: 35
    };
  } else {
    return {
      season_name: 'Post-Monsoon Winter (குளிர் பருவம்)',
      code: 'POST_MONSOON',
      risk_level: 'NORMAL',
      description: 'Standard baseline consumption with slight elevation in pediatric bronchial allergies.',
      multipliers: {
        'Paracetamol': 1.1,
        'Cetirizine': 1.2
      },
      recommended_buffer_days: 30
    };
  }
}

function calculateSeasonalAdjustedDemand(medicineName, baselineAvgDaily, targetMonth = null) {
  const profile = getSeasonalProfile(targetMonth);
  let multiplier = 1.0;

  for (const [key, factor] of Object.entries(profile.multipliers)) {
    if (medicineName.toLowerCase().includes(key.toLowerCase())) {
      multiplier = factor;
      break;
    }
  }

  const seasonalDailyRate = baselineAvgDaily * multiplier;
  const suggestedStockBuffer = Math.ceil(seasonalDailyRate * profile.recommended_buffer_days);

  return {
    season: profile.season_name,
    risk_level: profile.risk_level,
    multiplier,
    baselineDaily: baselineAvgDaily,
    adjustedDaily: parseFloat(seasonalDailyRate.toFixed(1)),
    suggestedBufferQty: suggestedStockBuffer,
    recommendedBufferDays: profile.recommended_buffer_days
  };
}

module.exports = {
  getSeasonalProfile,
  calculateSeasonalAdjustedDemand
};
