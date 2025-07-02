#!/usr/bin/env node

import util from "node:util";
import benchmarks from "beautify-benchmark";
import Benchmark from "benchmark";

const suite = new Benchmark.Suite();

function normal(text, ...args) {
	return util.format(text, ...args);
}

function apply(...args) {
	return util.format(...args);
}

function apply2(...args) {
	return util.format(...args);
}

console.log("normal(): %s", normal("this is %s.", "string"));
console.log("apply(): %s", apply("this is %s.", "string"));
console.log("apply2(): %s", apply2("this is %s.", "string"));

suite

	.add("normal(arg0, arg1, ...)", () => {
		normal("this is %s.", "string");
		normal("this is %s and %s.", "string", "string2");
		normal("this is %s and %s and %s.", "string", "string2", "string3");
		normal(
			"this is %s and %s and %s and %s.",
			"string",
			"string2",
			"string3",
			"string4",
		);
	})
	.add("function.apply(arg0, arg1, ...)", () => {
		apply("this is %s.", "string");
		apply("this is %s and %s.", "string", "string2");
		apply("this is %s and %s and %s.", "string", "string2", "string3");
		apply(
			"this is %s and %s and %s and %s.",
			"string",
			"string2",
			"string3",
			"string4",
		);
	})
	.add("function.apply2(arg0, arg1, ...)", () => {
		apply2("this is %s.", "string");
		apply2("this is %s and %s.", "string", "string2");
		apply2("this is %s and %s and %s.", "string", "string2", "string3");
		apply2(
			"this is %s and %s and %s and %s.",
			"string",
			"string2",
			"string3",
			"string4",
		);
	})

	.on("cycle", (event) => {
		benchmarks.add(event.target);
	})
	.on("start", () => {
		console.log(
			"\n  dynamic arguments Benchmark\n  node version: %s, date: %s\n  Starting...",
			process.version,
			Date(),
		);
	})
	.on("complete", function done() {
		benchmarks.log();
	})
	.run({ async: false });

// normal(): this is string.
// apply(): this is string.
// apply2(): this is string.
//
//   dynamic arguments Benchmark
//   node version: v2.2.1, date: Sun Aug 30 2015 20:45:42 GMT+0800 (CST)
//   Starting...
//   3 tests completed.
//
//   normal(arg0, arg1, ...)          x 273,983 ops/sec ±0.80% (101 runs sampled)
//   function.apply(arg0, arg1, ...)  x 222,616 ops/sec ±0.70% (98 runs sampled)
//   function.apply2(arg0, arg1, ...) x 265,349
