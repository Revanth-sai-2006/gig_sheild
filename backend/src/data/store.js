export const db = {
  users: [],
  policyCatalog: [
    {
      id: "P-WTH-001",
      name: "Weather Shield Basic",
      description: "Income support during moderate weather disruptions.",
      baseWeeklyPremium: 40,
      maxWeeklyCoverage: 500
    },
    {
      id: "P-WTH-002",
      name: "All-Risk Worker Plus",
      description: "Higher protection for risky jobs and unsafe zones.",
      baseWeeklyPremium: 60,
      maxWeeklyCoverage: 900
    },
    {
      id: "P-WTH-003",
      name: "Urban Mobility Guard",
      description: "Coverage against traffic and transit interruptions.",
      baseWeeklyPremium: 50,
      maxWeeklyCoverage: 700
    }
  ],
  userPolicies: [],
  claims: [],
  notifications: []
};

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
