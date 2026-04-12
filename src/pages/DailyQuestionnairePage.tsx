import DailyQuestionnairePanel from "@/components/questionnaires/DailyQuestionnairePanel";
import PageIntro from "@/components/PageIntro";
import { PRODUCT_NAME } from "@/lib/productCopy";

const DailyQuestionnairePage = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageIntro
        eyebrow="Моё состояние"
        title="Ежедневный опросник восстановления"
        description="Это отдельная рабочая вкладка для ежедневного фона дня. Здесь вы быстро фиксируете сон и экранное время, чтобы CRM точнее считывала состояние и вовремя замечала изменения формы."
        collapsible
        bullets={[
          "Заполняется отдельно от тестов",
          "Нужен для ежедневного сигнала по восстановлению",
          `После покупки ${PRODUCT_NAME} открывается полная история и расширенная аналитика`,
        ]}
      />

      <DailyQuestionnairePanel
        eyebrow="Ежедневный опросник"
        title="Сон, экранное время и базовый фон дня"
        description="Заполняйте опросник как отдельный ежедневный ритуал. Это самый быстрый способ обновить сигнал по восстановлению и держать форму под контролем."
      />
    </div>
  );
};

export default DailyQuestionnairePage;
