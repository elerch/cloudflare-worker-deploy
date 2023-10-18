const std = @import("std");

var x_auth_email: [:0]const u8 = undefined;
var x_auth_key: [:0]const u8 = undefined;

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var client = std.http.Client{ .allocator = allocator };

    x_auth_email = std.os.getenv("CF_X_AUTH_EMAIL").?;
    x_auth_key = std.os.getenv("CF_X_AUTH_KEY").?;
    // TODO: All this stuff needs to be different
    //
    const accountid = @embedFile("accountid.txt");
    const worker_name = @embedFile("worker_name.txt");
    const get_subdomain = "https://api.cloudflare.com/client/v4/accounts/{s}/workers/scripts/{s}/subdomain";
    _ = get_subdomain;

    // stdout is for the actual output of your application, for example if you
    // are implementing gzip, then only the compressed bytes should be sent to
    // stdout, not any debugging messages.
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print("Account: {s}\n", .{accountid});
    try stdout.print("Worker name: {s}\n", .{worker_name});

    // Determine if worker exists. This lets us know if we need to enable it later
    const worker_exists = try workerExists(allocator, &client, accountid, worker_name);
    try stdout.print(
        "Worker exists: {}\n",
        .{worker_exists},
    );

    try putNewWorker(allocator, &client, accountid, worker_name);
    try bw.flush(); // don't forget to flush!
}
fn putNewWorker(allocator: std.mem.Allocator, client: *std.http.Client, account_id: []const u8, name: []const u8) !void {
    const put_script = "https://api.cloudflare.com/client/v4/accounts/{s}/workers/scripts/{s}?include_subdomain_availability=true&excludeScript=true";
    const url = try std.fmt.allocPrint(allocator, put_script, .{ account_id, name });
    defer allocator.free(url);
    // TODO: All this stuff needs to be different
    //
    // TODO: We need to break index.js into the wrangler-generated bundling thing
    //       and the actual code we're using to run the wasm file.
    //       We might actually want a "run this wasm" upload vs a "these are my
    //       js files" upload. But for now we'll optimize for wasm
    const script = @embedFile("index.js");
    const wasm = @embedFile("demo.wasm");
    const memfs = @embedFile("dist/memfs.wasm");
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
        "Content-Disposition: form-data; name=\"./24526702f6c3ed7fb02b15125f614dd38804525f-demo.wasm\"; filename=\"./24526702f6c3ed7fb02b15125f614dd38804525f-demo.wasm\"\r\n" ++
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
    try headers.append("X-Auth-Email", x_auth_email);
    try headers.append("X-Auth-Key", x_auth_key);
    // TODO: fix this
    try headers.append("Content-Type", "multipart/form-data; boundary=----formdata-undici-032998177938");
    const request_payload = try std.fmt.allocPrint(allocator, deploy_request, .{
        .script = script,
        .wasm = wasm,
        .memfs = memfs,
    });
    defer allocator.free(request_payload);
    // Get content length. For some reason it's forcing a chunked transfer type without this.
    // That's not entirely a bad idea, but for now I want to match what I see
    // coming through wrangler
    const cl = try std.fmt.allocPrint(allocator, "{d}", .{request_payload.len});
    defer allocator.free(cl);
    try headers.append("Content-Length", cl);
    std.debug.print("payload length {d}\n", .{request_payload.len});
    const blah1 = "------formdata-undici-032998177938\r\nC";
    std.debug.print("first 80 bytes {s}", .{request_payload[0..80]});
    std.debug.print("Starts with? {}", .{std.mem.startsWith(u8, request_payload, blah1)});
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
        return error.RequestFailed;
    }
}

fn workerExists(allocator: std.mem.Allocator, client: *std.http.Client, account_id: []const u8, name: []const u8) !bool {
    const existence_check = "https://api.cloudflare.com/client/v4/accounts/{s}/workers/services/{s}";
    const url = try std.fmt.allocPrint(allocator, existence_check, .{ account_id, name });
    defer allocator.free(url);
    var headers = std.http.Headers.init(allocator);
    defer headers.deinit();
    try headers.append("X-Auth-Email", x_auth_email);
    try headers.append("X-Auth-Key", x_auth_key);
    var req = try client.request(.GET, try std.Uri.parse(url), headers, .{});
    defer req.deinit();
    try req.start();
    try req.wait();
    // std.debug.print("Status is {}\n", .{req.response.status});
    // std.debug.print("Url is {s}\n", .{url});
    return req.response.status == .ok;
}

test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
