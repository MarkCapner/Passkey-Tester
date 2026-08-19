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
- Automatic authenticator identification from its AAGUID, including its friendly name and dark icon, using the bundled combined AAGUID metadata
- A persistent, selectable credential list for testing exclusion behavior with several synced passkeys
- Browser response fields, extensions, transports, and client data
- Fully editable creation and authentication option JSON, including exclude/allow credential lists and extension inputs
- A persistent, exportable results log showing the browser, selected password manager, include/exclude mode, outcome, and error details for every attempt

The JSON editors use the standard WebAuthn JSON representation: binary fields such as `challenge`, `user.id`, and credential descriptor IDs are base64url strings. Use **Choose excluded credentials** to select credentials observed by any browser connected to the same tester server, or **Allow last credential** to insert the credential created during the current session. Both editors accept either the `publicKey` options directly or a `{ "publicKey": { ... } }` wrapper.

> This is a browser API diagnostic tool, not a production relying party. Its small local server reads the bundled authenticator metadata; it does not verify attestation signatures or persist public keys.

On creation, the tester extracts the AAGUID from authenticator data and asks the local server to resolve it against the repository's `combined_aaguid.json`. The metadata is parsed locally and cached in memory, so authenticator identification does not require a network request. The authenticator's friendly name and dark icon are used when available, with a light icon as a fallback for entries that do not include dark artwork. Unknown or privacy-redacted AAGUIDs remain labelled **Unknown authenticator**, and unavailable metadata never prevents credential creation. A browser cannot enumerate the credentials in a password manager, but credential IDs observed during creation or authentication are stored in `data/shared-state.json`. The activity log and saved IDs are then available to every browser connected to that tester server. Existing browser-local records are migrated to the shared store the next time that browser opens the app.
