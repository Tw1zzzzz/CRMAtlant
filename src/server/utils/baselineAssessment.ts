export type BaselineAxis = 'tempo' | 'communication' | 'decisionStyle' | 'pressureResponse';

export type BaselineRole =
  | 'IGL'
  | 'AWPer'
  | 'Entry'
  | 'Support'
  | 'Lurker'
  | 'Anchor'
  | 'Flex';

export type BaselineSidePreference = 'T-side' | 'CT-side' | 'Balanced';
export type BaselineRoundStrength = 'Openings' | 'Mid-round' | 'Clutches' | 'Support protocols';

export interface BaselineAnswerInput {
  questionId: string;
  optionId: string;
}

type BaselineQuestionOption = {
  id: string;
  label: string;
  weights: Partial<Record<BaselineAxis, number>>;
};

type BaselineQuestion = {
  id: string;
  prompt: string;
  options: BaselineQuestionOption[];
};

export interface BaselinePersonalitySummary {
  archetype: string;
  headline: string;
  description: string;
  styleTags: string[];
  axes: Record<BaselineAxis, number>;
}

type BaselineAssessmentLike = {
  completedAt?: string | Date;
  personality?: {
    answers?: Array<{
      questionId: string;
      optionId: string;
    }>;
    summary?: BaselinePersonalitySummary;
  };
  cs2Role?: {
    primaryRole?: BaselineRole | string;
    secondaryRole?: BaselineRole | '' | string;
    sidePreference?: BaselineSidePreference | string;
    roundStrength?: BaselineRoundStrength | string;
  };
} | null | undefined;

export const BASELINE_CS2_ROLES: BaselineRole[] = [
  'IGL',
  'AWPer',
  'Entry',
  'Support',
  'Lurker',
  'Anchor',
  'Flex'
];

export const BASELINE_SIDE_PREFERENCES: BaselineSidePreference[] = ['T-side', 'CT-side', 'Balanced'];
export const BASELINE_ROUND_STRENGTHS: BaselineRoundStrength[] = [
  'Openings',
  'Mid-round',
  'Clutches',
  'Support protocols'
];

