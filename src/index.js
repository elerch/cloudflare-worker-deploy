import { WASI } from "@cloudflare/workers-wasi";
import demoWasm from "./demo.wasm";

export default {
  async fetch(request, _env, ctx) {
    // Creates a TransformStream we can use to pipe our stdout to our response body.
    const stdout = new TransformStream();
    console.log(request);
    console.log(_env);
    console.log(ctx);

    // Get our headers into environment variables (should we prefix this?)
    let env = {};
    request.headers.forEach((value, key) => {
      env[key] = value;
    });
    const wasi = new WASI({
      args: [
        './demo.wasm', // In a CLI, the first arg is the name of the exe
        '--url=' + request.url, // this contains the target but is the full url, so we will use a different arg for this
        '--method=' + request.method,
        '-request="' + JSON.stringify(request) + '"',
      ],
      env: env,
      stdin: request.body,
      stdout: stdout.writable,
    });

    // Instantiate our WASM with our demo module and our configured WASI import.
    const instance = new WebAssembly.Instance(demoWasm, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    // Keep our worker alive until the WASM has finished executing.
    ctx.waitUntil(wasi.start(instance));

    // Finally, let's reply with the WASM's output.
    return new Response(stdout.readable);
  },
};

