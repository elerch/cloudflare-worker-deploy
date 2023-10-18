import demoWasm from "demo.wasm";
var src_default = {
  async fetch(request, _env2, ctx) {
    const stdout = new TransformStream();
    console.log(request);
    console.log(_env2);
    console.log(ctx);
    let env = {};
    request.headers.forEach((value, key) => {
      env[key] = value;
    });
    const wasi = new WASI({
      args: [
        "./demo.wasm",
        // In a CLI, the first arg is the name of the exe
        "--url=" + request.url,
        // this contains the target but is the full url, so we will use a different arg for this
        "--method=" + request.method,
        '-request="' + JSON.stringify(request) + '"'
      ],
      env,
      stdin: request.body,
      stdout: stdout.writable
    });
    const instance = new WebAssembly.Instance(demoWasm, {
      wasi_snapshot_preview1: wasi.wasiImport
    });
    ctx.waitUntil(wasi.start(instance));
    return new Response(stdout.readable);
  }
};
export {
  src_default as default
};
