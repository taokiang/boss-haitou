#!/usr/bin/env node
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist/edgeone-app");
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "service"), { recursive: true });
await cp(path.resolve("edge-functions"), path.join(output, "edge-functions"), { recursive: true });
await cp(path.resolve("service/card-service.mjs"), path.join(output, "service/card-service.mjs"));
console.log(output);
