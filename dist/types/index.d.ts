import type Koa from "koa";
interface LocalesOptions {
    defaultLocale?: string;
    queryField?: string;
    cookieField?: string;
    cookieDomain?: string;
    localeAlias?: Record<string, string>;
    writeCookie?: boolean;
    cookieMaxAge?: string | number;
    dir?: string;
    dirs?: string[];
    functionName?: string;
}
type GettextFunction = (locale: string, key: string, ...args: unknown[]) => string;
declare module "koa" {
    interface Context {
        __: GettextFunction;
        __getLocale(): string;
        __setLocale(locale: string): void;
        __getLocaleOrigin(): string;
    }
    interface Application {
        __: GettextFunction;
    }
}
declare function locales(app: Koa, options?: LocalesOptions): void;
export default locales;
export type { LocalesOptions };
