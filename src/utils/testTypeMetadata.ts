import { TEST_TYPE_METADATA, TestType } from "@/types";

const FALLBACK_TEST_LABEL = "Общий тест";

export const BRAIN_TEST_TYPE_METADATA = {
  visual_search: {
    label: "Visual Search",
    description: "Тест на селективное внимание и скорость поиска цели."
  },
  go_no_go: {
    label: "Go / No-Go",
    description: "Тест на реакцию, самоконтроль и подавление лишних нажатий."
  },
  n_back_2: {
    label: "2-Back",
    description: "Тест на рабочую память и удержание последовательности."
  },
  stroop_switch: {
    label: "Stroop Switch",
    description: "Тест на переключение правил и устойчивость к конфликту стимулов."
  },
  spatial_span: {
    label: "Spatial Span",
    description: "Тест на пространственную память и объём последовательности."
  }
} as const;

const LEGACY_TEST_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  generic: {
    label: "Общий тест",
    description: "Ручной или общий тест без отдельной классификации."
  },
  reaction: {
    label: "Reaction",
    description: "Тест на скорость реакции."
  },
  aim: {
    label: "Aim",
    description: "Тест на точность наведения и попаданий."
  },
  cognitive: {
    label: "Cognitive",
    description: "Когнитивный тест на внимание, память или мышление."
  }
};

const INVALID_REASON_COPY: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  tab_hidden_over_15_percent: {
    title: "Окно теста было неактивно слишком долго",
    description:
      "Во время попытки вкладка или окно теста были скрыты больше 15% времени, поэтому результат не считается надёжным."
  },
  accuracy_below_threshold: {
    title: "Точность оказалась ниже минимального порога",
    description:
      "В этом тесте было слишком много ошибок, поэтому попытка не используется в baseline и не влияет на индекс."
  },
  too_many_fast_responses: {
    title: "Слишком много аномально быстрых ответов",
    description:
      "Система увидела много реакций быстрее 120 мс. Обычно это признак случайных или преждевременных нажатий."
  }
};

export function getReadableTestTypeLabel(testType?: string | null) {
  const normalizedType = (testType || "").trim().toLowerCase();

  if (!normalizedType) {
    return FALLBACK_TEST_LABEL;
  }

  if (normalizedType in BRAIN_TEST_TYPE_METADATA) {
    return BRAIN_TEST_TYPE_METADATA[normalizedType as keyof typeof BRAIN_TEST_TYPE_METADATA].label;
  }

  if (normalizedType in TEST_TYPE_METADATA) {
    return TEST_TYPE_METADATA[normalizedType as TestType].label;
  }

  if (normalizedType in LEGACY_TEST_TYPE_LABELS) {
    return LEGACY_TEST_TYPE_LABELS[normalizedType].label;
  }

  return testType || FALLBACK_TEST_LABEL;
}

export function getReadableTestTypeDescription(testType?: string | null) {
  const normalizedType = (testType || "").trim().toLowerCase();

  if (!normalizedType) {
    return LEGACY_TEST_TYPE_LABELS.generic.description;
  }

  if (normalizedType in BRAIN_TEST_TYPE_METADATA) {
    return BRAIN_TEST_TYPE_METADATA[normalizedType as keyof typeof BRAIN_TEST_TYPE_METADATA].description;
  }

  if (normalizedType in TEST_TYPE_METADATA) {
    return TEST_TYPE_METADATA[normalizedType as TestType].description;
  }

  if (normalizedType in LEGACY_TEST_TYPE_LABELS) {
    return LEGACY_TEST_TYPE_LABELS[normalizedType].description;
  }

  return LEGACY_TEST_TYPE_LABELS.generic.description;
}

export function getReadableInvalidReason(reason?: string | null) {
  const normalizedReason = (reason || "").trim().toLowerCase();

  if (!normalizedReason) {
    return {
      title: "Попытка исключена из индекса",
      description: "Система отметила попытку как ненадёжную и не использует её в baseline."
    };
  }

  if (normalizedReason in INVALID_REASON_COPY) {
    return INVALID_REASON_COPY[normalizedReason];
  }

  return {
    title: "Попытка исключена из индекса",
    description: reason || "Система отметила попытку как ненадёжную."
  };
}
