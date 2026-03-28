import Plan from '../models/Plan';

export interface SeedPlan {
  name: string;
  price: number;
  periodDays: number;
  robokassaEncodedInvoiceId: string;
}

export const PAYMENT_PLAN_SEEDS: SeedPlan[] = [
  { name: 'Корреляционный анализ (1 месяц)', price: 499, periodDays: 30, robokassaEncodedInvoiceId: 'wrvK9t4l50OWJxNfm_iHFw' },
  { name: 'Игровая статистика (1 месяц)', price: 399, periodDays: 30, robokassaEncodedInvoiceId: '2V4Gu-wHe0qbWkqJTmuauA' },
  { name: 'PerformanceCoach CRM (1 месяц)', price: 23990, periodDays: 30, robokassaEncodedInvoiceId: 'Z8sjZP9kMkC2OErRua9CtQ' },
  { name: 'PerformanceCoach CRM (3 месяца)', price: 64773, periodDays: 90, robokassaEncodedInvoiceId: 'UsfjugVLZEqEaTVm6UpAwQ' },
  { name: 'PerformanceCoach CRM (6 месяцев)', price: 114720, periodDays: 180, robokassaEncodedInvoiceId: 'CV6ntQRS_UCJ2bz6_IEurg' },
];

export const ACTIVE_PAYMENT_PLAN_NAMES = [
  'Корреляционный анализ (1 месяц)',
  'Игровая статистика (1 месяц)',
  'PerformanceCoach CRM (1 месяц)',
  'PerformanceCoach CRM (3 месяца)',
  'PerformanceCoach CRM (6 месяцев)',
] as const;

export const PERFORMANCE_COACH_CRM_PLAN_NAMES = [
  'PerformanceCoach CRM (1 месяц)',
  'PerformanceCoach CRM (3 месяца)',
  'PerformanceCoach CRM (6 месяцев)',
] as const;

const ACTIVE_PAYMENT_PLAN_SET = new Set<string>(ACTIVE_PAYMENT_PLAN_NAMES);
const PERFORMANCE_COACH_CRM_PLAN_SET = new Set<string>(PERFORMANCE_COACH_CRM_PLAN_NAMES);

export const buildPlanFeatures = (plan: SeedPlan): string[] => {
  if (PERFORMANCE_COACH_CRM_PLAN_SET.has(plan.name)) {
    return [
      'Dashboard: Обзор, Быстрый старт, Сон, Тесты',
      'Test Tracker: Brain Lab, weekly-тесты, ежедневный опросник',
      'Включает Корреляционный анализ и Игровую статистику',
      `Доступ на ${plan.periodDays} дней`,
    ];
  }

  if (plan.name.startsWith('Корреляционный анализ')) {
    return [
      'Доступ к странице корреляционного анализа',
      'Графики, AI-вывод и сравнение метрик',
      `Доступ на ${plan.periodDays} дней`,
    ];
  }

  if (plan.name.startsWith('Игровая статистика')) {
    return [
      'Доступ к странице игровой статистики',
      'Таблица матчевых метрик и форма ввода',
      `Доступ на ${plan.periodDays} дней`,
    ];
  }

  const baseName = plan.name.replace(/\s*\(\d+\s+\S+\)$/, '');

  return [
    baseName,
    `Доступ на ${plan.periodDays} дней`,
    'Оплата через Robokassa',
  ];
};

export const ensurePlansSeeded = async (): Promise<void> => {
  await Plan.updateMany(
    {
      name: { $nin: Array.from(ACTIVE_PAYMENT_PLAN_SET) },
    },
    {
      $set: {
        isActive: false,
      },
    }
  );

  await Promise.all(
    PAYMENT_PLAN_SEEDS.map((plan) =>
      Plan.findOneAndUpdate(
        { name: plan.name, periodDays: plan.periodDays },
        {
          ...plan,
          features: buildPlanFeatures(plan),
          isActive: true,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );
};
