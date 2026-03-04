import { Pipeline } from "./pipeline.js";
import type { VerticalId } from "./types.js";

interface ParsedArgs {
  city?: string;
  category?: string;
  name?: string;
  url?: string;
  vertical?: VerticalId;
  limit?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--city" && next) {
      args.city = next;
      index += 1;
    } else if (current === "--category" && next) {
      args.category = next;
      index += 1;
    } else if (current === "--url" && next) {
      args.url = next;
      index += 1;
    } else if (current === "--name" && next) {
      args.name = next;
      index += 1;
    } else if (current === "--vertical" && next) {
      args.vertical = next as VerticalId;
      index += 1;
    } else if (current === "--limit" && next) {
      args.limit = Number(next);
      index += 1;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url && !args.city && !args.name) {
    throw new Error("Provide either --url, --name, or --city with --category.");
  }

  const pipeline = new Pipeline();
  const results = await pipeline.run(args);

  for (const result of results) {
    console.log(`Scout -> Auditor -> Builder -> Analyst -> Closer completed for ${result.audit.venue.name} (${result.audit.venue.vertical})`);
    console.log(`Score: ${result.audit.score}`);
    console.log(`Top leaks: ${result.audit.topLeaks.slice(0, 3).map((leak) => leak.title).join(", ")}`);
    console.log(`Output: ${result.build.outputDir}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
