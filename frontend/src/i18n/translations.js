/**
 * MediSync PHC - English & Tamil (தமிழ்) Localization Dictionary
 */

export const translations = {
  en: {
    // Branding & Header
    app_title: 'MediSync PHC',
    app_subtitle: 'Tamil Nadu Primary Health Centre Medicine Stock & Sharing System',
    govt_title: 'Government of Tamil Nadu',
    dept_title: 'Department of Public Health & Preventive Medicine',
    switch_language: 'தமிழ்',
    
    // Roles
    role_pharmacist: 'Pharmacist',
    role_mo: 'Medical Officer',
    role_bmo: 'Block Medical Officer',
    role_admin: 'District Health Admin',
    role_public: 'Citizen Portal',
    
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_inventory: 'Stock Inventory',
    nav_entry: 'Daily Stock Entry',
    nav_nearby: 'Nearby Stock Finder',
    nav_transfers: 'Transfers & Indents',
    nav_ai: 'AI & Forecasting',
    nav_chat: 'Staff AI Chatbot',
    nav_reports: 'Reports & Analytics',
    nav_public: 'Public Checker',
    nav_admin: 'System Admin',

    // Statuses & Thresholds
    status_adequate: 'Adequate Stock (>30 Days)',
    status_low: 'Low Stock (15-30 Days)',
    status_critical: 'Critical Shortage (<15 Days)',
    status_out: 'Out of Stock (0 Days)',
    status_surplus: 'Surplus (>60 Days)',
    days_left: 'Days Left',
    units_day: 'units/day',
    current_stock: 'Current Stock',
    spareable_surplus: 'Spareable Surplus',
    distance_km: 'Distance (km)',

    // Actions & Buttons
    btn_find_nearby: 'Find Nearby Surplus',
    btn_request_transfer: 'Request Transfer',
    btn_approve: 'Approve',
    btn_dispatch: 'Mark In Transit',
    btn_receive: 'Confirm Receipt',
    btn_print_slip: 'Print Transfer Slip',
    btn_auto_draft: 'Auto-Draft Emergency Indent',
    btn_run_rebalancing: 'Run District Rebalancer',
    btn_save_entry: 'Save Stock Entry',
    btn_search: 'Search Medicines...',

    // Alerts & Messages
    alert_cold_chain_warning: 'Cold Chain Required (2°C - 8°C)',
    alert_critical_life_saving: 'Critical / Life-Saving Medicine',
    confirm_cold_chain: 'I confirm that cold chain equipment (vaccine carrier / ice packs) is arranged for this transit.',
    offline_mode: 'Working Offline - Changes will sync automatically when online',
    online_synced: 'Online & Synced with District Server',

    // Multi-Source Finder & Map
    nav_multi_map: 'Multi-Source Stock Map',
    nav_source_manager: 'Source Stock Manager',
    nav_source_admin: 'Facility Admin',
    type_phc: 'Primary Health Centre (PHC)',
    type_sub_centre: 'Sub-Centre / HWC',
    type_chc_hospital: 'CHC / Taluk Hospital',
    type_warehouse: 'District Warehouse (TNMSC)',
    type_jan_aushadhi_coop: 'Jan Aushadhi / Amma Marundhagam',
    type_private_pharmacy: 'Private Retail Pharmacy',
    type_private_hospital: 'Private Hospital Pharmacy',
    type_ngo_dispensary: 'NGO / Charitable Dispensary',
    filter_all_types: 'All Facility Types',
    filter_free_only: 'Free Only (Govt)',
    filter_open_now: 'Open Now',
    filter_24x7: '24x7 Open',
    filter_in_stock_only: 'In Stock Only',
    find_near_me: 'Find Near Me (GPS)',
    search_from_phc: 'Search from PHC',
    btn_find_alternatives: 'Find Alternatives',
    best_combination: 'Optimal Multi-Source Combination',
    call_source: 'Call Facility',
    directions: 'Directions',
    stale_data_warning: 'Data reported >24 hrs ago. Call facility to verify before visiting.',
    disclaimer_call_before: 'Stock is self-reported by facility and fluctuates rapidly. Please call before visiting.'
  },
  ta: {
    // Branding & Header
    app_title: 'மெடிசின்க் ஆரம்ப சுகாதார நிலையம்',
    app_subtitle: 'தமிழ்நாடு அரசு ஆரம்ப சுகாதார நிலைய மருந்து இருப்பு மற்றும் பகிர்வு முறைமை',
    govt_title: 'தமிழ்நாடு அரசு',
    dept_title: 'பொது சுகாதாரம் மற்றும் நோய் தடுப்பு மருந்துத்துறை',
    switch_language: 'English',

    // Roles
    role_pharmacist: 'மருந்தாளுநர்',
    role_mo: 'மருத்துவ அலுவலர் (MO)',
    role_bmo: 'வட்டார மருத்துவ அலுவலர் (BMO)',
    role_admin: 'மாவட்ட சுகாதார நிர்வாகி',
    role_public: 'பொதுமக்கள் சேவை',

    // Navigation
    nav_dashboard: 'முகப்பு பலகை',
    nav_inventory: 'மருந்து இருப்பு பட்டியல்',
    nav_entry: 'தினசரி இருப்பு பதிவு',
    nav_nearby: 'அருகிலுள்ள இருப்பு தேடல்',
    nav_transfers: 'பகிர்வு & அவசர கோரிக்கை',
    nav_ai: 'AI & முன்கணிப்பு',
    nav_chat: 'AI ஊழியர் உதவியாளர்',
    nav_reports: 'அறிக்கைகள்',
    nav_public: 'பொது இருப்பு சரிபார்ப்பு',
    nav_admin: 'நிர்வாக அமைப்பு',

    // Statuses & Thresholds
    status_adequate: 'போதுமான இருப்பு (>30 நாட்கள்)',
    status_low: 'குறைந்த இருப்பு (15-30 நாட்கள்)',
    status_critical: 'அவசர பற்றாக்குறை (<15 நாட்கள்)',
    status_out: 'இருப்பில் இல்லை (0 நாட்கள்)',
    status_surplus: 'உபரி இருப்பு (>60 நாட்கள்)',
    days_left: 'மீதமுள்ள நாட்கள்',
    units_day: 'அளவுகள்/நாள்',
    current_stock: 'தற்போதைய இருப்பு',
    spareable_surplus: 'வழங்கக்கூடிய உபரி',
    distance_km: 'தொலைவு (கி.மீ)',

    // Actions & Buttons
    btn_find_nearby: 'அருகிலுள்ள உபரியை தேடு',
    btn_request_transfer: 'பகிர்வு கோரிக்கை அனுப்பு',
    btn_approve: 'ஒப்புதல் அளி',
    btn_dispatch: 'வாகனம் புறப்பட்டது',
    btn_receive: 'இருப்பு பெறப்பட்டது',
    btn_print_slip: 'பகிர்வு ரசீது அச்சிடு',
    btn_auto_draft: 'தானியங்கி அவசர கோரிக்கை',
    btn_run_rebalancing: 'மாவட்ட பகிர்வு திட்டம்',
    btn_save_entry: 'இருப்பு விவரத்தை சேமி',
    btn_search: 'மருந்துகளைத் தேடவும்...',

    // Alerts & Messages
    alert_cold_chain_warning: 'குளிர்சங்கிலி கட்டாயம் (2°C - 8°C)',
    alert_critical_life_saving: 'உயிர் காக்கும் அவசிய மருந்து',
    confirm_cold_chain: 'குளிர்சங்கிலி பேக் மற்றும் ஐஸ் பெட்டி ஏற்பாடு செய்யப்பட்டுள்ளதை உறுதிப்படுத்துகிறேன்.',
    offline_mode: 'இணையம் இல்லை - இணையம் வந்ததும் தானாக சேமிக்கப்படும்',
    online_synced: 'இணைய இணைப்பு உள்ளது - தரவுகள் ஒத்திசைக்கப்பட்டன',

    // Multi-Source Finder & Map
    nav_multi_map: 'அனைத்து நிலைய மருந்து வரைபடம்',
    nav_source_manager: 'மருந்து இருப்பு மேலாளர்',
    nav_source_admin: 'மருத்துவ நிலைய நிர்வாகம்',
    type_phc: 'ஆரம்ப சுகாதார நிலையம் (PHC)',
    type_sub_centre: 'துணை சுகாதார நிலையம் (HWC)',
    type_chc_hospital: 'வட்டார / தாலுகா மருத்துவமனை',
    type_warehouse: 'மாவட்ட மருந்து கிடங்கு (TNMSC)',
    type_jan_aushadhi_coop: 'ஜன் ஔஷதி / அம்மா மருந்தகம்',
    type_private_pharmacy: 'தனியார் மருந்தகம்',
    type_private_hospital: 'தனியார் மருத்துவமனை மருந்தகம்',
    type_ngo_dispensary: 'தன்னார்வ மருந்தகம்',
    filter_all_types: 'அனைத்து மருத்துவ நிலையங்கள்',
    filter_free_only: 'இலவச அரசு மருந்துகள் மட்டும்',
    filter_open_now: 'தற்போது திறந்துள்ளது',
    filter_24x7: '24 மணி நேர சேவை',
    filter_in_stock_only: 'இருப்பில் உள்ளவை மட்டும்',
    find_near_me: 'எனது அருகிலுள்ளவை (GPS)',
    search_from_phc: 'ஆரம்ப சுகாதார நிலையத்திலிருந்து தேடு',
    btn_find_alternatives: 'மாற்று வழிகளைத் தேடு',
    best_combination: 'குறைந்த பயணத்தில் அனைத்து மருந்துகளும்',
    call_source: 'தொடர்பு கொள்ள',
    directions: 'வழித்தடம்',
    stale_data_warning: '24 மணி நேரத்திற்கு முந்தைய இருப்பு விபரம். செல்வதற்கு முன் தொலைபேசியில் உறுதி செய்யவும்.',
    disclaimer_call_before: 'மருந்து இருப்பு மாற்றத்திற்குட்பட்டது. செல்வதற்கு முன் உறுதி செய்யவும்.'
  }
};

