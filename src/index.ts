import Debug from "debug";
import fs from "fs";
import { ms } from "humanize-ms";
import ini from "ini";
import yaml from "js-yaml";
import type Koa from "koa";
import { createRequire } from "module";
import path from "path";
import util from "util";

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

type GettextFunction = (locale: string, key: string, ...args: any[]) => string;

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
				resource = flattening(mod.default || mod);
				appendDebugLog(
					`Loaded JS resource for locale '${locale}' from: ${filepath}`,
					resource,
				);
			} else if (name.endsWith(".json")) {
				// @ts-ignore
				resource = flattening(require(filepath));
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
				resource = flattening(yaml.load(fs.readFileSync(filepath, "utf8")));
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

	if (typeof (app as any)[functionName] !== "undefined") {
		console.warn(
			'[koa-locales] will override exists "%s" function on app',
			functionName,
		);
	}

	function gettext(locale: string, key: string, value?: any): string {
		if (arguments.length === 0 || arguments.length === 1) {
			// __()
			// --('en')
			return "";
		}
		const resource = resources[locale] || {};
		let text = resource[key];
		if (text === undefined) {
			text = key;
		}
		debugSilly("%s: %j => %j", locale, key, text);
		if (!text) {
			return "";
		}
		if (arguments.length === 2) {
			// __(locale, key)
			return text;
		}
		if (arguments.length === 3) {
			if (isObject(value)) {
				// __(locale, key, object)
				// __('zh', '{a} {b} {b} {a}', {a: 'foo', b: 'bar'})
				// =>
				// foo bar bar foo
				return formatWithObject(text, value);
			}
			if (Array.isArray(value)) {
				// __(locale, key, array)
				// __('zh', '{0} {1} {1} {0}', ['foo', 'bar'])
				// =>
				// foo bar bar foo
				return formatWithArray(text, value);
			}
			// __(locale, key, value)
			return util.format(text, value);
		}
		// __(locale, key, value1, ...)
		const args = new Array(arguments.length - 1);
		args[0] = text;
		for (let i = 2; i < arguments.length; i++) {
			args[i - 1] = arguments[i];
		}
		return util.format.apply(util, args);
	}

	(app as any)[functionName] = gettext;
	(app.context as any)[functionName] = function (
		key: string,
		value?: any,
	): string {
		if (arguments.length === 0) {
			// __()
			return "";
		}
		const locale = this.__getLocale();
		if (arguments.length === 1) {
			return gettext(locale, key);
		}
		if (arguments.length === 2) {
			return gettext(locale, key, value);
		}
		const args = new Array(arguments.length + 1);
		args[0] = locale;
		for (let i = 0; i < arguments.length; i++) {
			args[i + 1] = arguments[i];
		}
		// @ts-expect-error: dynamic argument forwarding
		return gettext(...args);
	};

	(app.context as any).__getLocale = function (): string {
		if (this.__locale) {
			return this.__locale;
		}
		const cookieLocale = this.cookies.get(cookieField, { signed: false });
		// 1. Query
		let locale = this.query[queryField];
		let localeOrigin = "query";
		// 2. Cookie
		if (!locale) {
			locale = cookieLocale;
			localeOrigin = "cookie";
		}
		// 3. Header
		if (!locale) {
			let languages = this.acceptsLanguages();
			if (languages) {
				if (Array.isArray(languages)) {
					if (languages[0] === "*") {
						languages = languages.slice(1);
					}
					if (languages.length > 0) {
						for (let i = 0; i < languages.length; i++) {
							const lang = formatLocale(languages[i]);
							if (resources[lang] || localeAlias[lang]) {
								locale = lang;
								localeOrigin = "header";
								break;
							}
						}
					}
				} else {
					locale = languages;
					localeOrigin = "header";
				}
			}
			if (!locale) {
				locale = defaultLocale;
				localeOrigin = "default";
			}
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
		if (writeCookie && cookieLocale !== locale && !this.headerSent) {
			updateCookie(this, locale);
		}
		debug("Locale: %s from %s", locale, localeOrigin);
		debugSilly("Locale: %s from %s", locale, localeOrigin);
		this.__locale = locale;
		this.__localeOrigin = localeOrigin;
		return locale;
	};

	(app.context as any).__getLocaleOrigin = function (): string {
		if (this.__localeOrigin) return this.__localeOrigin;
		this.__getLocale();
		return this.__localeOrigin;
	};

	(app.context as any).__setLocale = function (locale: string): void {
		this.__locale = locale;
		this.__localeOrigin = "set";
		updateCookie(this, locale);
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

function isObject(obj: any): boolean {
	return Object.prototype.toString.call(obj) === "[object Object]";
}

const ARRAY_INDEX_RE = /\{(\d+)\}/g;
function formatWithArray(text: string, values: any[]): string {
	return text.replace(ARRAY_INDEX_RE, (orignal, matched) => {
		const index = parseInt(matched);
		if (index < values.length) {
			return values[index];
		}
		// not match index, return orignal text
		return orignal;
	});
}

const Object_INDEX_RE = /\{(.+?)\}/g;
function formatWithObject(
	text: string,
	values: { [key: string]: any },
): string {
	return text.replace(Object_INDEX_RE, (orignal, matched) => {
		const value = values[matched];
		if (value) {
			return value;
		}
		// not match index, return orignal text
		return orignal;
	});
}

function formatLocale(locale: string): string {
	if (!locale) return "";
	return locale.replace(/_/g, "-").toLowerCase();
}

function flattening(data: any): { [key: string]: string } {
	const result: { [key: string]: string } = {};
	function deepFlat(data: any, keys: string): void {
		Object.keys(data).forEach((key) => {
			const value = data[key];
			const k = keys ? keys + "." + key : key;
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

function appendDebugLog(message: string, obj?: any) {
	const logPath = path.resolve(process.cwd(), "resource-debug.log");
	let line = `[DEBUG] ${message}`;
	if (obj !== undefined) {
		try {
			line += " " + JSON.stringify(obj);
		} catch {
			line += " " + String(obj);
		}
	}
	fs.appendFileSync(logPath, line + "\n");
}

export default locales;
