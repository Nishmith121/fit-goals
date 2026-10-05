// Phase 2: Smart Food Classifier & Scoring Engine (foodEngine.js)

// Knowledge Base Rules & Keywords
export const FOOD_DATABASE = {
  healthy: [
    { name: "Dosa", xp: 15, pts: 15, category: "Clean Fuel", flags: ["Healthy", "Fibre_rich"], note: "Fermented batter rich in gut probiotics" },
    { name: "Idli", xp: 20, pts: 20, category: "Clean Fuel", flags: ["Healthy", "Good_food"], note: "Steamed fermented rice & lentils, zero oil" },
    { name: "Sambar", xp: 18, pts: 18, category: "Clean Fuel", flags: ["Healthy", "Protein_rich", "Fibre_rich"], note: "Lentils & vegetables stew packed with nutrients" },
    { name: "Dal", xp: 18, pts: 18, category: "Clean Fuel", flags: ["Healthy", "Protein_rich"], note: "Plant protein powerhouse" },
    { name: "Roti", xp: 12, pts: 12, category: "Clean Fuel", flags: ["Fibre_rich", "Good_food"], note: "Whole wheat complex carbohydrates" },
    { name: "Brown Rice", xp: 14, pts: 14, category: "Clean Fuel", flags: ["Fibre_rich"], note: "Low GI whole grain with dietary fibre" },
    { name: "Grilled Paneer", xp: 22, pts: 22, category: "Clean Fuel", flags: ["Protein_rich", "Healthy"], note: "High quality vegetarian protein & calcium" },
    { name: "Grilled Chicken", xp: 25, pts: 25, category: "Clean Fuel", flags: ["Protein_rich", "Healthy"], note: "Lean animal protein for muscle repair" },
    { name: "Boiled Eggs", xp: 22, pts: 22, category: "Clean Fuel", flags: ["Protein_rich", "Healthy"], note: "Complete amino acid profile & healthy fats" },
    { name: "Sprouts Salad", xp: 25, pts: 25, category: "Clean Fuel", flags: ["Healthy", "Protein_rich", "Fibre_rich"], note: "Live enzymes, bio-available micronutrients" },
    { name: "Oats", xp: 18, pts: 18, category: "Clean Fuel", flags: ["Healthy", "Fibre_rich"], note: "Beta-glucan fibre to stabilize blood sugar" },
    { name: "Fresh Fruits", xp: 16, pts: 16, category: "Clean Fuel", flags: ["Healthy", "Fibre_rich"], note: "Natural vitamins, antioxidants & hydration" },
    { name: "Mixed Nuts", xp: 15, pts: 15, category: "Clean Fuel", flags: ["Healthy", "Protein_rich"], note: "Omega-3s & sustained healthy fats" },
    { name: "Green Vegetables", xp: 20, pts: 20, category: "Clean Fuel", flags: ["Healthy", "Fibre_rich"], note: "Micronutrient density & gut health" },
    { name: "Curd / Greek Yogurt", xp: 18, pts: 18, category: "Clean Fuel", flags: ["Healthy", "Protein_rich"], note: "Probiotic and gut-nourishing protein" },
    { name: "Khichdi", xp: 16, pts: 16, category: "Clean Fuel", flags: ["Healthy", "Good_food"], note: "Easily digestible ayurvedic superfood" }
  ],
  moderate: [
    { name: "Plain White Rice", xp: 5, pts: 5, category: "Moderate", flags: ["Good_food"], note: "Fast energy source, pair with protein & fibre" },
    { name: "Home Curry", xp: 5, pts: 5, category: "Moderate", flags: ["Good_food"], note: "Moderate spices & oils" },
    { name: "Fruit Juice (No Sugar)", xp: 4, pts: 4, category: "Moderate", flags: ["Healthy"], note: "Nutrient rich but less fibre than whole fruit" },
    { name: "Tea / Coffee (Low Sugar)", xp: 2, pts: 2, category: "Moderate", flags: [], note: "Antioxidants with mild caffeine" },
    { name: "Poha", xp: 8, pts: 8, category: "Moderate", flags: ["Good_food"], note: "Flattened rice breakfast with peanuts" },
    { name: "Upma", xp: 8, pts: 8, category: "Moderate", flags: ["Good_food"], note: "Semolina dish with veggies" }
  ],
  junk: [
    { name: "Burger", xp: -25, pts: -25, category: "Junk Alert", flags: ["Junk", "Refined", "Oil"], note: "Refined buns, processed patty & high saturated fat" },
    { name: "Pizza", xp: -25, pts: -25, category: "Junk Alert", flags: ["Junk", "Refined", "Oil"], note: "High sodium, maida crust & processed cheese" },
    { name: "French Fries", xp: -28, pts: -28, category: "Junk Alert", flags: ["Fried", "Junk", "Oil"], note: "Deep fried simple starch with oxidized oils" },
    { name: "Soda / Cold Drink", xp: -30, pts: -30, category: "Sugar Crash", flags: ["Sugar", "Junk"], note: "Liquid sugar spike (30g+ empty sugar)" },
    { name: "Pastries & Cakes", xp: -26, pts: -26, category: "Sugar Crash", flags: ["Sugar", "Refined", "Junk"], note: "High refined carbs & trans fats" },
    { name: "Ice Cream", xp: -22, pts: -22, category: "Sugar Crash", flags: ["Sugar", "Junk"], note: "High sugar & saturated dairy fat" },
    { name: "Samosa", xp: -22, pts: -22, category: "Junk Alert", flags: ["Fried", "Refined", "Oil"], note: "Deep-fried refined flour casing" },
    { name: "Pakora / Bhajiya", xp: -20, pts: -20, category: "Junk Alert", flags: ["Fried", "Oil"], note: "Deep-fried batter absorbing cooking oil" },
    { name: "Candy & Chocolate", xp: -24, pts: -24, category: "Sugar Crash", flags: ["Sugar", "Junk"], note: "Instant glucose spike, causes energy crash" },
    { name: "Potato Chips", xp: -25, pts: -25, category: "Junk Alert", flags: ["Fried", "Junk", "Oil"], note: "Ultra-processed fried carbs with excess salt" },
    { name: "Gulab Jamun", xp: -26, pts: -26, category: "Sugar Crash", flags: ["Sugar", "Fried", "Refined"], note: "Deep fried khoya soaked in heavy sugar syrup" }
  ]
};

