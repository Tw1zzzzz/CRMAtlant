import type {
  BaselineRole,
  BaselineRoundStrength,
  BaselineSidePreference
} from "@/types";

export type BaselineQuestionOption = {
  id: string;
  label: string;
};

export type BaselineQuestion = {
  id: string;
  prompt: string;
  options: BaselineQuestionOption[];
};

export const BASELINE_PERSONALITY_QUESTIONS: BaselineQuestion[] = [
  {
    id: "personality_prep",
    prompt: "Перед важным матчем что помогает вам быстрее всего войти в рабочий ритм?",
    options: [
      { id: "prep_action", label: "Нужна динамика и быстрый разгон через активность." },
      { id: "prep_team_sync", label: "Сначала сверяюсь с командой и проговариваю ключевые акценты." },
      { id: "prep_structure", label: "Лучше всего работает спокойный план и понятная структура." },
      { id: "prep_calm", label: "Стараюсь выровнять голову и не разгонять лишние эмоции." }
    ]
  },
  {
    id: "personality_info",
    prompt: "Когда в раунде много неполной информации, вы чаще:",
    options: [
      { id: "info_push", label: "Быстро принимаю инициативу и забираю пространство." },
      { id: "info_call", label: "Собираю инфу через команду и договариваюсь о совместном действии." },
      { id: "info_model", label: "Строю вероятности и выбираю самый логичный сценарий." },
      { id: "info_patience", label: "Держу паузу и жду лучший тайминг, не форсируя." }
    ]
  },
  {
    id: "personality_comms",
    prompt: "Какой стиль коммуникации вам ближе в напряжённой игре?",
    options: [
      { id: "comms_sharp", label: "Коротко, резко и по делу, чтобы держать темп." },
      { id: "comms_guiding", label: "Спокойно направлять и держать команду в одной рамке." },
      { id: "comms_precise", label: "Максимально точно и структурно, без лишних слов." },
      { id: "comms_stable", label: "Поддерживать ровный тон, чтобы не качать эмоции команды." }
    ]
  },
  {
    id: "personality_shift",
    prompt: "Если план ломается, вы обычно:",
    options: [
      { id: "shift_force", label: "Сразу перестраиваюсь через агрессию и новый темп." },
      { id: "shift_sync", label: "Проверяю, чтобы все поняли новый план одновременно." },
      { id: "shift_reframe", label: "Быстро пересобираю решение на основе новых условий." },
      { id: "shift_compose", label: "Сначала стабилизируюсь, потом действую." }
    ]
  },
  {
    id: "personality_pressure",
    prompt: "Что у вас чаще всего усиливается в клатч-ситуации?",
    options: [
      { id: "pressure_instinct", label: "Чувство темпа и смелость принять быстрый риск." },
      { id: "pressure_comms", label: "Умение держать ясную связь и не терять команду." },
      { id: "pressure_read", label: "Чтение оппонента и расчёт вероятностей." },
      { id: "pressure_calm", label: "Холодная голова и контроль над эмоцией." }
    ]
  },
  {
    id: "personality_value",
    prompt: "В своей лучшей форме вы даёте команде прежде всего:",
    options: [
      { id: "value_drive", label: "Разгон, импульс и ощущение, что можно давить." },
      { id: "value_glue", label: "Связность, доверие и ощущение общего контура." },
      { id: "value_clarity", label: "Ясность решений и структуру в сложных моментах." },
      { id: "value_stability", label: "Спокойствие и устойчивость под нагрузкой." }
    ]
  }
];

export const BASELINE_ROLE_OPTIONS: BaselineRole[] = [
  "IGL",
  "AWPer",
  "Entry",
  "Support",
  "Lurker",
  "Anchor",
  "Flex"
];

export const BASELINE_SIDE_OPTIONS: BaselineSidePreference[] = ["T-side", "CT-side", "Balanced"];
export const BASELINE_ROUND_STRENGTH_OPTIONS: BaselineRoundStrength[] = [
  "Openings",
  "Mid-round",
  "Clutches",
  "Support protocols"
];
