import {
  InMemoryReplayStore,
  RECOMMENDED_OPENAI_MODEL,
  instapayEgyptPreset,
} from "../../dist/openai-entry.js";

if (RECOMMENDED_OPENAI_MODEL !== "gpt-5.6-terra") throw new Error("Unexpected model export");
if (instapayEgyptPreset().id !== "instapay-egypt") throw new Error("Unexpected preset export");
new InMemoryReplayStore().clear();
process.stdout.write("Node import smoke test passed.\n");
