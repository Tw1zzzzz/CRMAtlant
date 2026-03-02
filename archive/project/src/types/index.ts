export interface BalanceWheel {
  id: string;
  playerId: string;
  playerName: string;
  date: string;
  physicalHealth: number;
  emotionalState: number;
  intellectualDevelopment: number;
  spiritualDevelopment: number;
  professionalGrowth: number;
  socialRelations: number;
  environment: number;
  financialWellbeing: number;
}

export interface Player {
  id: string;
  name: string;
  averageMood: number;
  averageEnergy: number;
  completedTests: number;
  activityPercentage: number;
}

export interface StatCard {
  title: string;
  value: number | string;
  description: string;
}