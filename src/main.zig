const std = @import("std");

var x_auth_email: [:0]const u8 = undefined;
var x_auth_key: [:0]const u8 = undefined;
var initialized = false;

const cf_api_base = "https://api.cloudflare.com/client/v4";

pub fn main() !u8 {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var client = std.http.Client{ .allocator = allocator };
    //     .allocator = allocator,
    //     .proxy = .{
    //         .protocol = .plain,
    //         .host = "localhost",
    //         .port = 8080,
    //     },
    // };

    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    var argIterator = try std.process.argsWithAllocator(allocator);
    defer argIterator.deinit();
    const exe_name = argIterator.next().?;
    var maybe_name = argIterator.next();
    if (maybe_name == null) {
        try usage(std.io.getStdErr().writer(), exe_name);
        return 1;
    }
    const worker_name = maybe_name.?;
    if (std.mem.eql(u8, worker_name, "-h")) {
        try usage(stdout, exe_name);
        return 0;
    }
    var maybe_script_name = argIterator.next();
    if (maybe_script_name == null) {
        try usage(std.io.getStdErr().writer(), exe_name);
        return 1;
    }
    const script = std.fs.cwd().readFileAlloc(allocator, maybe_script_name.?, std.math.maxInt(usize)) catch |err| {
        try usage(std.io.getStdErr().writer(), exe_name);
        return err;
    };

    pushWorker(allocator, &client, worker_name, script, stdout, std.io.getStdErr().writer()) catch return 1;
    try bw.flush(); // don't forget to flush!
    return 0;
}

fn usage(writer: anytype, this: []const u8) !void {
    try writer.print("usage: {s} <worker name> <script file>\n", .{this});
}
const Wasm = struct {
    allocator: std.mem.Allocator,
    name: []const u8,
    data: []const u8,

    const Self = @This();

    pub fn deinit(self: *Self) void {
        self.allocator.free(self.name);
        self.allocator.free(self.data);
    }
};

fn pushWorker(
    allocator: std.mem.Allocator,
    client: *std.http.Client,
    worker_name: []const u8,
    script: []const u8,
    writer: anytype,
    err_writer: anytype,
) !void {
    var wasm = try loadWasm(allocator, script);
    defer wasm.deinit();

    var accountid = std.os.getenv("CLOUDFLARE_ACCOUNT_ID");
    const account_id_free = accountid == null;
    if (accountid == null) accountid = try getAccountId(allocator, client);
    defer if (account_id_free) allocator.free(accountid.?);

    try writer.print("Using Cloudflare account: {s}\n", .{accountid.?});

    // Determine if worker exists. This lets us know if we need to enable it later
    const worker_exists = try workerExists(allocator, client, accountid.?, worker_name);
    try writer.print(
        "{s}\n",
        .{if (worker_exists) "Worker exists, will not re-enable" else "Worker is new. Will enable after code update"},
    );

    var worker = Worker{
        .account_id = accountid.?,
        .name = worker_name,
        .wasm = wasm,
        .main_module = script,
    };
    putNewWorker(allocator, client, &worker) catch |err| {
        if (worker.errors == null) return err;
        try err_writer.print("{d} errors returned from CloudFlare:\n\n", .{worker.errors.?.len});
        for (worker.errors.?) |cf_err| {
            try err_writer.print("{s}\n", .{cf_err});
            allocator.free(cf_err);
        }
        return error.CloudFlareErrorResponse;
    };
    const subdomain = try getSubdomain(allocator, client, accountid.?);
    defer allocator.free(subdomain);
    try writer.print("Worker available at: https://{s}.{s}.workers.dev/\n", .{ worker_name, subdomain });
    if (!worker_exists)
        try enableWorker(allocator, client, accountid.?, worker_name);
}

