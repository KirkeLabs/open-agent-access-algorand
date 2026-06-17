import {
  createBazaarDiscoveryFromOaaRule,
  createBazaarResourceRoute
} from "@kirkelabs/open-agent-access-x402-bazaar";
import { hashCanonicalJson, type AgentAccessPolicy } from "@kirkelabs/open-agent-access-core";

const policy: AgentAccessPolicy = {
  version: "0.1",
  protocol: "open-agent-access",
  site: {
    name: "Example Bazaar API",
    origin: "https://api.example"
  },
  defaults: {
    decision: "review",
    requireAgentIdentity: true,
    requirePurpose: true,
    requireReceipt: true
  },
  rules: [
    {
      id: "premium-report",
      match: { methods: ["GET"], paths: ["/premium/report"] },
      decision: "charge",
      purposes: ["research", "monitoring"],
      uses: ["ai-input", "read"],
      deniedUses: ["ai-train"],
      price: { amount: "0.005", currency: "USD", unit: "request" },
      payment: { type: "x402", settlement: "algorand", network: "testnet", scheme: "exact" },
      receipt: { required: true }
    }
  ]
};

const rule = policy.rules[0];
if (!rule) throw new Error("example policy requires a rule");

const discovery = createBazaarDiscoveryFromOaaRule(rule, {
  origin: policy.site.origin,
  method: "GET",
  path: "/premium/report",
  policyUrl: `${policy.site.origin}/.well-known/agent-access.json`,
  policyHash: hashCanonicalJson(policy),
  output: {
    example: { ok: true, tier: "premium", report: "..." }
  }
});

export const route = createBazaarResourceRoute({
  accepts: {
    scheme: "exact",
    network: "algorand-testnet",
    price: "$0.005",
    payTo: "AVM_ADDRESS_PLACEHOLDER"
  },
  discovery
});
