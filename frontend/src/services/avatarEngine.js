// Phase 4: Evolving Avatar & XP Progression (avatarEngine.js)

export const AVATAR_STAGES = [
  {
    stage: 1,
    name: "Sprout Rookie",
    levelRange: [1, 5],
    minLevel: 1,
    maxLevel: 5,
    title: "Novice Clean Eater",
    themeColor: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
    badge: "🌱",
    iconName: "sprout",
    description: "Taking the first disciplined steps towards peak fitness and clean energy.",
    perks: ["Unlocks Basic Meal Logging", "Unlocks Screen Time Bank Vault"]
  },
  {
    stage: 2,
    name: "Iron Warrior",
    levelRange: [6, 15],
    minLevel: 6,
    maxLevel: 15,
    title: "Athletic Powerhouse",
    themeColor: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.5)",
    badge: "⚔️",
    iconName: "warrior",
    description: "Forged in consistency. Lean muscle mass and athletic energy unlocked!",
    perks: ["+15% Bonus Screen Time Bank", "Neon Aura Visual Unlock", "Daily Report Card Badges"]
  },
  {
    stage: 3,
    name: "Cyber Champion",
    levelRange: [16, 30],
    minLevel: 16,
    maxLevel: 30,
    title: "Mecha Bio-Hacker",
    themeColor: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.6)",
    badge: "⚡",
    iconName: "cyber",
    description: "High-tech metabolic efficiency. Junk food cravings are completely eliminated.",
    perks: ["Mecha Cyber Armor Skin", "Social Media Overdrive Lock", "Exclusive Titan Trophies"]
  },
  {
    stage: 4,
    name: "Zen Titan",
    levelRange: [31, 999],
    minLevel: 31,
    maxLevel: 999,
    title: "Master of Discipline & Mind",
    themeColor: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.7)",
    badge: "👑",
    iconName: "titan",
    description: "The ultimate form. Complete mastery over nutrition, longevity, and mind.",
    perks: ["Golden Halo & Supernova Aura", "Infinite Streak Multiplier", "God-Tier Trophy Hall"]
  }
];

const BASE_XP_PER_LEVEL = 100;

/**
 * Calculates level, current XP towards next level, and Avatar Stage
 */
export function getAvatarProgress(totalXP = 0) {
  let level = 1;
  let remainingXP = Math.max(0, totalXP);
  let xpNeededForNext = BASE_XP_PER_LEVEL;

  while (remainingXP >= xpNeededForNext) {
    remainingXP -= xpNeededForNext;
    level += 1;
    // Slight progressive scaling per level
    xpNeededForNext = Math.round(BASE_XP_PER_LEVEL * (1 + (level - 1) * 0.15));
  }

  // Determine Current Stage
  let currentStage = AVATAR_STAGES[0];
  for (const st of AVATAR_STAGES) {
    if (level >= st.minLevel && level <= st.maxLevel) {
      currentStage = st;
      break;
    }
  }

  const progressPercent = Math.min(100, Math.round((remainingXP / xpNeededForNext) * 100));

  return {
    level,
    totalXP,
    currentXP: remainingXP,
    xpNeededForNext,
    progressPercent,
    stage: currentStage
  };
}
