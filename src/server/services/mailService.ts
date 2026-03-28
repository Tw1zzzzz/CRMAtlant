type SendPasswordResetEmailParams = {
  email: string;
  name: string;
  resetUrl: string;
};

const isMailConfigured = (): boolean => {
  return Boolean(
    process.env.MAIL_HOST &&
      process.env.MAIL_PORT &&
      process.env.MAIL_USER &&
      process.env.MAIL_PASS &&
      process.env.MAIL_FROM
  );
};

const loadNodemailer = (): any => {
  // Lazy loading keeps tests and local development working even before npm install.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('nodemailer');
};

export const ensureMailConfiguration = (): void => {
  if (!isMailConfigured()) {
    throw new Error('Почтовая система не настроена. Проверьте MAIL_* переменные окружения.');
  }
};

export const sendPasswordResetEmail = async ({
  email,
  name,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<void> => {
  ensureMailConfiguration();

  const nodemailer = loadNodemailer();
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE || 'false') === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Сброс пароля',
    text: [
      `Здравствуйте, ${name || 'пользователь'}!`,
      '',
      'Мы получили запрос на сброс пароля.',
      `Чтобы задать новый пароль, откройте ссылку: ${resetUrl}`,
      '',
      'Ссылка действует 15 минут.',
      'Если это были не вы, просто проигнорируйте это письмо.',
    ].join('\n'),
  });
};
