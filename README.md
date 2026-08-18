# Passkey Tester

A small, dependency-free WebAuthn test bench for comparing passkey behavior across browsers, operating systems, security keys, and password managers. All credential operations and response inspection happen locally in the browser.

## Run locally

You need Node.js 18 or newer.

```bash
npm start
```

Then open [http://localhost:4173](http://localhost:4173). Browsers treat `localhost` as a secure context, which is required by WebAuthn.

To use another port:

```bash
PORT=8080 npm start
```

## What you can test

- Platform, roaming, or automatically selected authenticators
- Discoverable credential preferences
- Required, preferred, and discouraged user verification
- None, indirect, direct, and enterprise attestation conveyance
- Authentication using the last credential or any discoverable credential
- Browser response fields, extensions, transports, and client data
- Fully editable creation and authentication option JSON, including exclude/allow credential lists and extension inputs

The JSON editors use the standard WebAuthn JSON representation: binary fields such as `challenge`, `user.id`, and credential descriptor IDs are base64url strings. Use **Exclude last credential** or **Allow last credential** to insert the credential created during the current session, or paste any base64url credential ID yourself. Both editors accept either the `publicKey` options directly or a `{ "publicKey": { ... } }` wrapper.

> This is a browser API diagnostic tool, not a production relying party. It intentionally has no backend and does not verify signatures or persist public keys.
