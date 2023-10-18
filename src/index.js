// node_modules/@cloudflare/workers-wasi/dist/index.mjs
import wasm from "./c5f1acc97ad09df861eff9ef567c2186d4e38de3-memfs.wasm";
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};
var Result;
(function(Result2) {
  Result2[Result2["SUCCESS"] = 0] = "SUCCESS";
  Result2[Result2["EBADF"] = 8] = "EBADF";
  Result2[Result2["EINVAL"] = 28] = "EINVAL";
  Result2[Result2["ENOENT"] = 44] = "ENOENT";
  Result2[Result2["ENOSYS"] = 52] = "ENOSYS";
  Result2[Result2["ENOTSUP"] = 58] = "ENOTSUP";
})(Result || (Result = {}));
var Clock;
(function(Clock2) {
  Clock2[Clock2["REALTIME"] = 0] = "REALTIME";
  Clock2[Clock2["MONOTONIC"] = 1] = "MONOTONIC";
  Clock2[Clock2["PROCESS_CPUTIME_ID"] = 2] = "PROCESS_CPUTIME_ID";
  Clock2[Clock2["THREAD_CPUTIME_ID"] = 3] = "THREAD_CPUTIME_ID";
})(Clock || (Clock = {}));
var iovViews = (view, iovs_ptr, iovs_len) => {
  let result = Array(iovs_len);
  for (let i = 0; i < iovs_len; i++) {
    const bufferPtr = view.getUint32(iovs_ptr, true);
    iovs_ptr += 4;
    const bufferLen = view.getUint32(iovs_ptr, true);
    iovs_ptr += 4;
    result[i] = new Uint8Array(view.buffer, bufferPtr, bufferLen);
  }
  return result;
};
var _instance;
var _hostMemory;
var _getInternalView;
var getInternalView_fn;
var _copyFrom;
var copyFrom_fn;
var MemFS = class {
  constructor(preopens, fs) {
    __privateAdd(this, _getInternalView);
    __privateAdd(this, _copyFrom);
    __privateAdd(this, _instance, void 0);
    __privateAdd(this, _hostMemory, void 0);
    __privateSet(this, _instance, new WebAssembly.Instance(wasm, {
      internal: {
        now_ms: () => Date.now(),
        trace: (isError, addr, size) => {
          const view = new Uint8Array(__privateMethod(this, _getInternalView, getInternalView_fn).call(this).buffer, addr, size);
          const s = new TextDecoder().decode(view);
          if (isError) {
            throw new Error(s);
          } else {
            console.info(s);
          }
        },
        copy_out: (srcAddr, dstAddr, size) => {
          const dst = new Uint8Array(__privateGet(this, _hostMemory).buffer, dstAddr, size);
          const src = new Uint8Array(__privateMethod(this, _getInternalView, getInternalView_fn).call(this).buffer, srcAddr, size);
          dst.set(src);
        },
        copy_in: (srcAddr, dstAddr, size) => {
          const src = new Uint8Array(__privateGet(this, _hostMemory).buffer, srcAddr, size);
          const dst = new Uint8Array(__privateMethod(this, _getInternalView, getInternalView_fn).call(this).buffer, dstAddr, size);
          dst.set(src);
        }
      },
      wasi_snapshot_preview1: {
        proc_exit: (_) => {
        },
        fd_seek: () => Result.ENOSYS,
        fd_write: () => Result.ENOSYS,
        fd_close: () => Result.ENOSYS
      }
    }));
    this.exports = __privateGet(this, _instance).exports;
    const start = __privateGet(this, _instance).exports._start;
    start();
    const data = new TextEncoder().encode(JSON.stringify({ preopens, fs }));
    const initialize_internal = __privateGet(this, _instance).exports.initialize_internal;
    initialize_internal(__privateMethod(this, _copyFrom, copyFrom_fn).call(this, data), data.byteLength);
  }
  initialize(hostMemory) {
    __privateSet(this, _hostMemory, hostMemory);
  }
};
_instance = /* @__PURE__ */ new WeakMap();
_hostMemory = /* @__PURE__ */ new WeakMap();
_getInternalView = /* @__PURE__ */ new WeakSet();
getInternalView_fn = function() {
  const memory = __privateGet(this, _instance).exports.memory;
  return new DataView(memory.buffer);
};
_copyFrom = /* @__PURE__ */ new WeakSet();
copyFrom_fn = function(src) {
  const dstAddr = __privateGet(this, _instance).exports.allocate(src.byteLength);
  new Uint8Array(__privateMethod(this, _getInternalView, getInternalView_fn).call(this).buffer, dstAddr, src.byteLength).set(src);
  return dstAddr;
};
var DATA_ADDR = 16;
var DATA_START = DATA_ADDR + 8;
var DATA_END = 1024;
var WRAPPED_EXPORTS = /* @__PURE__ */ new WeakMap();
var State = {
  None: 0,
  Unwinding: 1,
  Rewinding: 2
};
function isPromise(obj) {
  return !!obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function";
}
function proxyGet(obj, transform) {
  return new Proxy(obj, {
    get: (obj2, name) => transform(obj2[name])
  });
}
var Asyncify = class {
  constructor() {
    this.value = void 0;
    this.exports = null;
  }
  getState() {
    return this.exports.asyncify_get_state();
  }
  assertNoneState() {
    let state = this.getState();
    if (state !== State.None) {
      throw new Error(`Invalid async state ${state}, expected 0.`);
    }
  }
  wrapImportFn(fn) {
    return (...args) => {
      if (this.getState() === State.Rewinding) {
        this.exports.asyncify_stop_rewind();
        return this.value;
      }
      this.assertNoneState();
      let value = fn(...args);
      if (!isPromise(value)) {
        return value;
      }
      this.exports.asyncify_start_unwind(DATA_ADDR);
      this.value = value;
    };
  }
  wrapModuleImports(module) {
    return proxyGet(module, (value) => {
      if (typeof value === "function") {
        return this.wrapImportFn(value);
      }
      return value;
    });
  }
  wrapImports(imports) {
    if (imports === void 0)
      return;
    return proxyGet(imports, (moduleImports = /* @__PURE__ */ Object.create(null)) => this.wrapModuleImports(moduleImports));
  }
  wrapExportFn(fn) {
    let newExport = WRAPPED_EXPORTS.get(fn);
    if (newExport !== void 0) {
      return newExport;
    }
    newExport = async (...args) => {
      this.assertNoneState();
      let result = fn(...args);
      while (this.getState() === State.Unwinding) {
        this.exports.asyncify_stop_unwind();
        this.value = await this.value;
        this.assertNoneState();
        this.exports.asyncify_start_rewind(DATA_ADDR);
        result = fn();
      }
      this.assertNoneState();
      return result;
    };
    WRAPPED_EXPORTS.set(fn, newExport);
    return newExport;
  }
  wrapExports(exports) {
    let newExports = /* @__PURE__ */ Object.create(null);
    for (let exportName in exports) {
      let value = exports[exportName];
      if (typeof value === "function" && !exportName.startsWith("asyncify_")) {
        value = this.wrapExportFn(value);
      }
      Object.defineProperty(newExports, exportName, {
        enumerable: true,
        value
      });
    }
    WRAPPED_EXPORTS.set(exports, newExports);
    return newExports;
  }
  init(instance, imports) {
    const { exports } = instance;
    const memory = exports.memory || imports.env && imports.env.memory;
    new Int32Array(memory.buffer, DATA_ADDR).set([DATA_START, DATA_END]);
    this.exports = this.wrapExports(exports);
    Object.setPrototypeOf(instance, Instance.prototype);
  }
};
var Instance = class extends WebAssembly.Instance {
  constructor(module, imports) {
    let state = new Asyncify();
    super(module, state.wrapImports(imports));
    state.init(this, imports);
  }
  get exports() {
    return WRAPPED_EXPORTS.get(super.exports);
  }
};
Object.defineProperty(Instance.prototype, "exports", { enumerable: true });
var DevNull = class {
  writev(iovs) {
    return iovs.map((iov) => iov.byteLength).reduce((prev, curr) => prev + curr);
  }
  readv(iovs) {
    return 0;
  }
  close() {
  }
  async preRun() {
  }
  async postRun() {
  }
};
var ReadableStreamBase = class {
  writev(iovs) {
    throw new Error("Attempting to call write on a readable stream");
  }
  close() {
  }
  async preRun() {
  }
  async postRun() {
  }
};
var _pending;
var _reader;
var AsyncReadableStreamAdapter = class extends ReadableStreamBase {
  constructor(reader) {
    super();
    __privateAdd(this, _pending, new Uint8Array());
    __privateAdd(this, _reader, void 0);
    __privateSet(this, _reader, reader);
  }
  async readv(iovs) {
    let read = 0;
    for (let iov of iovs) {
      while (iov.byteLength > 0) {
        if (__privateGet(this, _pending).byteLength === 0) {
          const result = await __privateGet(this, _reader).read();
          if (result.done) {
            return read;
          }
          __privateSet(this, _pending, result.value);
        }
        const bytes = Math.min(iov.byteLength, __privateGet(this, _pending).byteLength);
        iov.set(__privateGet(this, _pending).subarray(0, bytes));
        __privateSet(this, _pending, __privateGet(this, _pending).subarray(bytes));
        read += bytes;
        iov = iov.subarray(bytes);
      }
    }
    return read;
  }
};
_pending = /* @__PURE__ */ new WeakMap();
_reader = /* @__PURE__ */ new WeakMap();
var WritableStreamBase = class {
  readv(iovs) {
    throw new Error("Attempting to call read on a writable stream");
  }
  close() {
  }
  async preRun() {
  }
  async postRun() {
  }
};
var _writer;
var AsyncWritableStreamAdapter = class extends WritableStreamBase {
  constructor(writer) {
    super();
    __privateAdd(this, _writer, void 0);
    __privateSet(this, _writer, writer);
  }
  async writev(iovs) {
    let written = 0;
    for (const iov of iovs) {
      if (iov.byteLength === 0) {
        continue;
      }
      await __privateGet(this, _writer).write(iov);
      written += iov.byteLength;
    }
    return written;
  }
  async close() {
    await __privateGet(this, _writer).close();
  }
};
_writer = /* @__PURE__ */ new WeakMap();
var _writer2;
var _buffer;
var _bytesWritten;
var SyncWritableStreamAdapter = class extends WritableStreamBase {
  constructor(writer) {
    super();
    __privateAdd(this, _writer2, void 0);
    __privateAdd(this, _buffer, new Uint8Array(4096));
    __privateAdd(this, _bytesWritten, 0);
    __privateSet(this, _writer2, writer);
  }
  writev(iovs) {
    let written = 0;
    for (const iov of iovs) {
      if (iov.byteLength === 0) {
        continue;
      }
      const requiredCapacity = __privateGet(this, _bytesWritten) + iov.byteLength;
      if (requiredCapacity > __privateGet(this, _buffer).byteLength) {
        let desiredCapacity = __privateGet(this, _buffer).byteLength;
        while (desiredCapacity < requiredCapacity) {
          desiredCapacity *= 1.5;
        }
        const oldBuffer = __privateGet(this, _buffer);
        __privateSet(this, _buffer, new Uint8Array(desiredCapacity));
        __privateGet(this, _buffer).set(oldBuffer);
      }
      __privateGet(this, _buffer).set(iov, __privateGet(this, _bytesWritten));
      written += iov.byteLength;
      __privateSet(this, _bytesWritten, __privateGet(this, _bytesWritten) + iov.byteLength);
    }
    return written;
  }
  async postRun() {
    const slice = __privateGet(this, _buffer).subarray(0, __privateGet(this, _bytesWritten));
    await __privateGet(this, _writer2).write(slice);
    await __privateGet(this, _writer2).close();
  }
};
_writer2 = /* @__PURE__ */ new WeakMap();
_buffer = /* @__PURE__ */ new WeakMap();
_bytesWritten = /* @__PURE__ */ new WeakMap();
var _buffer2;
var _reader2;
var SyncReadableStreamAdapter = class extends ReadableStreamBase {
  constructor(reader) {
    super();
    __privateAdd(this, _buffer2, void 0);
    __privateAdd(this, _reader2, void 0);
    __privateSet(this, _reader2, reader);
  }
  readv(iovs) {
    let read = 0;
    for (const iov of iovs) {
      const bytes = Math.min(iov.byteLength, __privateGet(this, _buffer2).byteLength);
      if (bytes <= 0) {
        break;
      }
      iov.set(__privateGet(this, _buffer2).subarray(0, bytes));
      __privateSet(this, _buffer2, __privateGet(this, _buffer2).subarray(bytes));
      read += bytes;
    }
    return read;
  }
  async preRun() {
    const pending = [];
    let length = 0;
    for (; ; ) {
      const result2 = await __privateGet(this, _reader2).read();
      if (result2.done) {
        break;
      }
      const data = result2.value;
      pending.push(data);
      length += data.length;
    }
    let result = new Uint8Array(length);
    let offset = 0;
    pending.forEach((item) => {
      result.set(item, offset);
      offset += item.length;
    });
    __privateSet(this, _buffer2, result);
  }
};
_buffer2 = /* @__PURE__ */ new WeakMap();
_reader2 = /* @__PURE__ */ new WeakMap();
var fromReadableStream = (stream, supportsAsync) => {
  if (!stream) {
    return new DevNull();
  }
  if (supportsAsync) {
    return new AsyncReadableStreamAdapter(stream.getReader());
  }
  return new SyncReadableStreamAdapter(stream.getReader());
};
var fromWritableStream = (stream, supportsAsync) => {
  if (!stream) {
    return new DevNull();
  }
  if (supportsAsync) {
    return new AsyncWritableStreamAdapter(stream.getWriter());
  }
  return new SyncWritableStreamAdapter(stream.getWriter());
};
var ProcessExit = class extends Error {
  constructor(code) {
    super(`proc_exit=${code}`);
    this.code = code;
    Object.setPrototypeOf(this, ProcessExit.prototype);
  }
};
var _args;
var _env;
var _memory;
var _preopens;
var _returnOnExit;
var _streams;
var _memfs;
var _state;
var _asyncify;
var _view;
var view_fn;
var _fillValues;
var fillValues_fn;
var _fillSizes;
var fillSizes_fn;
var _args_get;
var args_get_fn;
var _args_sizes_get;
var args_sizes_get_fn;
var _clock_res_get;
var clock_res_get_fn;
var _clock_time_get;
var clock_time_get_fn;
var _environ_get;
var environ_get_fn;
var _environ_sizes_get;
var environ_sizes_get_fn;
var _fd_read;
var fd_read_fn;
var _fd_write;
var fd_write_fn;
var _poll_oneoff;
var poll_oneoff_fn;
var _proc_exit;
var proc_exit_fn;
var _proc_raise;
var proc_raise_fn;
var _random_get;
var random_get_fn;
var _sched_yield;
var sched_yield_fn;
var _sock_recv;
var sock_recv_fn;
var _sock_send;
var sock_send_fn;
var _sock_shutdown;
var sock_shutdown_fn;
var WASI = class {
  constructor(options) {
    __privateAdd(this, _view);
    __privateAdd(this, _fillValues);
    __privateAdd(this, _fillSizes);
    __privateAdd(this, _args_get);
    __privateAdd(this, _args_sizes_get);
    __privateAdd(this, _clock_res_get);
    __privateAdd(this, _clock_time_get);
    __privateAdd(this, _environ_get);
    __privateAdd(this, _environ_sizes_get);
    __privateAdd(this, _fd_read);
    __privateAdd(this, _fd_write);
    __privateAdd(this, _poll_oneoff);
    __privateAdd(this, _proc_exit);
    __privateAdd(this, _proc_raise);
    __privateAdd(this, _random_get);
    __privateAdd(this, _sched_yield);
    __privateAdd(this, _sock_recv);
    __privateAdd(this, _sock_send);
    __privateAdd(this, _sock_shutdown);
    __privateAdd(this, _args, void 0);
    __privateAdd(this, _env, void 0);
    __privateAdd(this, _memory, void 0);
    __privateAdd(this, _preopens, void 0);
    __privateAdd(this, _returnOnExit, void 0);
    __privateAdd(this, _streams, void 0);
    __privateAdd(this, _memfs, void 0);
    __privateAdd(this, _state, new Asyncify());
    __privateAdd(this, _asyncify, void 0);
    __privateSet(this, _args, options?.args ?? []);
    const env = options?.env ?? {};
    __privateSet(this, _env, Object.keys(env).map((key) => {
      return `${key}=${env[key]}`;
    }));
    __privateSet(this, _returnOnExit, options?.returnOnExit ?? false);
    __privateSet(this, _preopens, options?.preopens ?? []);
    __privateSet(this, _asyncify, options?.streamStdio ?? false);
    __privateSet(this, _streams, [
      fromReadableStream(options?.stdin, __privateGet(this, _asyncify)),
      fromWritableStream(options?.stdout, __privateGet(this, _asyncify)),
      fromWritableStream(options?.stderr, __privateGet(this, _asyncify))
    ]);
    __privateSet(this, _memfs, new MemFS(__privateGet(this, _preopens), options?.fs ?? {}));
  }
  async start(instance) {
    __privateSet(this, _memory, instance.exports.memory);
    __privateGet(this, _memfs).initialize(__privateGet(this, _memory));
    try {
      if (__privateGet(this, _asyncify)) {
        if (!instance.exports.asyncify_get_state) {
          throw new Error("streamStdio is requested but the module is missing 'Asyncify' exports, see https://github.com/GoogleChromeLabs/asyncify");
        }
        __privateGet(this, _state).init(instance);
      }
      await Promise.all(__privateGet(this, _streams).map((s) => s.preRun()));
      if (__privateGet(this, _asyncify)) {
        await __privateGet(this, _state).exports._start();
      } else {
        const entrypoint = instance.exports._start;
        entrypoint();
      }
    } catch (e) {
      if (!__privateGet(this, _returnOnExit)) {
        throw e;
      }
      if (e.message === "unreachable") {
        return 134;
      } else if (e instanceof ProcessExit) {
        return e.code;
      } else {
        throw e;
      }
    } finally {
      await Promise.all(__privateGet(this, _streams).map((s) => s.close()));
      await Promise.all(__privateGet(this, _streams).map((s) => s.postRun()));
    }
    return void 0;
  }
  get wasiImport() {
    const wrap = (f, self = this) => {
      const bound = f.bind(self);
      if (__privateGet(this, _asyncify)) {
        return __privateGet(this, _state).wrapImportFn(bound);
      }
      return bound;
    };
    return {
      args_get: wrap(__privateMethod(this, _args_get, args_get_fn)),
      args_sizes_get: wrap(__privateMethod(this, _args_sizes_get, args_sizes_get_fn)),
      clock_res_get: wrap(__privateMethod(this, _clock_res_get, clock_res_get_fn)),
      clock_time_get: wrap(__privateMethod(this, _clock_time_get, clock_time_get_fn)),
      environ_get: wrap(__privateMethod(this, _environ_get, environ_get_fn)),
      environ_sizes_get: wrap(__privateMethod(this, _environ_sizes_get, environ_sizes_get_fn)),
      fd_advise: wrap(__privateGet(this, _memfs).exports.fd_advise),
      fd_allocate: wrap(__privateGet(this, _memfs).exports.fd_allocate),
      fd_close: wrap(__privateGet(this, _memfs).exports.fd_close),
      fd_datasync: wrap(__privateGet(this, _memfs).exports.fd_datasync),
      fd_fdstat_get: wrap(__privateGet(this, _memfs).exports.fd_fdstat_get),
      fd_fdstat_set_flags: wrap(__privateGet(this, _memfs).exports.fd_fdstat_set_flags),
      fd_fdstat_set_rights: wrap(__privateGet(this, _memfs).exports.fd_fdstat_set_rights),
      fd_filestat_get: wrap(__privateGet(this, _memfs).exports.fd_filestat_get),
      fd_filestat_set_size: wrap(__privateGet(this, _memfs).exports.fd_filestat_set_size),
      fd_filestat_set_times: wrap(__privateGet(this, _memfs).exports.fd_filestat_set_times),
      fd_pread: wrap(__privateGet(this, _memfs).exports.fd_pread),
      fd_prestat_dir_name: wrap(__privateGet(this, _memfs).exports.fd_prestat_dir_name),
      fd_prestat_get: wrap(__privateGet(this, _memfs).exports.fd_prestat_get),
      fd_pwrite: wrap(__privateGet(this, _memfs).exports.fd_pwrite),
      fd_read: wrap(__privateMethod(this, _fd_read, fd_read_fn)),
      fd_readdir: wrap(__privateGet(this, _memfs).exports.fd_readdir),
      fd_renumber: wrap(__privateGet(this, _memfs).exports.fd_renumber),
      fd_seek: wrap(__privateGet(this, _memfs).exports.fd_seek),
      fd_sync: wrap(__privateGet(this, _memfs).exports.fd_sync),
      fd_tell: wrap(__privateGet(this, _memfs).exports.fd_tell),
      fd_write: wrap(__privateMethod(this, _fd_write, fd_write_fn)),
      path_create_directory: wrap(__privateGet(this, _memfs).exports.path_create_directory),
      path_filestat_get: wrap(__privateGet(this, _memfs).exports.path_filestat_get),
      path_filestat_set_times: wrap(__privateGet(this, _memfs).exports.path_filestat_set_times),
      path_link: wrap(__privateGet(this, _memfs).exports.path_link),
      path_open: wrap(__privateGet(this, _memfs).exports.path_open),
      path_readlink: wrap(__privateGet(this, _memfs).exports.path_readlink),
      path_remove_directory: wrap(__privateGet(this, _memfs).exports.path_remove_directory),
      path_rename: wrap(__privateGet(this, _memfs).exports.path_rename),
      path_symlink: wrap(__privateGet(this, _memfs).exports.path_symlink),
      path_unlink_file: wrap(__privateGet(this, _memfs).exports.path_unlink_file),
      poll_oneoff: wrap(__privateMethod(this, _poll_oneoff, poll_oneoff_fn)),
      proc_exit: wrap(__privateMethod(this, _proc_exit, proc_exit_fn)),
      proc_raise: wrap(__privateMethod(this, _proc_raise, proc_raise_fn)),
      random_get: wrap(__privateMethod(this, _random_get, random_get_fn)),
      sched_yield: wrap(__privateMethod(this, _sched_yield, sched_yield_fn)),
      sock_recv: wrap(__privateMethod(this, _sock_recv, sock_recv_fn)),
      sock_send: wrap(__privateMethod(this, _sock_send, sock_send_fn)),
      sock_shutdown: wrap(__privateMethod(this, _sock_shutdown, sock_shutdown_fn))
    };
  }
};
_args = /* @__PURE__ */ new WeakMap();
_env = /* @__PURE__ */ new WeakMap();
_memory = /* @__PURE__ */ new WeakMap();
_preopens = /* @__PURE__ */ new WeakMap();
_returnOnExit = /* @__PURE__ */ new WeakMap();
_streams = /* @__PURE__ */ new WeakMap();
_memfs = /* @__PURE__ */ new WeakMap();
_state = /* @__PURE__ */ new WeakMap();
_asyncify = /* @__PURE__ */ new WeakMap();
_view = /* @__PURE__ */ new WeakSet();
view_fn = function() {
  if (!__privateGet(this, _memory)) {
    throw new Error("this.memory not set");
  }
  return new DataView(__privateGet(this, _memory).buffer);
};
_fillValues = /* @__PURE__ */ new WeakSet();
fillValues_fn = function(values, iter_ptr_ptr, buf_ptr) {
  const encoder = new TextEncoder();
  const buffer = new Uint8Array(__privateGet(this, _memory).buffer);
  const view = __privateMethod(this, _view, view_fn).call(this);
  for (const value of values) {
    view.setUint32(iter_ptr_ptr, buf_ptr, true);
    iter_ptr_ptr += 4;
    const data = encoder.encode(`${value}\0`);
    buffer.set(data, buf_ptr);
    buf_ptr += data.length;
  }
  return Result.SUCCESS;
};
_fillSizes = /* @__PURE__ */ new WeakSet();
fillSizes_fn = function(values, count_ptr, buffer_size_ptr) {
  const view = __privateMethod(this, _view, view_fn).call(this);
  const encoder = new TextEncoder();
  const len = values.reduce((acc, value) => {
    return acc + encoder.encode(`${value}\0`).length;
  }, 0);
  view.setUint32(count_ptr, values.length, true);
  view.setUint32(buffer_size_ptr, len, true);
  return Result.SUCCESS;
};
_args_get = /* @__PURE__ */ new WeakSet();
args_get_fn = function(argv_ptr_ptr, argv_buf_ptr) {
  return __privateMethod(this, _fillValues, fillValues_fn).call(this, __privateGet(this, _args), argv_ptr_ptr, argv_buf_ptr);
};
_args_sizes_get = /* @__PURE__ */ new WeakSet();
args_sizes_get_fn = function(argc_ptr, argv_buf_size_ptr) {
  return __privateMethod(this, _fillSizes, fillSizes_fn).call(this, __privateGet(this, _args), argc_ptr, argv_buf_size_ptr);
};
_clock_res_get = /* @__PURE__ */ new WeakSet();
clock_res_get_fn = function(id, retptr0) {
  switch (id) {
    case Clock.REALTIME:
    case Clock.MONOTONIC:
    case Clock.PROCESS_CPUTIME_ID:
    case Clock.THREAD_CPUTIME_ID: {
      const view = __privateMethod(this, _view, view_fn).call(this);
      view.setBigUint64(retptr0, BigInt(1e6), true);
      return Result.SUCCESS;
    }
  }
  return Result.EINVAL;
};
_clock_time_get = /* @__PURE__ */ new WeakSet();
clock_time_get_fn = function(id, precision, retptr0) {
  switch (id) {
    case Clock.REALTIME:
    case Clock.MONOTONIC:
    case Clock.PROCESS_CPUTIME_ID:
    case Clock.THREAD_CPUTIME_ID: {
      const view = __privateMethod(this, _view, view_fn).call(this);
      view.setBigUint64(retptr0, BigInt(Date.now()) * BigInt(1e6), true);
      return Result.SUCCESS;
    }
  }
  return Result.EINVAL;
};
_environ_get = /* @__PURE__ */ new WeakSet();
environ_get_fn = function(env_ptr_ptr, env_buf_ptr) {
  return __privateMethod(this, _fillValues, fillValues_fn).call(this, __privateGet(this, _env), env_ptr_ptr, env_buf_ptr);
};
_environ_sizes_get = /* @__PURE__ */ new WeakSet();
environ_sizes_get_fn = function(env_ptr, env_buf_size_ptr) {
  return __privateMethod(this, _fillSizes, fillSizes_fn).call(this, __privateGet(this, _env), env_ptr, env_buf_size_ptr);
};
_fd_read = /* @__PURE__ */ new WeakSet();
fd_read_fn = function(fd, iovs_ptr, iovs_len, retptr0) {
  if (fd < 3) {
    const desc = __privateGet(this, _streams)[fd];
    const view = __privateMethod(this, _view, view_fn).call(this);
    const iovs = iovViews(view, iovs_ptr, iovs_len);
    const result = desc.readv(iovs);
    if (typeof result === "number") {
      view.setUint32(retptr0, result, true);
      return Result.SUCCESS;
    }
    const promise = result;
    return promise.then((read) => {
      view.setUint32(retptr0, read, true);
      return Result.SUCCESS;
    });
  }
  return __privateGet(this, _memfs).exports.fd_read(fd, iovs_ptr, iovs_len, retptr0);
};
_fd_write = /* @__PURE__ */ new WeakSet();
fd_write_fn = function(fd, ciovs_ptr, ciovs_len, retptr0) {
  if (fd < 3) {
    const desc = __privateGet(this, _streams)[fd];
    const view = __privateMethod(this, _view, view_fn).call(this);
    const iovs = iovViews(view, ciovs_ptr, ciovs_len);
    const result = desc.writev(iovs);
    if (typeof result === "number") {
      view.setUint32(retptr0, result, true);
      return Result.SUCCESS;
    }
    let promise = result;
    return promise.then((written) => {
      view.setUint32(retptr0, written, true);
      return Result.SUCCESS;
    });
  }
  return __privateGet(this, _memfs).exports.fd_write(fd, ciovs_ptr, ciovs_len, retptr0);
};
_poll_oneoff = /* @__PURE__ */ new WeakSet();
poll_oneoff_fn = function(in_ptr, out_ptr, nsubscriptions, retptr0) {
  return Result.ENOSYS;
};
_proc_exit = /* @__PURE__ */ new WeakSet();
proc_exit_fn = function(code) {
  throw new ProcessExit(code);
};
_proc_raise = /* @__PURE__ */ new WeakSet();
proc_raise_fn = function(signal) {
  return Result.ENOSYS;
};
_random_get = /* @__PURE__ */ new WeakSet();
random_get_fn = function(buffer_ptr, buffer_len) {
  const buffer = new Uint8Array(__privateGet(this, _memory).buffer, buffer_ptr, buffer_len);
  crypto.getRandomValues(buffer);
  return Result.SUCCESS;
};
_sched_yield = /* @__PURE__ */ new WeakSet();
sched_yield_fn = function() {
  return Result.SUCCESS;
};
_sock_recv = /* @__PURE__ */ new WeakSet();
sock_recv_fn = function(fd, ri_data_ptr, ri_data_len, ri_flags, retptr0, retptr1) {
  return Result.ENOSYS;
};
_sock_send = /* @__PURE__ */ new WeakSet();
sock_send_fn = function(fd, si_data_ptr, si_data_len, si_flags, retptr0) {
  return Result.ENOSYS;
};
_sock_shutdown = /* @__PURE__ */ new WeakSet();
sock_shutdown_fn = function(fd, how) {
  return Result.ENOSYS;
};

// src/index.js
import demoWasm from "./24526702f6c3ed7fb02b15125f614dd38804525f-demo.wasm";
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
//# sourceMappingURL=index.js.map
