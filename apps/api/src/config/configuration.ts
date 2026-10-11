/** Типизированная конфигурация из переменных окружения. Секреты — только через окружение. */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  publicUrl: string;
  corsOrigins: string[];
  jwt: {
    customerSecret: string;
    customerExpiresIn: string;
    staffSecret: string;
    staffExpiresIn: string;
  };
  uploadsDir: string;
  providers: {
    payment: 'test' | 'alfabank';
    courier: 'test' | 'yandex';
    accounting: 'noop' | 'onec';
    push: 'log' | 'expo';
    sms: 'log';
  };
  alfabank: {
    apiUrl: string;
    userName: string;
    password: string;
    token: string;
    returnUrl: string;
    callbackSecret: string;
  };
  yandexDelivery: {
    apiUrl: string;
    token: string;
    sourceAddress: string;
    sourceLat: number;
    sourceLon: number;
    contactPhone: string;
  };
  onec: {
    baseUrl: string;
    user: string;
    password: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
  expo: {
    accessToken: string;
  };
  appScheme: string;
}

const list = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const required = (name: string, devFallback: string) => {
    const value = process.env[name];
    if (value) return value;
    if (isProd) throw new Error(`Переменная окружения ${name} обязательна в production`);
    return devFallback;
  };
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

  return {
    nodeEnv,
    port,
    publicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    corsOrigins: list(process.env.CORS_ORIGINS),
    jwt: {
      customerSecret: required('JWT_CUSTOMER_SECRET', 'dev-customer-secret-change-me'),
      customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN ?? '90d',
      staffSecret: required('JWT_STAFF_SECRET', 'dev-staff-secret-change-me'),
      staffExpiresIn: process.env.JWT_STAFF_EXPIRES_IN ?? '12h',
    },
    uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
    providers: {
      payment: (process.env.PAYMENT_PROVIDER as 'test' | 'alfabank') ?? 'test',
      courier: (process.env.COURIER_PROVIDER as 'test' | 'yandex') ?? 'test',
      accounting: (process.env.ACCOUNTING_PROVIDER as 'noop' | 'onec') ?? 'noop',
      push: (process.env.PUSH_PROVIDER as 'log' | 'expo') ?? 'log',
      sms: 'log',
    },
    alfabank: {
      apiUrl: process.env.ALFABANK_API_URL ?? 'https://alfa.rbsuat.com/payment/rest',
      userName: process.env.ALFABANK_USERNAME ?? '',
      password: process.env.ALFABANK_PASSWORD ?? '',
      token: process.env.ALFABANK_TOKEN ?? '',
      returnUrl: process.env.ALFABANK_RETURN_URL ?? '',
      callbackSecret: process.env.ALFABANK_CALLBACK_SECRET ?? '',
    },
    yandexDelivery: {
      apiUrl: process.env.YANDEX_DELIVERY_API_URL ?? 'https://b2b.taxi.yandex.net',
      token: process.env.YANDEX_DELIVERY_TOKEN ?? '',
      sourceAddress: process.env.YANDEX_DELIVERY_SOURCE_ADDRESS ?? '',
      sourceLat: Number(process.env.YANDEX_DELIVERY_SOURCE_LAT ?? 0),
      sourceLon: Number(process.env.YANDEX_DELIVERY_SOURCE_LON ?? 0),
      contactPhone: process.env.YANDEX_DELIVERY_CONTACT_PHONE ?? '',
    },
    onec: {
      baseUrl: process.env.ONEC_BASE_URL ?? '',
      user: process.env.ONEC_USER ?? '',
      password: process.env.ONEC_PASSWORD ?? '',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      chatId: process.env.TELEGRAM_CHAT_ID ?? '',
    },
    expo: {
      accessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
    },
    appScheme: process.env.MOBILE_APP_SCHEME ?? 'kirilovskiy',
  };
};
