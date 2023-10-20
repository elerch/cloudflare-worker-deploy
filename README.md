Upload worker to CloudFlare
===========================

`zig build run -- <worker name> <script file>`. Make sure that authentication
environment variables are set. An example index.js file is included in the
root of the project

Environment Variables
---------------------

The following environment variables are supported and match Wrangler behavior:


CLOUDFLARE_ACCOUNT_ID

    The account ID for the Workers related account.

CLOUDFLARE_API_TOKEN

    The API token for your Cloudflare account, can be used for authentication for situations like CI/CD, and other automation.

CLOUDFLARE_API_KEY

    The API key for your Cloudflare account, usually used for older authentication method with CLOUDFLARE_EMAIL=.

CLOUDFLARE_EMAIL

    The email address associated with your Cloudflare account, usually used for older authentication method with CLOUDFLARE_API_KEY=.

Note that either CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL/CLOUDFLARE_API_KEY
environment variable pair are required

Development notes
=================

Getting new src/script_harness.js
---------------------------------

* Run a real wrangler deploy, then go into the console and copy/paste

Getting new memfs.wasm
----------------------

`npm view @cloudflare/workers-wasi`

```
.tarball: https://registry.npmjs.org/@cloudflare/workers-wasi/-/workers-wasi-0.0.5.tgz
.shasum: 1d9a69c668fd9e240f929dfd5ca802447f31d911
.integrity: sha512-Gxu2tt2YY8tRgN7vfY8mSW0Md5wUj5+gb5eYrqsGRM+qJn9jx+ButL6BteLluDe5vlEkxQ69LagEMHjE58O7iQ==
```

Steps we take:
--------------
0. Get account id. CLOUDFLARE_ACCOUNT_ID environment variable will be checked first. If not,
   GET https://api.cloudflare.com/client/v4/accounts/
1. Check if the worker exists:
   GET https://api.cloudflare.com/client/v4/accounts/<account id>/workers/services/<worker_name>
   404 - does not exist
2. Add the "script"
   PUT https://api.cloudflare.com/client/v4/accounts/<account id>/workers/scripts/<worker_name>?include_subdomain_availability=true&excludeScript=true
3. Get the "subdomain". I believe this is simply to determine the test url:
   GET https://api.cloudflare.com/client/v4/accounts/<account id>/workers/subdomain
4. Enable the script: This is **only** done if the script did not exist. Subsequent flows leave this alone
   POST https://api.cloudflare.com/client/v4/accounts/<account id>/workers/scripts/<worker_name>/subdomain
   Data: { "enabled": true }