fn loadWasm(allocator: std.mem.Allocator, script: []const u8) !Wasm {
    // Looking for a string like this: import demoWasm from "demo.wasm"
    // JavaScript may or may not have ; characters. We're not doing
    // a full JS parsing here, so this may not be the most robust

    var inx: usize = 0;

    var name: ?[]const u8 = null;
    while (true) {
        inx = std.mem.indexOf(u8, script[inx..], "import ") orelse if (inx == 0) return error.NoImportFound else break;
        inx += "import ".len;

        // oh god, we're not doing this: https://262.ecma-international.org/5.1/#sec-7.5
        // advance to next token - we don't care what the name is
        while (inx < script.len and script[inx] != ' ') inx += 1;
        // continue past space(s)
        while (inx < script.len and script[inx] == ' ') inx += 1;
        // We expect "from " to be next
        if (!std.mem.startsWith(u8, script[inx..], "from ")) continue;
        inx += "from ".len;
        // continue past space(s)
        while (inx < script.len and script[inx] == ' ') inx += 1;
        // We now expect the name of our file...
        if (script[inx] != '"' and script[inx] != '\'') continue; // we're not where we think we are
        const quote = script[inx]; // there are two possibilities here
        // we don't need to advance inx any more, as we're on the name, and if
        // we loop, that's ok
        inx += 1; // move off the quote onto the name
        const end_quote_inx = std.mem.indexOfScalar(u8, script[inx..], quote);
        if (end_quote_inx == null) continue;
        const candidate_name = script[inx .. inx + end_quote_inx.?];
        if (std.mem.endsWith(u8, candidate_name, ".wasm")) {
            if (name != null) // we are importing two wasm files, and we are now lost
                return error.MultipleWasmImportsUnsupported;
            name = candidate_name;
        }
    }
    if (name == null) return error.NoWasmImportFound;

    const nm = try allocator.dupe(u8, name.?);
    errdefer allocator.free(nm);
    const data = try std.fs.cwd().readFileAlloc(allocator, nm, std.math.maxInt(usize));
    return Wasm{
        .allocator = allocator,
        .name = nm,
        .data = data,
    };
}

fn getAccountId(allocator: std.mem.Allocator, client: *std.http.Client) ![:0]const u8 {
    const url = cf_api_base ++ "/accounts/";
    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try addAuthHeaders(&headers);
    var req = try client.request(.GET, try std.Uri.parse(url), headers, .{});
    defer req.deinit();
    try req.start();
    try req.wait();
    if (req.response.status != .ok) {
        std.debug.print("Status is {}\n", .{req.response.status});
        return error.RequestFailed;
    }
    var json_reader = std.json.reader(allocator, req.reader());
    defer json_reader.deinit();
    var body = try std.json.parseFromTokenSource(std.json.Value, allocator, &json_reader, .{});
    defer body.deinit();
    const arr = body.value.object.get("result").?.array.items;
    if (arr.len == 0) return error.NoAccounts;
    if (arr.len > 1) return error.TooManyAccounts;
    return try allocator.dupeZ(u8, arr[0].object.get("id").?.string);
}

fn enableWorker(allocator: std.mem.Allocator, client: *std.http.Client, account_id: []const u8, name: []const u8) !void {
    const enable_script = cf_api_base ++ "/accounts/{s}/workers/scripts/{s}/subdomain";
    const url = try std.fmt.allocPrint(allocator, enable_script, .{ account_id, name });
    defer allocator.free(url);
    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try addAuthHeaders(&headers);
    try headers.append("Content-Type", "application/json; charset=UTF-8");
    var req = try client.request(.POST, try std.Uri.parse(url), headers, .{});
    defer req.deinit();

    const request_payload =
        \\{ "enabled": true }
    ;
    req.transfer_encoding = .{ .content_length = @as(u64, request_payload.len) };
    try req.start();
    try req.writeAll(request_payload);
    try req.finish();
    try req.wait();
    if (req.response.status != .ok) {
        std.debug.print("Status is {}\n", .{req.response.status});
        return error.RequestFailed;
    }
}

/// Gets the subdomain for a worker. Caller owns memory
fn getSubdomain(allocator: std.mem.Allocator, client: *std.http.Client, account_id: []const u8) ![]const u8 {
    const get_subdomain = cf_api_base ++ "/accounts/{s}/workers/subdomain";
    const url = try std.fmt.allocPrint(allocator, get_subdomain, .{account_id});
    defer allocator.free(url);

    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try addAuthHeaders(&headers);
    var req = try client.request(.GET, try std.Uri.parse(url), headers, .{});
    defer req.deinit();
    try req.start();
    try req.wait();
    if (req.response.status != .ok) return error.RequestNotOk;
    var json_reader = std.json.reader(allocator, req.reader());
    defer json_reader.deinit();
    var body = try std.json.parseFromTokenSource(std.json.Value, allocator, &json_reader, .{});
    defer body.deinit();
    return try allocator.dupe(u8, body.value.object.get("result").?.object.get("subdomain").?.string);
}

