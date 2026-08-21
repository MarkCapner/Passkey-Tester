# Passkey Tester

A small, dependency-free WebAuthn test bench for comparing passkey behavior across browsers, operating systems, security keys, and password managers. All credential operations and response inspection happen locally in the browser.

## Run over HTTPS (including other devices)

You need Node.js 18 or newer and OpenSSL. The first start creates a private local certificate authority and a server certificate containing `localhost` and the computer's current LAN IPv4 addresses, then listens on all network interfaces:

```bash
npm start
```

The terminal prints the available URLs. On the computer running the server you can use [https://localhost:4173](https://localhost:4173). To use a phone, tablet, or another computer:

1. Copy `certs/passkey-tester-ca.crt` to that device. Do **not** copy either `.key` file.
2. Install that certificate as a trusted root/CA certificate. On iOS/iPadOS, also enable full trust under **Settings > General > About > Certificate Trust Settings**. On Android, install it as a **CA certificate** in the device's security settings. Managed devices may prevent installing a user CA.
3. Connect the device to the same network and open one of the printed LAN URLs, such as `https://192.168.1.25:4173`.
4. If it cannot connect, allow inbound TCP port 4173 in the server computer's firewall and make sure the Wi-Fi network does not isolate clients.

The browser must show a trusted HTTPS connection before WebAuthn/passkeys will work. A warning page that you click through is not sufficient on every browser. The generated CA private key can issue certificates trusted by your devices, so keep `certs/passkey-tester-ca.key` private and remove the installed CA when you no longer need it.

If the server computer's LAN address changes, replace the certificate so its subject alternative names contain the new address, then restart:

```bash
npm run certificates -- --force
npm start
```

You will need to install the newly generated CA certificate on the client devices again. Passkeys are scoped to the exact relying-party ID (the hostname or IP address), so consistently use the same URL if you want to authenticate with a passkey registered earlier.

To use another port:

```bash
PORT=8080 npm start
```

To bind to a particular interface instead of every interface, set `HOST` as well (for example, `HOST=192.168.1.25 npm start`). The certificate is independent of the port.

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
