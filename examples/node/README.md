# Zero-framework Node example

Build the package, set `OPENAI_API_KEY`, and run:

```bash
npm run build
node examples/node/verify-receipt.mjs ./receipt.png image/png
```

Configure the expected transaction through the documented environment variables in the script. The example maps verifier outcomes to HTTP-style application decisions without starting a framework or exposing a provider key.
