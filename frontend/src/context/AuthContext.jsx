import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const AuthContext = createContext();

const PRESET_USERS = {
  pharmacist: {
    id: 'usr_pharm_01',
    username: 'pharmacist1',
    full_name: 'Mr. R. Murugan, D.Pharm',
    role: 'pharmacist',
    phc_id: 'phc_cpt_01',
    phc_name: 'PHC Alapakkam',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '9840112233'
  },
  medical_officer: {
    id: 'usr_mo_01',
    username: 'doctor1',
    full_name: 'Dr. S. Karthi, MBBS (MO)',
    role: 'medical_officer',
    phc_id: 'phc_cpt_01',
    phc_name: 'PHC Alapakkam',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '9840223344'
  },
  pharmacist_donor: {
    id: 'usr_pharm_02',
    username: 'pharmacist2',
    full_name: 'Mrs. K. Banumathi, B.Pharm',
    role: 'pharmacist',
    phc_id: 'phc_cpt_02',
    phc_name: 'PHC Melamaiyur (Surplus Donor)',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '9840334455'
  },
  block_medical_officer: {
    id: 'usr_bmo_01',
    username: 'bmo1',
    full_name: 'Dr. T. Rajan, MD (Block MO)',
    role: 'block_medical_officer',
    phc_id: null,
    phc_name: null,
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block (5 PHCs)',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '9840556677'
  },
  district_admin: {
    id: 'usr_admin_01',
    username: 'admin',
    full_name: 'Dr. P. Sundaram (DDHS / District Admin)',
    role: 'district_admin',
    phc_id: null,
    phc_name: null,
    block_id: null,
    block_name: null,
    district_id: 'dist_01',
    district_name: 'Chengalpattu District (15 PHCs)',
    phone: '9840998877'
  },
  public: {
    id: 'public_guest',
    username: 'public',
    full_name: 'Citizen / Public Viewer',
    role: 'public',
    phc_id: 'phc_cpt_01',
    phc_name: 'PHC Alapakkam',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu'
  },
  source_manager_apollo: {
    id: 'usr_mgr_apollo',
    username: 'manager_apollo',
    full_name: 'Mr. S. Ramesh (Apollo Pharmacy Mgr)',
    role: 'source_manager',
    phc_id: null,
    source_id: 'src_pharm_01',
    source_name: 'Apollo Pharmacy - Alapakkam Road',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '044-27428801'
  },
  source_manager_ja: {
    id: 'usr_mgr_ja',
    username: 'manager_janaushadhi',
    full_name: 'Mrs. N. Lakshmi (Jan Aushadhi Mgr)',
    role: 'source_manager',
    phc_id: null,
    source_id: 'src_ja_01',
    source_name: 'PM Jan Aushadhi Kendra - Bus Stand',
    block_id: 'blk_cpt',
    block_name: 'Chengalpattu Block',
    district_id: 'dist_01',
    district_name: 'Chengalpattu District',
    phone: '044-27431101'
  }
};

// Maps each demo persona to a seeded backend account so a real JWT is issued
// and server-side RBAC resolves to the correct PHC.
const CREDENTIALS = {
  pharmacist: { email: 'pharmacist1@tnhealth.gov.in', password: 'password123' },
  medical_officer: { email: 'doctor1@tnhealth.gov.in', password: 'password123' },
  pharmacist_donor: { email: 'pharmacist2@tnhealth.gov.in', password: 'password123' },
  block_medical_officer: { email: 'bmo1@tnhealth.gov.in', password: 'password123' },
  district_admin: { email: 'admin@tnhealth.gov.in', password: 'admin123' },
  public: { email: 'pharmacist1@tnhealth.gov.in', password: 'password123' },
  source_manager_apollo: { email: 'manager_apollo@medisync.tn.gov.in', password: 'password123' },
  source_manager_ja: { email: 'manager_janaushadhi@medisync.tn.gov.in', password: 'password123' }
};

// Recovers the persona key from a persisted user object (older sessions stored
// only `medisync_user` without the newer `medisync_role_key`).
const inferRoleKey = (user) => {
  if (!user) return 'pharmacist';
  switch (user.role) {
    case 'district_admin':
      return 'district_admin';
    case 'block_medical_officer':
      return 'block_medical_officer';
    case 'medical_officer':
      return 'medical_officer';
    case 'source_manager':
      return user.source_id === 'src_ja_01' ? 'source_manager_ja' : 'source_manager_apollo';
    case 'public':
      return 'public';
    case 'pharmacist':
      return user.phc_id === 'phc_cpt_02' ? 'pharmacist_donor' : 'pharmacist';
    default:
      return 'pharmacist';
  }
};


export const AuthProvider = ({ children }) => {
  const [roleKey, setRoleKey] = useState(() => {
    const savedKey = localStorage.getItem('medisync_role_key');
    if (savedKey) return savedKey;
    const savedUser = localStorage.getItem('medisync_user');
    return inferRoleKey(savedUser ? JSON.parse(savedUser) : null);
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('medisync_user');
    return saved ? JSON.parse(saved) : PRESET_USERS.pharmacist;
  });

  const [token, setToken] = useState(() => localStorage.getItem('medisync_token') || null);
  const [authReady, setAuthReady] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('medisync_lang') || 'en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    const q = localStorage.getItem('medisync_offline_queue');
    return q ? JSON.parse(q) : [];
  });

  const loginAs = async (key) => {
    const creds = CREDENTIALS[key] || CREDENTIALS.pharmacist;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });
    if (!res.ok) {
      throw new Error(`Login failed for role '${key}' (${res.status})`);
    }
    const data = await res.json();
    setToken(data.access_token);
    localStorage.setItem('medisync_token', data.access_token);
    return data;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loginAs(roleKey);
      } catch (err) {
        // Token stays null; authenticated requests will surface 401s.
        console.error(err);
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const switchRole = async (key) => {
    const user = PRESET_USERS[key] || PRESET_USERS.pharmacist;
    setRoleKey(key);
    localStorage.setItem('medisync_role_key', key);
    setCurrentUser(user);
    localStorage.setItem('medisync_user', JSON.stringify(user));
    try {
      await loginAs(key);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ta' : 'en';
    setLang(nextLang);
    localStorage.setItem('medisync_lang', nextLang);
  };

  const t = (key) => {
    const langDict = translations[lang] || translations.en;
    return langDict[key] || translations.en[key] || key;
  };

  const queueOfflineEntry = (entry) => {
    const updated = [...offlineQueue, { ...entry, id: `offline_${Date.now()}` }];
    setOfflineQueue(updated);
    localStorage.setItem('medisync_offline_queue', JSON.stringify(updated));
  };

  const clearOfflineQueue = () => {
    setOfflineQueue([]);
    localStorage.removeItem('medisync_offline_queue');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        token,
        setToken,
        authReady,
        loginAs,
        switchRole,
        PRESET_USERS,
        lang,
        setLang,
        toggleLanguage,
        t,
        isOnline,
        offlineQueue,
        queueOfflineEntry,
        clearOfflineQueue
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
