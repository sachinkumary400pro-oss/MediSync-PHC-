from typing import List, Dict, Any, Set, Tuple


def compute_minimal_set_cover(
    sources_data: List[Dict[str, Any]],
    requested_med_ids: List[str],
) -> Dict[str, Any]:
    """
    Greedy Set Cover algorithm to find the minimum number of facilities that
    jointly supply all or the maximum possible number of requested medicines.
    Prefers free government sources and closer locations.
    """
    needed: Set[str] = set(requested_med_ids)
    covered: Set[str] = set()
    selected_itinerary: List[Dict[str, Any]] = []

    remaining_candidates = [dict(s) for s in sources_data if s.get("in_stock_medicines")]

    while needed and remaining_candidates:
        # Score each candidate by how many *uncovered* medicines it can provide
        def candidate_sort_key(candidate: Dict[str, Any]):
            can_cover = set(candidate.get("in_stock_medicines", [])) & needed
            is_free = 1 if candidate.get("ownership") == "government" or candidate.get("estimated_cost", 0) == 0 else 0
            distance = candidate.get("distance_km", 999.0)
            # Maximize newly covered items, prioritize free, minimize distance
            return (len(can_cover), is_free, -distance)

        # Sort descending by key
        remaining_candidates.sort(key=candidate_sort_key, reverse=True)
        best = remaining_candidates[0]
        newly_covered = set(best.get("in_stock_medicines", [])) & needed

        if not newly_covered:
            # None of the remaining candidates can cover any more needed medicines
            break

        selected_entry = {
            "source_id": best["source_id"],
            "name": best["name"],
            "source_type": best["source_type"],
            "ownership": best["ownership"],
            "distance_km": best["distance_km"],
            "phone": best.get("phone", ""),
            "latitude": best.get("latitude"),
            "longitude": best.get("longitude"),
            "covers_medicines": sorted(list(newly_covered)),
            "covers_count": len(newly_covered),
            "estimated_cost": sum(
                best.get("medicine_prices", {}).get(m, 0.0) for m in newly_covered
            ),
        }
        selected_itinerary.append(selected_entry)
        covered.update(newly_covered)
        needed -= newly_covered
        remaining_candidates.pop(0)

    total_distance = sum(s["distance_km"] for s in selected_itinerary)
    total_cost = sum(s["estimated_cost"] for s in selected_itinerary)

    return {
        "is_complete_coverage": len(needed) == 0,
        "total_requested": len(requested_med_ids),
        "total_covered": len(covered),
        "uncovered_medicine_ids": sorted(list(needed)),
        "itinerary_stops": len(selected_itinerary),
        "suggested_sources": selected_itinerary,
        "total_itinerary_distance_km": round(total_distance, 2),
        "total_estimated_cost": round(total_cost, 2),
    }