export const BASELINE_QUESTIONS: BaselineQuestion[] = [
  {
    id: 'personality_prep',
    prompt: 'Перед важным матчем что помогает вам быстрее всего войти в рабочий ритм?',
    options: [
      {
        id: 'prep_action',
        label: 'Нужна динамика и быстрый разгон через активность.',
        weights: { tempo: 3, pressureResponse: 1 }
      },
      {
        id: 'prep_team_sync',
        label: 'Сначала сверяюсь с командой и проговариваю ключевые акценты.',
        weights: { communication: 3, decisionStyle: 1 }
      },
      {
        id: 'prep_structure',
        label: 'Лучше всего работает спокойный план и понятная структура.',
        weights: { decisionStyle: 3, pressureResponse: 1 }
      },
      {
        id: 'prep_calm',
        label: 'Стараюсь выровнять голову и не разгонять лишние эмоции.',
        weights: { pressureResponse: 3, communication: 1 }
      }
    ]
  },
  {
    id: 'personality_info',
    prompt: 'Когда в раунде много неполной информации, вы чаще:',
    options: [
      {
        id: 'info_push',
        label: 'Быстро принимаю инициативу и забираю пространство.',
        weights: { tempo: 3, decisionStyle: 1 }
      },
      {
        id: 'info_call',
        label: 'Собираю инфу через команду и договариваюсь о совместном действии.',
        weights: { communication: 3, pressureResponse: 1 }
      },
      {
        id: 'info_model',
        label: 'Строю вероятности и выбираю самый логичный сценарий.',
        weights: { decisionStyle: 3, pressureResponse: 1 }
      },
      {
        id: 'info_patience',
        label: 'Держу паузу и жду лучший тайминг, не форсируя.',
        weights: { pressureResponse: 3, decisionStyle: 1 }
      }
    ]
  },
  {
    id: 'personality_comms',
    prompt: 'Какой стиль коммуникации вам ближе в напряжённой игре?',
    options: [
      {
        id: 'comms_sharp',
        label: 'Коротко, резко и по делу, чтобы держать темп.',
        weights: { tempo: 2, communication: 2 }
      },
      {
        id: 'comms_guiding',
        label: 'Спокойно направлять и держать команду в одной рамке.',
        weights: { communication: 3, pressureResponse: 1 }
      },
      {
        id: 'comms_precise',
        label: 'Максимально точно и структурно, без лишних слов.',
        weights: { decisionStyle: 2, communication: 2 }
      },
      {
        id: 'comms_stable',
        label: 'Поддерживать ровный тон, чтобы не качать эмоции команды.',
        weights: { pressureResponse: 2, communication: 2 }
      }
    ]
  },
  {
    id: 'personality_shift',
    prompt: 'Если план ломается, вы обычно:',
    options: [
      {
        id: 'shift_force',
        label: 'Сразу перестраиваюсь через агрессию и новый темп.',
        weights: { tempo: 3, pressureResponse: 1 }
      },
      {
        id: 'shift_sync',
        label: 'Проверяю, чтобы все поняли новый план одновременно.',
        weights: { communication: 3, decisionStyle: 1 }
      },
      {
        id: 'shift_reframe',
        label: 'Быстро пересобираю решение на основе новых условий.',
        weights: { decisionStyle: 3, tempo: 1 }
      },
      {
        id: 'shift_compose',
        label: 'Сначала стабилизируюсь, потом действую.',
        weights: { pressureResponse: 3, decisionStyle: 1 }
      }
    ]
  },
  {
    id: 'personality_pressure',
    prompt: 'Что у вас чаще всего усиливается в клатч-ситуации?',
    options: [
      {
        id: 'pressure_instinct',
        label: 'Чувство темпа и смелость принять быстрый риск.',
        weights: { tempo: 2, pressureResponse: 2 }
      },
      {
        id: 'pressure_comms',
        label: 'Умение держать ясную связь и не терять команду.',
        weights: { communication: 3, pressureResponse: 1 }
      },
      {
        id: 'pressure_read',
        label: 'Чтение оппонента и расчёт вероятностей.',
        weights: { decisionStyle: 3, pressureResponse: 1 }
      },
      {
        id: 'pressure_calm',
        label: 'Холодная голова и контроль над эмоцией.',
        weights: { pressureResponse: 3, decisionStyle: 1 }
      }
    ]
  },
  {
    id: 'personality_value',
    prompt: 'В своей лучшей форме вы даёте команде прежде всего:',
    options: [
      {
        id: 'value_drive',
        label: 'Разгон, импульс и ощущение, что можно давить.',
        weights: { tempo: 3, communication: 1 }
      },
      {
        id: 'value_glue',
        label: 'Связность, доверие и ощущение общего контура.',
        weights: { communication: 3, pressureResponse: 1 }
      },
      {
        id: 'value_clarity',
        label: 'Ясность решений и структуру в сложных моментах.',
        weights: { decisionStyle: 3, communication: 1 }
      },
      {
        id: 'value_stability',
        label: 'Спокойствие и устойчивость под нагрузкой.',
        weights: { pressureResponse: 3, decisionStyle: 1 }
      }
    ]
  }
];

export const maskBaselineAssessmentSummary = <T extends BaselineAssessmentLike>(
  assessment: T,
  hasFullAccess: boolean
): T => {
  if (!assessment || hasFullAccess || !assessment.personality) {
    return assessment;
  }

  return {
    ...assessment,
    personality: {
      ...assessment.personality,
      summary: undefined
    }
  };
};

const ARCHETYPE_META: Record<
  string,
  {
    headline: string;
    description: string;
    styleTags: string[];
  }
