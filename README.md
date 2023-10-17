Upload worker to CloudFlare
===========================

Until we're better
------------------

1. Add `accountid.txt` to `src/` with the CloudFlare account id
2. Add `worker_name.txt` to `src/` with CloudFlare worker name
3. `zig build run`

Getting new index.js
--------------------

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
