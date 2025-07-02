import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import util from "node:util";
import Debug from "debug";
import { ms } from "humanize-ms";
import ini from "ini";
import yaml from "js-yaml";
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

type Resource = Record<string, string>;

type GettextFunction = (
	locale: string,
	key: string,
	...args: unknown[]
) => string;

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

const DEFAULT_OPTIONS = {
	defaultLocale: "en-US",
	queryField: "locale",
	cookieField: "locale",
	localeAlias: {},
	writeCookie: true,
	cookieMaxAge: "1y",
	dir: undefined,
	dirs: [path.join(process.cwd(), "locales")],
	functionName: "__",
};

function locales(app: Koa, options: LocalesOptions = {}): void {
	options = Object.assign({}, DEFAULT_OPTIONS, options);
	const defaultLocale = formatLocale(options.defaultLocale || "en-US");
	const queryField = options.queryField || "locale";
	const cookieField = options.cookieField || "locale";
	const cookieDomain = options.cookieDomain;
	const localeAlias = options.localeAlias || {};
	const writeCookie = options.writeCookie !== false;
	const cookieMaxAge = ms(options.cookieMaxAge || "1y");
	const localeDir = options.dir;
	const localeDirs = options.dirs || [path.join(process.cwd(), "locales")];
	const functionName = options.functionName || "__";
	const resources: Record<string, Resource> = {};

	/**
	 * @Deprecated Use options.dirs instead.
	 */
	if (localeDir && !localeDirs.includes(localeDir)) {
		localeDirs.push(localeDir);
	}

	appendDebugLog("Starting resource loading");
	// Loop through all directories, merging resources for the same locale
	// Later directories override earlier ones
	for (let i = 0; i < localeDirs.length; i++) {
		const dir = localeDirs[i];
		if (!fs.existsSync(dir)) {
			continue;
		}
		const names = fs.readdirSync(dir);
		for (let j = 0; j < names.length; j++) {
			const name = names[j];
			const filepath = path.join(dir, name);
			// support en_US.js => en-US.js
			const locale = formatLocale(name.split(".")[0]);
			let resource: Resource = {};
			if (name.endsWith(".js")) {
				const require = createRequire(import.meta.url);
				const mod = require(filepath);
				resource = flattening((mod.default || mod) as Record<string, unknown>);
				appendDebugLog(
					`Loaded JS resource for locale '${locale}' from: ${filepath}`,
					resource,
				);
			} else if (name.endsWith(".json")) {
				// @ts-ignore
				resource = flattening(require(filepath) as Record<string, unknown>);
				appendDebugLog(
					`Loaded JSON resource for locale '${locale}' from: ${filepath}`,
					resource,
				);
			} else if (name.endsWith(".properties")) {
				resource = ini.parse(fs.readFileSync(filepath, "utf8"));
				appendDebugLog(
					`Loaded PROPERTIES resource for locale '${locale}' from: ${filepath}`,
					resource,
				);
			} else if (name.endsWith(".yml") || name.endsWith(".yaml")) {
				resource = flattening(
					yaml.load(fs.readFileSync(filepath, "utf8")) as Record<
						string,
						unknown
					>,
				);
				appendDebugLog(
					`Loaded YAML resource for locale '${locale}' from: ${filepath}`,
					resource,
				);
			}
			// Always merge, but let later dirs override earlier ones
			resources[locale] = { ...resources[locale], ...resource };
			appendDebugLog(
				`Merged resource for locale '${locale}'`,
				resources[locale],
			);
		}
	}
	appendDebugLog("Finished resource loading");

	const debug = Debug("koa-locales");
	const debugSilly = Debug("koa-locales:silly");

	debug(
		"Init locales with %j, got %j resources",
		options,
		Object.keys(resources),
	);

	if (
		typeof (app as unknown as Record<string, unknown>)[functionName] !==
		"undefined"
	) {
		console.warn(
			'[koa-locales] will override exists "%s" function on app',
			functionName,
		);
	}

	function gettext(locale: string, key: string, ...args: unknown[]): string {
		if (!key) return "";
		const resource = resources[locale] || {};
		let text = resource[key];
		if (typeof text !== "string") {
			text = key;
		}
		debugSilly("%s: %j => %j", locale, key, text);
		if (args.length === 0) {
			// __(locale, key)
			return text;
		}
		if (args.length === 1) {
			const value = args[0];
			if (isObject(value)) {
				return formatWithObject(text, value as Record<string, unknown>);
			}
			if (Array.isArray(value)) {
				return formatWithArray(text, value as unknown[]);
			}
			return util.format(text, value);
		}
		// __(locale, key, value1, ...)
		return util.format(text, ...args);
	}

	// Attach to app and context using proper Koa extension
	(app as Koa & { [key: string]: unknown })[functionName] = gettext;
	(app.context as Koa.Context & { [key: string]: unknown })[functionName] =
		function (key: string, ...args: unknown[]): string {
			const ctx = this as Koa.Context & { __getLocale?: () => string };
			const locale = ctx.__getLocale ? ctx.__getLocale() : "";
			return gettext(locale, key, ...args);
		};

	(app.context as Koa.Context & { [key: string]: unknown }).__getLocale =
		function (): string {
			const ctx = this as Koa.Context & {
				__locale?: string;
				__localeOrigin?: string;
			};
			if (typeof ctx.__locale === "string" && ctx.__locale) {
				return ctx.__locale;
			}
			const cookieLocale = ctx.cookies.get(cookieField, { signed: false });
			let locale = ctx.query[queryField];
			let localeOrigin = "query";
			if (!locale) {
				locale = cookieLocale;
				localeOrigin = "cookie";
			}
			if (!locale) {
				let languages = ctx.acceptsLanguages();
				if (languages) {
					if (Array.isArray(languages)) {
						if (languages[0] === "*") {
							languages = languages.slice(1);
						}
						if (languages.length > 0) {
							for (let i = 0; i < languages.length; i++) {
								const lang = formatLocale(String(languages[i]));
								if (resources[lang] || localeAlias[lang]) {
									locale = lang;
									localeOrigin = "header";
									break;
								}
							}
						}
					} else if (typeof languages === "string") {
						locale = languages;
						localeOrigin = "header";
					}
				}
				if (!locale) {
					locale = defaultLocale;
					localeOrigin = "default";
				}
			}
			if (locale && typeof locale !== "string") {
				locale = String(locale);
			}
			if (locale && locale in localeAlias) {
				const originalLocale = locale;
				locale = localeAlias[locale];
				debugSilly(
					"Used alias, received %s but using %s",
					originalLocale,
					locale,
				);
			}
			locale = formatLocale(locale || defaultLocale);
			if (!resources[locale]) {
				debugSilly(
					"Locale %s is not supported. Using default (%s)",
					locale,
					defaultLocale,
				);
				locale = defaultLocale;
			}
			if (writeCookie && cookieLocale !== locale && !ctx.headerSent) {
				updateCookie(ctx, locale);
			}
			debug("Locale: %s from %s", locale, localeOrigin);
			debugSilly("Locale: %s from %s", locale, localeOrigin);
			ctx.__locale = locale;
			ctx.__localeOrigin = localeOrigin;
			return String(locale);
		};

	(app.context as Koa.Context & { [key: string]: unknown }).__getLocaleOrigin =
		function (): string {
			const ctx = this as Koa.Context & {
				__localeOrigin?: string;
				__getLocale?: () => string;
			};
			if (typeof ctx.__localeOrigin === "string" && ctx.__localeOrigin)
				return ctx.__localeOrigin;
			ctx.__getLocale?.();
			return String(ctx.__localeOrigin ?? "");
		};

	(app.context as Koa.Context & { [key: string]: unknown }).__setLocale =
		function (locale: string): void {
			const ctx = this as Koa.Context & {
				__locale?: string;
				__localeOrigin?: string;
			};
			ctx.__locale = locale;
			ctx.__localeOrigin = "set";
			updateCookie(ctx, locale);
		};

	function updateCookie(ctx: Koa.Context, locale: string): void {
		const cookieOptions = {
			httpOnly: false,
			maxAge: cookieMaxAge,
			signed: false,
			domain: cookieDomain,
			overwrite: true,
		};
		ctx.cookies.set(cookieField, locale, cookieOptions);
		debugSilly("Saved cookie with locale %s", locale);
	}
}

