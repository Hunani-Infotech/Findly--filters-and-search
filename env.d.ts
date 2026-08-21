/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare namespace NodeJS {
  interface ProcessEnv {
    SHOPIFY_API_KEY?: string;
    SHOPIFY_API_SECRET?: string;
    SCOPES?: string;
    SHOPIFY_APP_URL?: string;
    SHOPIFY_FLAG_STORE?: string;
    SHOP_CUSTOM_DOMAIN?: string;
    DATABASE_URL?: string;
    REDIS_URL?: string;
    BILLING_TEST_MODE?: string;
    SUPPORT_EMAIL?: string;
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASSWORD?: string;
    SMTP_FROM?: string;
    DEV_UNLOCK_LIMITS?: string;
    PROXY_SIGNATURE_BYPASS?: string;
    PORT?: string;
  }
}