// Keyword classifier matching patterns
const KEYWORDS = {
  junk: [
    "burger", "pizza", "fries", "french fry", "soda", "coke", "pepsi", "fanta", "sprite",
    "cold drink", "pastry", "cake", "cupcake", "ice cream", "samosa", "pakora", "bhajiya",
    "candy", "chocolate", "chips", "crisps", "donut", "doughnut", "nuggets", "hot dog",
    "bhature", "puri", "kachori", "jalebi", "gulab jamun", "rasgulla", "laddu", "sweet",
    "mayo", "deep fried", "cola", "energy drink", "sugar syrup", "shawarma"
  ],
  healthy: [
    "dosa", "idli", "sambar", "dal", "roti", "chapati", "phulka", "brown rice", "paneer",
    "grilled chicken", "chicken breast", "boiled egg", "egg white", "omelet", "salad",
    "sprouts", "oats", "oatmeal", "fruit", "nuts", "almonds", "walnuts", "vegetable",
    "sabzi", "curd", "yogurt", "buttermilk", "chaas", "khichdi", "soup", "millet",
    "quinoa", "apple", "banana", "berries", "orange", "spinach", "broccoli", "chana",
    "rajma", "tofu", "soya"
  ]
};

/**
 * Classify a food string into Tag, Type, Points, and Flags
 */
