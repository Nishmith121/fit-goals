// Phase 5: Screen-Time & Reward Bank (rewardsEngine.js)

export const BASE_DAILY_SCREEN_TIME_MINUTES = 120; // 2 Hours base reward
export const JUNK_TIME_PENALTY_MINUTES = 35; // 35 minutes deducted per junk item

export const SUPPORTED_APPS = [
  { id: "instagram", name: "Instagram & Reels", icon: "📸", color: "#e1306c" },
  { id: "youtube", name: "YouTube & Shorts", icon: "▶️", color: "#ff0000" },
  { id: "gaming", name: "Mobile / PC Gaming", icon: "🎮", color: "#10b981" },
  { id: "netflix", name: "Netflix & Movies", icon: "🍿", color: "#e50914" }
];

/**
 * Calculates earned minutes based on logged meals and cleanliness grade
 */
export function calculateScreenTimeAllowance(loggedMeals = [], cleanlinessGrade = "A+") {
  let junkCount = 0;
  let cleanCount = 0;

  loggedMeals.forEach((meal) => {
    if (meal.isSugarOrJunk || (meal.type === "junk")) {
      junkCount++;
    } else if (meal.isClean || (meal.type === "healthy")) {
      cleanCount++;
    }
  });

  // Base calculation
  let baseMinutes = BASE_DAILY_SCREEN_TIME_MINUTES;

  // Grade adjustment
  if (cleanlinessGrade === "A+") {
    baseMinutes = 120;
  } else if (cleanlinessGrade === "B") {
    baseMinutes = 90;
  } else if (cleanlinessGrade === "C") {
    baseMinutes = 45;
  } else {
    baseMinutes = 15; // Grade F minimum allowance
  }

  // Deduct penalty for junk items
  const totalPenalties = junkCount * JUNK_TIME_PENALTY_MINUTES;
  const availableMinutes = Math.max(0, baseMinutes - totalPenalties);

  return {
    baseMinutes,
    availableMinutes,
    deductedMinutes: totalPenalties,
    junkCount,
    cleanCount,
    grade: cleanlinessGrade,
    isFullyUnlocked: availableMinutes >= 90
  };
}