function isObject(obj: unknown): obj is Record<string, unknown> {
	return Object.prototype.toString.call(obj) === "[object Object]";
}

const ARRAY_INDEX_RE = /\{(\d+)\}/g;
function formatWithArray(text: string, values: unknown[]): string {
	return text.replace(ARRAY_INDEX_RE, (orignal, matched) => {
		const index = parseInt(matched);
		if (index < values.length) {
			return String(values[index]);
		}
		// not match index, return orignal text
		return orignal;
	});
}

const Object_INDEX_RE = /\{(.+?)\}/g;
function formatWithObject(
	text: string,
	values: { [key: string]: unknown },
): string {
	return text.replace(Object_INDEX_RE, (orignal, matched) => {
		const value = values[matched];
		if (value !== undefined && value !== null) {
			return String(value);
		}
		// not match index, return orignal text
		return orignal;
	});
}

function formatLocale(locale: string): string {
	if (!locale) return "";
	return locale.replace(/_/g, "-").toLowerCase();
}

function flattening(data: Record<string, unknown>): { [key: string]: string } {
	const result: { [key: string]: string } = {};
	function deepFlat(data: Record<string, unknown>, keys: string): void {
		Object.keys(data).forEach((key) => {
			const value = data[key];
			const k = keys ? `${keys}.${key}` : key;
			if (isObject(value)) {
				deepFlat(value, k);
			} else {
				result[k] = String(value);
			}
		});
	}
	deepFlat(data, "");
	return result;
}

function appendDebugLog(message: string, obj?: unknown) {
	const logPath = path.resolve(process.cwd(), "resource-debug.log");
	let line = `[DEBUG] ${message}`;
	if (obj !== undefined) {
		try {
			line += ` ${JSON.stringify(obj)}`;
		} catch {
			line += ` ${String(obj)}`;
		}
	}
	fs.appendFileSync(
		logPath,
		`${line}
`,
	);
}

export default locales;
export type { LocalesOptions };
