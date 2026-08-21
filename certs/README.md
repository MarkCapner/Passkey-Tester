# Local certificates

`npm start` creates a private local certificate authority and an HTTPS server certificate in this directory. Generated keys and certificates are intentionally ignored by Git; every installation should have its own CA and private key.

Install `passkey-tester-ca.crt` as a trusted root certificate on each client device before visiting the tester. Never copy or share either `.key` file.