export function classifyFood(foodName, ingredients = "") {
  const query = (foodName + " " + ingredients).toLowerCase().trim();
  
  if (!query) {
    return {
      type: "neutral",
      category: "Moderate",
      pts: 0,
      xp: 0,
      badgeText: "Neutral (0 XP)",
      flags: [],
      isSugarOrJunk: false,
      isClean: false,
      note: "Standard home portion"
    };
  }

  // 1. Direct match with knowledge base
  for (const item of FOOD_DATABASE.junk) {
    if (query.includes(item.name.toLowerCase())) {
      return {
        type: "junk",
        category: item.category,
        pts: item.pts,
        xp: item.xp,
        badgeText: `🔴 Junk Alert (${item.xp} XP)`,
        flags: item.flags,
        isSugarOrJunk: true,
        isClean: false,
        note: item.note
      };
    }
  }

  for (const item of FOOD_DATABASE.healthy) {
    if (query.includes(item.name.toLowerCase())) {
      return {
        type: "healthy",
        category: item.category,
        pts: item.pts,
        xp: item.xp,
        badgeText: `🟢 Healthy Fuel (+${item.xp} XP)`,
        flags: item.flags,
        isSugarOrJunk: false,
        isClean: true,
        note: item.note
      };
    }
  }

  // 2. Keyword heuristic checks
  for (const kw of KEYWORDS.junk) {
    if (query.includes(kw)) {
      return {
        type: "junk",
        category: "Junk / High Sugar",
        pts: -20,
        xp: -20,
        badgeText: "🔴 Junk Alert: High Trans-Fat / Processed (-20 XP)",
        flags: ["Junk", "Oil"],
        isSugarOrJunk: true,
        isClean: false,
        note: "High in refined carbohydrates, saturated fats or added sugar"
      };
    }
  }

  for (const kw of KEYWORDS.healthy) {
    if (query.includes(kw)) {
      return {
        type: "healthy",
        category: "Clean Fuel",
        pts: 15,
        xp: 15,
        badgeText: "🟢 Healthy Fuel (+15 XP)",
        flags: ["Healthy", "Good_food"],
        isSugarOrJunk: false,
        isClean: true,
        note: "Wholesome nutrient-dense whole food"
      };
    }
  }

  // 3. Moderate fallback
  return {
    type: "moderate",
    category: "Moderate / Neutral",
    pts: 5,
    xp: 5,
    badgeText: "🟡 Moderate Fuel (+5 XP)",
    flags: ["Good_food"],
    isSugarOrJunk: false,
    isClean: false,
    note: "Balanced home-cooked meal"
  };
}

/**
 * Calculates the Daily Cleanliness Index (0-100%) and Grade
 * Grade mapping:
 *  90% - 100%: Grade A+ (Elite Clean Day)
 *  75% - 89%: Grade B (Good Balance)
 *  50% - 74%: Grade C (Warning: Needs Improvement)
 *  Below 50%: Grade F (Junk Overload / Sugar Crash)
 */
export function calculateCleanlinessIndex(loggedMeals) {
  if (!loggedMeals || loggedMeals.length === 0) {
    return {
      index: 100,
      grade: "A+",
      title: "Clean Slate",
      color: "#10b981",
      positiveXP: 0,
      penaltyXP: 0,
      totalXP: 0,
      cleanCount: 0,
      junkCount: 0,
      isPerfectSugarFree: true,
      description: "Log your first meal to calculate your live Cleanliness Index!"
    };
  }

  let totalPossible = 0;
  let earnedScore = 0;
  let positiveXP = 0;
  let penaltyXP = 0;
  let cleanCount = 0;
  let junkCount = 0;

  loggedMeals.forEach((meal) => {
    const classification = classifyFood(meal.name, meal.ingredients || "");
    totalPossible += 25; // standard base maximum per item

    if (classification.type === "healthy") {
      earnedScore += 25 + Math.max(0, classification.pts - 15);
      positiveXP += classification.xp;
      cleanCount++;
    } else if (classification.type === "moderate") {
      earnedScore += 18;
      positiveXP += classification.xp;
    } else if (classification.type === "junk") {
      earnedScore -= Math.abs(classification.pts) * 0.75;
      penaltyXP += Math.abs(classification.xp);
      junkCount++;
    }
  });

  // Calculate percentage (clamped 0 - 100)
  const rawRatio = totalPossible > 0 ? (earnedScore / totalPossible) * 100 : 100;
  const index = Math.max(0, Math.min(100, Math.round(rawRatio)));

  let grade = "F";
  let title = "Junk Overload / Sugar Crash";
  let color = "#ef4444";
  let description = "High processed foods logged today. Cut the sugar and choose grilled or steamed whole foods!";

  if (index >= 90) {
    grade = "A+";
    title = "Elite Clean Day";
    color = "#10b981";
    description = "Master discipline! Supercharged metabolism with pure, whole nutrient density.";
  } else if (index >= 75) {
    grade = "B";
    title = "Good Balance";
    color = "#3b82f6";
    description = "Solid healthy eating! You balanced nutrients well with minimal junk.";
  } else if (index >= 50) {
    grade = "C";
    title = "Warning: Needs Improvement";
    color = "#f59e0b";
    description = "Moderate junk intake detected. Replace sugary snacks with fresh fruits or sprouts.";
  }

  return {
    index,
    grade,
    title,
    color,
    positiveXP,
    penaltyXP,
    totalXP: Math.max(0, positiveXP - penaltyXP),
    cleanCount,
    junkCount,
    isPerfectSugarFree: junkCount === 0,
    description
  };
}
