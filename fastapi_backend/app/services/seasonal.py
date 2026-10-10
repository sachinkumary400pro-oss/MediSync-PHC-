from datetime import datetime
from typing import Dict, Any


def get_seasonal_profile(month: int = None) -> Dict[str, Any]:
    """Returns Tamil Nadu seasonal risk factors and multipliers for epidemics and climatic surges."""
    if month is None:
        month = datetime.utcnow().month

    if 10 <= month <= 12:
        return {
            "season_name": "Northeast Monsoon (வடகிழக்கு பருவமழை)",
            "season_code": "NE_MONSOON",
            "risk_level": "VERY_HIGH",
            "description": "Peak coastal cyclone & flood season; high incidence of dengue, viral fevers, leptospirosis and water-borne infections across Tamil Nadu.",
            "recommended_buffer_days": 45,
            "multipliers": {
                "paracetamol": 1.6,
                "ors": 1.8,
                "amoxicillin": 1.5,
                "doxycycline": 1.7,
                "cetirizine": 1.4,
                "snake venom": 1.6,
                "zinc": 1.5
            }
        }
    elif 6 <= month <= 9:
        return {
            "season_name": "Southwest Monsoon (தென்மேற்கு பருவமழை)",
            "season_code": "SW_MONSOON",
            "risk_level": "MODERATE_HIGH",
            "description": "Moderate monsoon rainfall; elevated cases of gastro-enteritis, seasonal flu and skin infections.",
            "recommended_buffer_days": 35,
            "multipliers": {
                "ors": 1.6,
                "paracetamol": 1.3,
                "metronidazole": 1.4,
                "zinc": 1.4,
                "snake venom": 1.4
            }
        }
    elif 3 <= month <= 5:
        return {
            "season_name": "Summer Kathiri Season (கோடை காலம்)",
            "season_code": "SUMMER_HEAT",
            "risk_level": "MODERATE",
            "description": "Severe heatwaves; acute dehydration, heat exhaustion and food-borne diarrheal episodes.",
            "recommended_buffer_days": 35,
            "multipliers": {
                "ors": 1.9,
                "saline": 1.7,
                "dextrose": 1.5,
                "zinc": 1.4
            }
        }
    else:
        return {
            "season_name": "Post-Monsoon Winter (குளிர் பருவம்)",
            "season_code": "POST_MONSOON",
            "risk_level": "NORMAL",
            "description": "Standard baseline disease burden with mild pediatric respiratory allergies.",
            "recommended_buffer_days": 30,
            "multipliers": {
                "paracetamol": 1.1,
                "cetirizine": 1.2
            }
        }


def get_seasonal_multiplier_for_medicine(medicine_name: str, month: int = None) -> float:
    profile = get_seasonal_profile(month)
    med_lower = medicine_name.lower()
    for key, mult in profile["multipliers"].items():
        if key in med_lower:
            return mult
    return 1.0
