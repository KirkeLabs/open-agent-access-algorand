# @kirkelabs/open-agent-access-cli

Command-line tools for Open Agent Access.

```sh
oaa doctor
oaa conformance run
oaa policy init --template publisher --origin https://example.com
oaa policy validate ./agent-access.json
oaa policy lint ./agent-access.json
oaa policy explain ./agent-access.json https://example.com/free --purpose research --use read
oaa check https://example.com/premium/report --purpose research --use ai-input --budget USD:0.05
oaa fetch https://example.com/free --purpose research --use read
oaa receipts verify .oaa/receipts.jsonl
oaa receipts inspect .oaa/receipts.jsonl --trace-id TRACE
oaa receipts reconcile .oaa/receipts.jsonl .oaa/site-receipts.jsonl
oaa receipts keygen
oaa receipts sign .oaa/receipts.jsonl .oaa/signed-receipts.jsonl --private-key .oaa/receipt-private.pem
oaa receipts verify-signatures .oaa/signed-receipts.jsonl --public-key .oaa/receipt-public.pem
```

Payments are disabled by default. Use `--pay` or
`OAA_PAYMENTS_ENABLED=true` only when local policy, signer setup, and budget are
intentional.
