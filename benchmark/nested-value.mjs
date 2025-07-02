#!/usr/bin/env node

import benchmarks from "beautify-benchmark";
import Benchmark from "benchmark";

const suite = new Benchmark.Suite();

function getNestedValue(data, key) {
	const keys = key.split(".");
	for (let i = 0; typeof data === "object" && i < keys.length; i++) {
		data = data[keys[i]];
	}
	return data;
}

const resource = {
	"model.user.foo.bar.aa": "Hello",
	model: {
		user: {
			fields: {
				name: "Real Name",
				age: "Age",
				a: {
					b: {
						c: {
							d: {
								e: {
									f: "fff",
								},
							},
							model: {
								user: {
									fields: {
										name: "Real Name",
										age: "Age",
										a: {
											b: {
												c: {
													d: {
														e: {
															f: "fff",
														},
													},
												},
											},
										},
									},
								},
								post: {
									fields: {
										title: "Subject",
									},
								},
							},
						},
					},
				},
			},
			model: {
				user: {
					fields: {
						name: "Real Name",
						age: "Age",
						a: {
							b: {
								c: {
									d: {
										e: {
											f: "fff",
										},
									},
								},
							},
						},
					},
				},
				post: {
					fields: {
						title: "Subject",
					},
				},
			},
		},
		post: {
			fields: {
				title: "Subject",
			},
		},
		model: {
			user: {
				fields: {
					name: "Real Name",
					age: "Age",
					a: {
						b: {
							c: {
								d: {
									e: {
										f: "fff",
									},
								},
							},
						},
					},
				},
			},
			post: {
				fields: {
					title: "Subject",
				},
			},
		},
	},
};

const fullKey = "model.user.fields.a.b.c.d.e.f";

console.log("Deeps: ", fullKey.split(".").length);

// console.log('getNestedValue:', getNestedValue(resource, fullKey));

suite

	.add("direct read a key", () => {
		resource["model.user.foo.bar.aa"];
	})
	.add("by nested", () => {
		getNestedValue(resource, fullKey);
	})
	.on("cycle", (event) => {
		benchmarks.add(event.target);
	})
	.on("complete", function done() {
		benchmarks.log();
	})
	.run({ async: false });
