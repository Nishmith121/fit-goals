// Phase 6: End-of-Day Wrap Up, Streaks & Trophies (storageEngine.js)

const STORAGE_KEYS = {
  MEALS: "fitgoals_meals_today",
  USER_STATS: "fitgoals_user_stats",
  HISTORY: "fitgoals_history_days",
  TROPHIES: "fitgoals_unlocked_trophies",
  SCREEN_TIME: "fitgoals_screen_time_state"
};

export const ALL_TROPHIES = [
  {
    id: "sugar_slayer_3",
    name: "3-Day Sugar Slayer",
    icon: "🗡️",
    description: "Went 3 consecutive days with 0 sugary items or sodas.",
    condition: (stats) => stats.sugarFreeStreak >= 3,
    xpReward: 150,
    tier: "Bronze"
  },
  {
    id: "weekend_shield",
    name: "Weekend Shield",
    icon: "🛡️",
    description: "Kept Grade A or B clean diet through Saturday and Sunday without cheat relapse.",
    condition: (stats) => stats.cleanStreak >= 2 && stats.totalCompletedDays >= 2,
    xpReward: 200,
    tier: "Silver"
  },
  {
    id: "clean_titan_7",
    name: "7-Day Clean Titan",
    icon: "⚡",
    description: "Completed 7 continuous days with Grade B or higher.",
    condition: (stats) => stats.cleanStreak >= 7,
    xpReward: 500,
    tier: "Gold"
  },
  {
    id: "discipline_master_30",
    name: "30-Day Master of Discipline",
    icon: "👑",
    description: "A full month of relentless nutrition tracking and clean fueling.",
    condition: (stats) => stats.totalCompletedDays >= 30,
    xpReward: 1500,
    tier: "Diamond"
  },
  {
    id: "first_clean_day",
    name: "Sprout Ignition",
    icon: "🌱",
    description: "Completed your very first clean eating day with Grade A+.",
    condition: (stats) => stats.totalCompletedDays >= 1 && stats.highestGrade === "A+",
    xpReward: 100,
    tier: "Bronze"
  },
  {
    id: "screen_vault_master",
    name: "Vault Guardian",
    icon: "⏳",
    description: "Earned the maximum 120 minutes of screen time allowance.",
    condition: (stats) => stats.maxMinutesEarned >= 120,
    xpReward: 120,
    tier: "Silver"
  }
];

// Initial default user state
const DEFAULT_USER_STATS = {
  totalXP: 180,
  cleanStreak: 2,
  sugarFreeStreak: 3,
  totalCompletedDays: 2,
  highestGrade: "A+",
  maxMinutesEarned: 120,
  lastCompletedDate: null
};

export function loadUserStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_STATS);
    return saved ? { ...DEFAULT_USER_STATS, ...JSON.parse(saved) } : DEFAULT_USER_STATS;
  } catch (e) {
    return DEFAULT_USER_STATS;
  }
}

export function saveUserStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to save stats", e);
  }
}

export function loadTodayMeals() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MEALS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  
  // Default sample starting state
  return [
    { id: "m1", slot: "breakfast", name: "Dosa with Sambar", ingredients: "fermented rice dal batter, lentils, drumstick", type: "healthy", xp: 20, isClean: true, isSugarOrJunk: false, badgeText: "🟢 Healthy Fuel (+20 XP)", time: "08:30 AM" },
    { id: "m2", slot: "lunch", name: "Brown Rice & Dal with Boiled Eggs", ingredients: "brown rice, toor dal, 2 whole boiled eggs, cucumber", type: "healthy", xp: 25, isClean: true, isSugarOrJunk: false, badgeText: "🟢 Healthy Fuel (+25 XP)", time: "01:15 PM" },
    { id: "m3", slot: "snacks", name: "Sprouts Salad", ingredients: "moong sprouts, onion, tomato, lemon, green chilli", type: "healthy", xp: 25, isClean: true, isSugarOrJunk: false, badgeText: "🟢 Healthy Fuel (+25 XP)", time: "05:00 PM" },
    { id: "m4", slot: "dinner", name: "Grilled Paneer & Vegetables", ingredients: "paneer, capsicum, onion, black pepper, olive oil", type: "healthy", xp: 22, isClean: true, isSugarOrJunk: false, badgeText: "🟢 Healthy Fuel (+22 XP)", time: "08:45 PM" }
  ];
}

export function saveTodayMeals(meals) {
  try {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
  } catch (e) {}
}

export function loadUnlockedTrophies() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TROPHIES);
    return saved ? JSON.parse(saved) : ["sugar_slayer_3", "first_clean_day"];
  } catch (e) {
    return ["sugar_slayer_3", "first_clean_day"];
  }
}

export function saveUnlockedTrophies(trophies) {
  try {
    localStorage.setItem(STORAGE_KEYS.TROPHIES, JSON.stringify(trophies));
  } catch (e) {}
}

export function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return saved ? JSON.parse(saved) : [
      { date: "Yesterday", grade: "A+", index: 95, xp: 92, sugarFree: true, mealsCount: 4 },
      { date: "2 days ago", grade: "A+", index: 92, xp: 88, sugarFree: true, mealsCount: 4 }
    ];
  } catch (e) {
    return [];
  }
}

export function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (e) {}
}