> = {
  'Холодный аналитик': {
    headline: 'Сильнее всего проявляетесь там, где нужен расчёт, чтение ситуации и структурное решение.',
    description:
      'Вы лучше раскрываетесь, когда игра требует ясной логики, дисциплины мышления и способности видеть несколько ходов вперёд.',
    styleTags: ['структурный', 'рациональный', 'читает игру', 'держит контур']
  },
  'Драйвер темпа': {
    headline: 'Ваше естественное преимущество — задавать ритм и ускорять команду в нужный момент.',
    description:
      'В лучшей форме вы заражаете игру импульсом, быстро принимаете решение и создаёте давление там, где другие ещё думают.',
    styleTags: ['агрессивный', 'темповый', 'инициативный', 'разгоняет игру']
  },
  'Командный стабилизатор': {
    headline: 'Вы усиливаете команду через связь, собранность и ощущение общего плана.',
    description:
      'Ваш стиль особенно ценен там, где нужно удержать коммуникацию чистой, вовремя синхронизировать людей и вернуть структуру в хаос.',
    styleTags: ['командный', 'связующий', 'надёжный', 'держит коммуникацию']
  },
  'Клатч-ридер': {
    headline: 'Под давлением вы лучше многих сохраняете ясность и находите точное решение.',
    description:
      'Ваш профиль сильнее всего раскрывается в напряжённых розыгрышах, где важны самообладание, выдержка и тонкое чтение момента.',
    styleTags: ['спокойный', 'устойчивый', 'клатчевый', 'холодная голова']
  }
};

const AXIS_ARCHETYPE_PRIORITY: BaselineAxis[] = [
  'decisionStyle',
  'tempo',
  'communication',
  'pressureResponse'
];

const ARCHETYPE_BY_AXIS: Record<BaselineAxis, string> = {
  tempo: 'Драйвер темпа',
  communication: 'Командный стабилизатор',
  decisionStyle: 'Холодный аналитик',
  pressureResponse: 'Клатч-ридер'
};

const roundAxisValue = (value: number) => Number(value.toFixed(1));

export function getBaselineQuestionById(questionId: string) {
  return BASELINE_QUESTIONS.find((question) => question.id === questionId) || null;
}

export function validateBaselineAnswers(answers: BaselineAnswerInput[]) {
  if (!Array.isArray(answers) || answers.length !== BASELINE_QUESTIONS.length) {
    return {
      valid: false,
      message: `Нужно ответить на ${BASELINE_QUESTIONS.length} вопросов базового профиля.`
    };
  }

  const uniqueQuestionIds = new Set<string>();
  for (const answer of answers) {
    const question = getBaselineQuestionById(answer.questionId);
    if (!question) {
      return { valid: false, message: `Неизвестный вопрос: ${answer.questionId}` };
    }

    if (uniqueQuestionIds.has(answer.questionId)) {
      return { valid: false, message: 'Один из вопросов заполнен несколько раз.' };
    }

    uniqueQuestionIds.add(answer.questionId);

    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) {
      return {
        valid: false,
        message: `Для вопроса ${answer.questionId} выбран неизвестный вариант ответа.`
      };
    }
  }

  return { valid: true };
}

export function buildBaselinePersonalitySummary(answers: BaselineAnswerInput[]): BaselinePersonalitySummary {
  const axisTotals: Record<BaselineAxis, number> = {
    tempo: 0,
    communication: 0,
    decisionStyle: 0,
    pressureResponse: 0
  };

  answers.forEach((answer) => {
    const question = getBaselineQuestionById(answer.questionId);
    const option = question?.options.find((item) => item.id === answer.optionId);
    if (!option) {
      return;
    }

    (Object.keys(axisTotals) as BaselineAxis[]).forEach((axis) => {
      axisTotals[axis] += option.weights[axis] || 0;
    });
  });

  const sortedAxes = [...AXIS_ARCHETYPE_PRIORITY].sort((left, right) => {
    const diff = axisTotals[right] - axisTotals[left];
    if (diff !== 0) {
      return diff;
    }

    return AXIS_ARCHETYPE_PRIORITY.indexOf(left) - AXIS_ARCHETYPE_PRIORITY.indexOf(right);
  });

  const mainAxis = sortedAxes[0];
  const archetype = ARCHETYPE_BY_AXIS[mainAxis];
  const meta = ARCHETYPE_META[archetype];

  return {
    archetype,
    headline: meta.headline,
    description: meta.description,
    styleTags: meta.styleTags,
    axes: {
      tempo: roundAxisValue(axisTotals.tempo),
      communication: roundAxisValue(axisTotals.communication),
      decisionStyle: roundAxisValue(axisTotals.decisionStyle),
      pressureResponse: roundAxisValue(axisTotals.pressureResponse)
    }
  };
}
