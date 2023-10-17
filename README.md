Upload worker to CloudFlare
===========================

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
