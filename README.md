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
- Automatic password-manager identification from the authenticator AAGUID when the provider is known
- A persistent, selectable credential list for testing exclusion behavior with several synced passkeys
- Browser response fields, extensions, transports, and client data
- Fully editable creation and authentication option JSON, including exclude/allow credential lists and extension inputs
- A persistent, exportable results log showing the browser, selected password manager, include/exclude mode, outcome, and error details for every attempt

The JSON editors use the standard WebAuthn JSON representation: binary fields such as `challenge`, `user.id`, and credential descriptor IDs are base64url strings. Use **Choose excluded credentials** to select any credentials previously observed in that browser, or **Allow last credential** to insert the credential created during the current session. Both editors accept either the `publicKey` options directly or a `{ "publicKey": { ... } }` wrapper.

> This is a browser API diagnostic tool, not a production relying party. It intentionally has no backend and does not verify signatures or persist public keys.

On creation, the tester extracts the AAGUID from authenticator data and maps known AAGUIDs to their password manager automatically. Unknown or privacy-redacted AAGUIDs remain labelled **Unknown authenticator**. A browser cannot enumerate the credentials in a password manager: to test a synced passkey in another browser, authenticate with the discoverable credential once there. The returned credential ID is then saved locally and becomes available in **Choose excluded credentials**. Test history and saved credential IDs remain in the current browser's local storage.