const Worker = struct {
    account_id: []const u8,
    name: []const u8,
    main_module: []const u8,
    wasm: Wasm,
    errors: ?[][]const u8 = null,
};
fn putNewWorker(allocator: std.mem.Allocator, client: *std.http.Client, worker: *Worker) !void {
    const put_script = cf_api_base ++ "/accounts/{s}/workers/scripts/{s}?include_subdomain_availability=true&excludeScript=true";
    const url = try std.fmt.allocPrint(allocator, put_script, .{ worker.account_id, worker.name });
    defer allocator.free(url);
    const memfs = @embedFile("dist/memfs.wasm");
    const outer_script_shell = @embedFile("script_harness.js");
    const script = try std.fmt.allocPrint(allocator, "{s}{s}", .{ outer_script_shell, worker.main_module });
    defer allocator.free(script);
    const deploy_request =
        "------formdata-undici-032998177938\r\n" ++
        "Content-Disposition: form-data; name=\"metadata\"\r\n\r\n" ++
        "{{\"main_module\":\"index.js\",\"bindings\":[],\"compatibility_date\":\"2023-10-02\",\"compatibility_flags\":[]}}\r\n" ++
        "------formdata-undici-032998177938\r\n" ++
        "Content-Disposition: form-data; name=\"index.js\"; filename=\"index.js\"\r\n" ++
        "Content-Type: application/javascript+module\r\n" ++
        "\r\n" ++
        "{[script]s}\r\n" ++
        "------formdata-undici-032998177938\r\n" ++
        "Content-Disposition: form-data; name=\"./{[wasm_name]s}\"; filename=\"./{[wasm_name]s}\"\r\n" ++
        "Content-Type: application/wasm\r\n" ++
        "\r\n" ++
        "{[wasm]s}\r\n" ++
        "------formdata-undici-032998177938\r\n" ++
        "Content-Disposition: form-data; name=\"./c5f1acc97ad09df861eff9ef567c2186d4e38de3-memfs.wasm\"; filename=\"./c5f1acc97ad09df861eff9ef567c2186d4e38de3-memfs.wasm\"\r\n" ++
        "Content-Type: application/wasm\r\n" ++
        "\r\n" ++
        "{[memfs]s}\r\n" ++
        "------formdata-undici-032998177938--";

    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try addAuthHeaders(&headers);
    // TODO: fix this
    try headers.append("Content-Type", "multipart/form-data; boundary=----formdata-undici-032998177938");
    const request_payload = try std.fmt.allocPrint(allocator, deploy_request, .{
        .script = script,
        .wasm_name = worker.wasm.name,
        .wasm = worker.wasm.data,
        .memfs = memfs,
    });
    defer allocator.free(request_payload);
    // Get content length. For some reason it's forcing a chunked transfer type without this.
    // That's not entirely a bad idea, but for now I want to match what I see
    // coming through wrangler
    const cl = try std.fmt.allocPrint(allocator, "{d}", .{request_payload.len});
    defer allocator.free(cl);
    try headers.append("Content-Length", cl);
    var req = try client.request(.PUT, try std.Uri.parse(url), headers, .{});
    defer req.deinit();

    req.transfer_encoding = .{ .content_length = @as(u64, request_payload.len) };
    try req.start();
    try req.writeAll(request_payload);
    try req.finish();
    try req.wait();
    // std.debug.print("Status is {}\n", .{req.response.status});
    // std.debug.print("Url is {s}\n", .{url});
    if (req.response.status != .ok) {
        std.debug.print("Status is {}\n", .{req.response.status});
        if (req.response.status == .bad_request)
            worker.errors = getErrors(allocator, &req) catch null;
        return error.RequestFailed;
    }
}

fn getErrors(allocator: std.mem.Allocator, req: *std.http.Client.Request) !?[][]const u8 {
    var json_reader = std.json.reader(allocator, req.reader());
    defer json_reader.deinit();
    var body = try std.json.parseFromTokenSource(std.json.Value, allocator, &json_reader, .{});
    defer body.deinit();
    const arr = body.value.object.get("errors").?.array.items;
    if (arr.len == 0) return null;
    var error_list = try std.ArrayList([]const u8).initCapacity(allocator, arr.len);
    defer error_list.deinit();
    for (arr) |item| {
        error_list.appendAssumeCapacity(item.object.get("message").?.string);
    }
    return try error_list.toOwnedSlice();
}

fn workerExists(allocator: std.mem.Allocator, client: *std.http.Client, account_id: []const u8, name: []const u8) !bool {
    const existence_check = cf_api_base ++ "/accounts/{s}/workers/services/{s}";
    const url = try std.fmt.allocPrint(allocator, existence_check, .{ account_id, name });
    defer allocator.free(url);
    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try addAuthHeaders(&headers);
    var req = try client.request(.GET, try std.Uri.parse(url), headers, .{});
    defer req.deinit();
    try req.start();
    try req.wait();
    // std.debug.print("Status is {}\n", .{req.response.status});
    // std.debug.print("Url is {s}\n", .{url});
    return req.response.status == .ok;
}

fn addAuthHeaders(headers: *std.http.Headers) !void {
    if (!initialized) {
        x_auth_email = std.os.getenv("CF_X_AUTH_EMAIL").?;
        x_auth_key = std.os.getenv("CF_X_AUTH_KEY").?;
        initialized = true;
    }
    try headers.append("X-Auth-Email", x_auth_email);
    try headers.append("X-Auth-Key", x_auth_key);
}
test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
