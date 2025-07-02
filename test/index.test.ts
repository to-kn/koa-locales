import assert from "node:assert";
import Koa from "koa";
import mm from "mm";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { LocalesOptions } from "../src";
import locales from "../src";

describe("koa-locales.test.js", () => {
	afterEach(mm.restore);

	describe("default options", () => {
		const app = createApp();

		it("should use default locale: en-US", async () => {
			await request(app.callback())
				.get("/")
				.expect({
					email: "Email",
					hello: "Hello fengmk2, how are you today?",
					message: "Hello fengmk2, how are you today? How was your 18.",
					empty: "",
					notexists_key: "key not exists",
					empty_string: "",
					empty_value: "emptyValue",
					novalue: "key %s ok",
					arguments3: "1 2 3",
					arguments4: "1 2 3 4",
					arguments5: "1 2 3 4 5",
					arguments6: "1 2 3 4 5. 6",
					values: "foo bar foo bar {2} {100}",
					object: "foo bar foo bar {z}",
					gender: "model.user.fields.gender",
					name: "model.user.fields.name",
				})
				.expect("Set-Cookie", /^locale=en-us; path=\/+; expires=[^;]+ GMT$/)
				.expect(200);
		});

		it("should not set locale cookie after header sent", async () => {
			await request(app.callback())
				.get("/headerSent")
				.expect("foo")
				.expect(200);
		});
	});

	describe("options.cookieDomain", () => {
		const app = createApp({
			cookieDomain: ".foo.com",
		});

		it("should use default locale: en-US", async () => {
			await request(app.callback())
				.get("/")
				.expect({
					email: "Email",
					hello: "Hello fengmk2, how are you today?",
					message: "Hello fengmk2, how are you today? How was your 18.",
					empty: "",
					notexists_key: "key not exists",
					empty_string: "",
					empty_value: "emptyValue",
					novalue: "key %s ok",
					arguments3: "1 2 3",
					arguments4: "1 2 3 4",
					arguments5: "1 2 3 4 5",
					arguments6: "1 2 3 4 5. 6",
					values: "foo bar foo bar {2} {100}",
					object: "foo bar foo bar {z}",
					gender: "model.user.fields.gender",
					name: "model.user.fields.name",
				})
				.expect(
					"Set-Cookie",
					/^locale=en-us; path=\/; expires=[^;]+; domain=.foo.com$/,
				)
				.expect(200);
		});
	});

	describe("custom options", () => {
		const app = createApp({
			dirs: [`${__dirname}/locales`, `${__dirname}/other-locales`],
		});
		const cookieFieldMapApp = createApp({
			dirs: [`${__dirname}/locales`, `${__dirname}/other-locales`],
			localeAlias: {
				en: "en-US",
				"de-de": "de",
			},
		});
		const appNotWriteCookie = createApp({
			dirs: [`${__dirname}/locales`, `${__dirname}/other-locales`],
			writeCookie: false,
		});

		it("should use default locale: en-US", async () => {
			await request(app.callback())
				.get("/")
				.expect({
					email: "Email",
					hello: "Hello fengmk2, how are you today?",
					message: "Hello fengmk2, how are you today? How was your 18.",
					empty: "",
					notexists_key: "key not exists",
					empty_string: "",
					empty_value: "emptyValue",
					novalue: "key %s ok",
					arguments3: "1 2 3",
					arguments4: "1 2 3 4",
					arguments5: "1 2 3 4 5",
					arguments6: "1 2 3 4 5. 6",
					values: "foo bar foo bar {2} {100}",
					object: "foo bar foo bar {z}",
					gender: "model.user.fields.gender",
					name: "model.user.fields.name",
				})
				.expect("Set-Cookie", /^locale=en-us; path=\/; expires=\w+/)
				.expect(200);
		});

		it("should gettext work on app.__(locale, key, value)", async () => {
			await request(app.callback())
				.get("/app_locale_zh")
				.expect({
					email: "邮箱1",
				})
				.expect(200);
		});

		describe("query.locale", () => {
			it("should use query locale: zh-CN", async () => {
				await request(app.callback())
					.get("/?locale=zh-CN")
					.expect({
						email: "邮箱1",
						hello: "fengmk2，今天过得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性别",
						name: "姓名",
					})
					.expect("Set-Cookie", /^locale=zh-cn; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should use query locale: de on *.properties format", async () => {
				await request(app.callback())
					.get("/?locale=de")
					.expect({
						email: "Emailde",
						hello: "Hallo fengmk2, wie geht es dir heute?",
						message: "Hallo fengmk2, wie geht es dir heute? Wie war dein 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=de; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should use query locale and change cookie locale", async () => {
				await request(app.callback())
					.get("/?locale=zh-CN")
					.set("cookie", "locale=zh-TW")
					.expect({
						email: "邮箱1",
						hello: "fengmk2，今天过得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性别",
						name: "姓名",
					})
					.expect("Set-Cookie", /^locale=zh-cn; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should ignore invalid locale value", async () => {
				await request(app.callback())
					.get("/?locale=xss")
					.expect({
						email: "Email",
						hello: "Hello fengmk2, how are you today?",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=en-us; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should use localeAlias", async () => {
				await request(cookieFieldMapApp.callback())
					.get("/?locale=de-de")
					.expect({
						email: "Emailde",
						hello: "Hallo fengmk2, wie geht es dir heute?",
						message: "Hallo fengmk2, wie geht es dir heute? Wie war dein 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=de; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should use query locale and response without set-cookie", async () => {
				await request(appNotWriteCookie.callback())
					.get("/?locale=zh-CN")
					.expect({
						email: "邮箱1",
						hello: "fengmk2，今天过得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性别",
						name: "姓名",
					})
					.expect((res) => {
						if (res.headers["set-cookie"] || res.headers["Set-Cookie"]) {
							throw new Error("should not write cookie");
						}
					})
					.expect(200);
			});
		});

		describe("cookie.locale", () => {
			it("should use cookie locale: zh-CN", async () => {
				await request(app.callback())
					.get("/?locale=")
					.set("cookie", "locale=zh-cn")
					.expect({
						email: "邮箱1",
						hello: "fengmk2，今天过得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性别",
						name: "姓名",
					})
					.expect((res) => {
						assert(!res.headers["set-cookie"]);
					})
					.expect(200);
			});
		});

		describe("Accept-Language", () => {
			it("should use Accept-Language: zh-CN", async () => {
				await request(app.callback())
					.get("/?locale=")
					.set("Accept-Language", "zh-CN")
					.expect({
						email: "邮箱1",
						hello: "fengmk2，今天过得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性别",
						name: "姓名",
					})
					.expect("Set-Cookie", /^locale=zh-cn; path=\/; expires=\w+/)
					.expect(200);
			});

			it('should work with "Accept-Language: " header', async () => {
				await request(app.callback())
					.get("/?locale=")
					.set("Accept-Language", "")
					.expect({
						email: "Email",
						hello: "Hello fengmk2, how are you today?",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=en-us; path=\/; expires=\w+/)
					.expect(200);
			});

			it('should work with "Accept-Language: en"', async () => {
				await request(app.callback())
					.get("/")
					.set("Accept-Language", "en")
					.expect({
						email: "Email",
						hello: "Hello fengmk2, how are you today?",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=en-us; path=\/; expires=\w+/)
					.expect(200);
			});

			it('should work with "Accept-Language: de-de" by localeAlias', async () => {
				await request(cookieFieldMapApp.callback())
					.get("/")
					.set("Accept-Language", "ja,de-de;q=0.8")
					.expect({
						email: "Emailde",
						hello: "Hallo fengmk2, wie geht es dir heute?",
						message: "Hallo fengmk2, wie geht es dir heute? Wie war dein 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=de; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should mock acceptsLanguages return string", async () => {
				mm(app.request, "acceptsLanguages", () => "zh-TW");
				await request(app.callback())
					.get("/?locale=")
					.expect({
						email: "郵箱",
						hello: "fengmk2，今天過得如何？",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "性別",
						name: "姓名",
					})
					.expect("Set-Cookie", /^locale=zh-tw; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should mock acceptsLanguages return string", async () => {
				mm(app.request, "acceptsLanguages", () => "fr");
				await request(app.callback())
					.get("/?locale=fr")
					.set("Accept-Language", "fr;q=0.8, fr, fr")
					.expect({
						email: "le email",
						hello: "fengmk2, Comment allez-vous",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "le sexe",
						name: "prénom",
					})
					.expect("Set-Cookie", /^locale=fr; path=\/; expires=\w+/)
					.expect(200);
			});

			it("should mock acceptsLanguages return null", async () => {
				mm(app.request, "acceptsLanguages", () => null);
				await request(app.callback())
					.get("/?locale=")
					.expect({
						email: "Email",
						hello: "Hello fengmk2, how are you today?",
						message: "Hello fengmk2, how are you today? How was your 18.",
						empty: "",
						notexists_key: "key not exists",
						empty_string: "",
						empty_value: "emptyValue",
						novalue: "key %s ok",
						arguments3: "1 2 3",
						arguments4: "1 2 3 4",
						arguments5: "1 2 3 4 5",
						arguments6: "1 2 3 4 5. 6",
						values: "foo bar foo bar {2} {100}",
						object: "foo bar foo bar {z}",
						gender: "model.user.fields.gender",
						name: "model.user.fields.name",
					})
					.expect("Set-Cookie", /^locale=en-us; path=\/; expires=\w+/)
					.expect(200);
			});
		});

		describe("__getLocale and __getLocaleOrigin", () => {
			it("should __getLocale and __getLocaleOrigin from cookie", async () => {
				const res = await request(app.callback())
					.get("/origin")
					.set("cookie", "locale=de");
				expect(res.body).toEqual({ locale: "de", localeOrigin: "cookie" });
			});

			it("should __getLocale and __getLocaleOrigin from query", async () => {
				const res = await request(app.callback()).get("/origin?locale=de");
				expect(res.body).toEqual({ locale: "de", localeOrigin: "query" });
			});

			it("should __getLocale and __getLocaleOrigin from header", async () => {
				const res = await request(app.callback())
					.get("/origin")
					.set("Accept-Language", "zh-cn");
				expect(res.body).toEqual({ locale: "zh-cn", localeOrigin: "header" });
			});

			it("should __getLocale and __getLocaleOrigin from default", async () => {
				const res = await request(app.callback()).get("/origin");
				expect(res.body).toEqual({ locale: "en-us", localeOrigin: "default" });
			});
		});

		describe("__setLocale", () => {
			it("should set locale and cookie", async () => {
				const res = await request(app.callback())
					.get("/set")
					.set("cookie", "locale=de");
				expect(res.body).toEqual({ locale: "zh-hk", localeOrigin: "set" });
				expect(res.headers["set-cookie"]).toBeTruthy();
			});
		});
	});
});

// @ts-ignore: legacy test expects any type for options
function createApp(options?: unknown) {
	const app = new Koa();
	locales(app, options as LocalesOptions);
	const fname = (options as LocalesOptions)?.functionName || "__";

	app.use(async (ctx, next) => {
		if (ctx.url === "/app_locale_zh") {
			ctx.body = {
				// @ts-ignore: legacy test expects any type for Application index
				email: ctx.app[fname]("zh-cn", "Email"),
			};
			return;
		}
		if (ctx.path === "/origin") {
			ctx.body = {
				locale: ctx.__getLocale(),
				localeOrigin: ctx.__getLocaleOrigin(),
			};
			return;
		}
		if (ctx.path === "/set") {
			ctx.__getLocale();
			ctx.__setLocale("zh-tw");
			ctx.__setLocale("zh-hk");
			ctx.body = {
				locale: ctx.__getLocale(),
				localeOrigin: ctx.__getLocaleOrigin(),
			};
			return;
		}
		if (ctx.url === "/headerSent") {
			ctx.body = "foo";
			// @ts-ignore: legacy test expects any type for Application index
			setTimeout(() => {
				ctx.app[fname]("Email");
			}, 50);
			return;
		}
		ctx.body = {
			email: ctx[fname]("Email"),
			name: ctx[fname]("model.user.fields.name"),
			gender: ctx[fname]("model.user.fields.gender"),
			hello: ctx[fname]("Hello %s, how are you today?", "fengmk2"),
			message: ctx[fname](
				"Hello %s, how are you today? How was your %s.",
				"fengmk2",
				18,
			),
			empty: ctx[fname]("empty"),
			notexists_key: ctx[fname]("key not exists"),
			empty_string: ctx[fname](""),
			empty_value: ctx[fname]("emptyValue"),
			novalue: ctx[fname]("key %s ok"),
			arguments3: ctx[fname]("%s %s %s", 1, 2, 3),
			arguments4: ctx[fname]("%s %s %s %s", 1, 2, 3, 4),
			arguments5: ctx[fname]("%s %s %s %s %s", 1, 2, 3, 4, 5),
			arguments6: ctx[fname]("%s %s %s %s %s.", 1, 2, 3, 4, 5, 6),
			values: ctx[fname]("{0} {1} {0} {1} {2} {100}", ["foo", "bar"]),
			object: ctx[fname]("{foo} {bar} {foo} {bar} {z}", {
				foo: "foo",
				bar: "bar",
			}),
		};
		if (next) await next();
	});
	return app;
}
