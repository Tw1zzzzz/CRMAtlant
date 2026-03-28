import { Resend } from 'resend';

type SendPasswordResetEmailParams = {
  email: string;
  name: string;
  resetUrl: string;
};

type SendVerificationEmailParams = {
  email: string;
  name: string;
  verificationUrl: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderEmailLayout = ({
  title,
  intro,
  buttonLabel,
  actionUrl,
  footer,
}: {
  title: string;
  intro: string;
  buttonLabel: string;
  actionUrl: string;
  footer: string[];
}): string => {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeFooter = footer.map((item) => `<p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.6;">${escapeHtml(item)}</p>`).join('');

  return `
    <div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
        <div style="padding:32px 32px 24px;background:linear-gradient(135deg,#fff7ed 0%,#ffffff 100%);border-bottom:1px solid #f1f5f9;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Performance CRM
          </div>
          <h1 style="margin:18px 0 12px;color:#111827;font-size:28px;line-height:1.2;">${safeTitle}</h1>
          <p style="margin:0;color:#4b5563;font-size:16px;line-height:1.7;">${safeIntro}</p>
        </div>
        <div style="padding:28px 32px 32px;">
          <a href="${safeActionUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
            ${safeButtonLabel}
          </a>
          <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.7;word-break:break-all;">
            Если кнопка не открывается, используйте эту ссылку:<br />
            <a href="${safeActionUrl}" style="color:#2563eb;text-decoration:underline;">${safeActionUrl}</a>
          </p>
        </div>
        <div style="padding:0 32px 28px;">
          ${safeFooter}
        </div>
      </div>
    </div>
  `;
};

const isMailConfigured = (): boolean => {
  return Boolean(process.env.RESEND_API_KEY);
};

export const ensureMailConfiguration = (): void => {
  if (!isMailConfigured()) {
    throw new Error('Почтовая система не настроена. Проверьте переменную RESEND_API_KEY.');
  }
};

export const sendPasswordResetEmail = async ({
  email,
  name,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<void> => {
  ensureMailConfiguration();

  const resend = new Resend(process.env.RESEND_API_KEY);
  const greetingName = name || 'пользователь';

  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'PerformanceCoach <onboarding@resend.dev>',
    to: email,
    subject: 'Сброс пароля в Performance CRM',
    text: [
      `Здравствуйте, ${greetingName}!`,
      '',
      'Мы получили запрос на смену пароля в Performance CRM.',
      'Чтобы задать новый пароль, перейдите по ссылке ниже:',
      resetUrl,
      '',
      'Ссылка действует 15 минут.',
      'Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.',
    ].join('\n'),
    html: renderEmailLayout({
      title: `Здравствуйте, ${greetingName}!`,
      intro: 'Мы получили запрос на смену пароля в Performance CRM. Чтобы задать новый пароль, перейдите по кнопке ниже.',
      buttonLabel: 'Сменить пароль',
      actionUrl: resetUrl,
      footer: [
        'Ссылка действует 15 минут.',
        'Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.',
      ],
    }),
  });

  if (error) {
    throw new Error(`Ошибка отправки письма: ${error.message}`);
  }
};

export const sendVerificationEmail = async ({
  email,
  name,
  verificationUrl,
}: SendVerificationEmailParams): Promise<void> => {
  ensureMailConfiguration();

  const resend = new Resend(process.env.RESEND_API_KEY);
  const greetingName = name || 'пользователь';

  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'PerformanceCoach <onboarding@resend.dev>',
    to: email,
    subject: 'Подтверждение регистрации в Performance CRM',
    text: [
      `Здравствуйте, ${greetingName}!`,
      '',
      'Вы зарегистрировались в Performance CRM.',
      'Для завершения регистрации подтвердите email по ссылке ниже:',
      verificationUrl,
      '',
      'Ссылка действует 24 часа.',
      'Если вы не создавали аккаунт, просто проигнорируйте это письмо.',
    ].join('\n'),
    html: renderEmailLayout({
      title: `Здравствуйте, ${greetingName}!`,
      intro: 'Вы зарегистрировались в Performance CRM. Для завершения регистрации подтвердите email по кнопке ниже.',
      buttonLabel: 'Подтвердить email',
      actionUrl: verificationUrl,
      footer: [
        'Ссылка действует 24 часа.',
        'Если вы не создавали аккаунт, просто проигнорируйте это письмо.',
      ],
    }),
  });

  if (error) {
    throw new Error(`Ошибка отправки письма: ${error.message}`);
  }
};
