#!/usr/bin/env node

async function main() {
  console.error("Hello, tsdown!");
}

main().catch((err) => {
  console.error("Fatal error occured: ", err);
  process.exit(1);
});
