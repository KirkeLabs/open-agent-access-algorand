import { budgetAllowsPrice } from "./budget.js";
import { decideAccess, isTerminalDecision } from "./decision.js";
import { discoverPolicy } from "./discovery.js";
import { buildAgentAccessHeaders, receiptFromResponseHeaders } from "./headers.js";
import { createTraceId, hashCanonicalJson } from "./hash.js";
import { appendReceipt } from "./receipts.js";
import type { AgentAccessRequest, AgentIdentity, ReceiptLedgerOptions, ReceiptRecord } from "./types.js";

export interface AgentAccessClientOptions {
  agent: AgentIdentity;
  identity?: {
    signer?: {
      keyId: string;
      privateKeyPem: string;
    };
  };
  ledger?: ReceiptLedgerOptions;
  payments?: {
    algorandX402?: {
      enabled?: boolean;
      network?: string;
      mnemonicEnv?: string;
    };
  };
  fetch?: typeof fetch;
}

export interface AgentFetchOptions extends Omit<RequestInit, "method"> {
  method?: string;
  purpose: string;
  use: string;
  budget?: { amount: string; currency: string };
  maxRate?: string;
  dryRun?: boolean;
}

export function createAgentAccessClient(options: AgentAccessClientOptions) {
  const fetchImpl = options.fetch ?? fetch;

  return {
    async fetch(url: string, requestOptions: AgentFetchOptions) {
      const method = (requestOptions.method ?? "GET").toUpperCase();
      const traceId = createTraceId();
      const discovered = await discoverPolicy(url, fetchImpl);
      const request: AgentAccessRequest = {
        url,
        method,
        purpose: requestOptions.purpose,
        use: requestOptions.use,
        budget: requestOptions.budget,
        maxRate: requestOptions.maxRate,
        agent: options.agent
      };
      const decision = decideAccess(discovered.policy, request);
      const policyHash = hashCanonicalJson(discovered.policy);
      const paymentRequired = decision.decision === "charge";
      const payment = decision.rule?.payment;
      const price = decision.rule?.price;
      let response: Response | undefined;
      let paymentMetadata: ReceiptRecord["payment"] = {
        required: paymentRequired,
        type: payment?.type,
        settlement: payment?.settlement,
        network: payment?.network,
        asset: payment?.asset,
        price,
        facilitatorUrl: payment?.facilitatorUrl ?? (payment?.facilitatorUrlEnv ? process.env[payment.facilitatorUrlEnv] : undefined),
        payTo: payment?.payTo ?? (payment?.payToEnv ? process.env[payment.payToEnv] : undefined)
      };

      if (paymentRequired && !budgetAllowsPrice(requestOptions.budget, price)) {
        const receipt = await maybeWriteReceipt(options.ledger, {
          role: "agent",
          traceId,
          method,
          url,
          origin: new URL(url).origin,
          agent: options.agent,
          declared: {
            purpose: requestOptions.purpose,
            use: requestOptions.use,
            budget: requestOptions.budget
          },
          policy: {
            url: discovered.url,
            ruleId: decision.rule?.id,
            policyHash,
            decision: decision.decision
          },
          payment: paymentMetadata,
          response: { status: 402 }
        });
        return { decision, policy: discovered.policy, policyUrl: discovered.url, policyHash, response, payment: paymentMetadata, receipt, traceId };
      }

      if (isTerminalDecision(decision.decision)) {
        const receipt = await maybeWriteReceipt(options.ledger, {
          role: "agent",
          traceId,
          method,
          url,
          origin: new URL(url).origin,
          agent: options.agent,
          declared: { purpose: requestOptions.purpose, use: requestOptions.use, budget: requestOptions.budget },
          policy: { url: discovered.url, ruleId: decision.rule?.id, policyHash, decision: decision.decision },
          payment: paymentMetadata
        });
        return { decision, policy: discovered.policy, policyUrl: discovered.url, policyHash, response, payment: paymentMetadata, receipt, traceId };
      }

      if (!requestOptions.dryRun) {
        const headers = new Headers(requestOptions.headers);
        buildAgentAccessHeaders({
          agent: options.agent,
          purpose: requestOptions.purpose,
          use: requestOptions.use,
          budget: requestOptions.budget,
          traceId
        }).forEach((value, key) => headers.set(key, value));
        if (options.identity?.signer) {
          const { signAgentAccessHeaders } = await import("@kirkelabs/open-agent-access-identity");
          signAgentAccessHeaders(headers, {
            method,
            url,
            keyId: options.identity.signer.keyId,
            privateKeyPem: options.identity.signer.privateKeyPem
          });
        }

        if (paymentRequired && options.payments?.algorandX402?.enabled) {
          const { wrapFetchWithAlgorandX402Payment } = await import("@kirkelabs/open-agent-access-payments-algorand-x402");
          const paidFetch = await wrapFetchWithAlgorandX402Payment(fetchImpl, {
            enabled: true,
            network: payment?.network ?? options.payments.algorandX402.network ?? "testnet",
            mnemonicEnv: options.payments.algorandX402.mnemonicEnv ?? "AVM_MNEMONIC",
            budget: requestOptions.budget,
            price,
            facilitatorUrl: paymentMetadata.facilitatorUrl
          });
          response = await paidFetch(url, { ...requestOptions, method, headers });
        } else {
          response = await fetchImpl(url, { ...requestOptions, method, headers });
        }
        const settlementHeader = response.headers.get("X-PAYMENT-RESPONSE") ?? response.headers.get("x-payment-response");
        paymentMetadata = {
          ...paymentMetadata,
          settlementSuccess: response.ok && Boolean(settlementHeader),
          transactionId: response.headers.get("AA-Payment-Txn") ?? undefined
        };
      }

      const receipt = await maybeWriteReceipt(options.ledger, {
        role: "agent",
        traceId,
        method,
        url,
        origin: new URL(url).origin,
        agent: options.agent,
        declared: { purpose: requestOptions.purpose, use: requestOptions.use, budget: requestOptions.budget },
        policy: { url: discovered.url, ruleId: decision.rule?.id, policyHash, decision: decision.decision },
        ...receiptFromResponseHeaders(response?.headers ?? new Headers()),
        payment: paymentMetadata,
        response: {
          status: response?.status,
          contentType: response?.headers.get("content-type")
        }
      });
      return { decision, policy: discovered.policy, policyUrl: discovered.url, policyHash, response, payment: paymentMetadata, receipt, traceId };
    }
  };
}

async function maybeWriteReceipt(ledger: ReceiptLedgerOptions | undefined, input: Omit<ReceiptRecord, "receiptVersion" | "receiptType" | "receiptId" | "timestamp" | "previousHash" | "receiptHash">) {
  if (!ledger) {
    return undefined;
  }
  return appendReceipt(ledger.path, {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    ...input
  });
}
