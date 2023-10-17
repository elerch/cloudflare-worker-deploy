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
    // TODO: We need to break index.js into the wrangler-generated bundling thing
    //       and the actual code we're using to run the wasm file.
    //       We might actually want a "run this wasm" upload vs a "these are my
    //       js files" upload. But for now we'll optimize for wasm
    const index = @embedFile("index.js");
    const wasm = @embedFile("demo.wasm");
    const memfs = @embedFile("dist/memfs.wasm");
    const accountid = @embedFile("accountid.txt");
    const worker_name = @embedFile("worker_name.txt");
    const deploy_request = @embedFile("deploy_request.txt");
    _ = deploy_request;
    const put_script = "https://api.cloudflare.com/client/v4/accounts/{s}/workers/scripts/{s}?include_subdomain_availability=true&excludeScript=true";
    _ = put_script;
    const get_subdomain = "https://api.cloudflare.com/client/v4/accounts/{s}/workers/scripts/{s}/subdomain";
    _ = get_subdomain;

    // stdout is for the actual output of your application, for example if you
    // are implementing gzip, then only the compressed bytes should be sent to
    // stdout, not any debugging messages.
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print("Index bytes: {d}\n", .{index.len});
    try stdout.print("Wasm bytes: {d}\n", .{wasm.len});
    try stdout.print("Memfs bytes: {d}\n", .{memfs.len});
    try stdout.print("Account: {s}\n", .{accountid});
    try stdout.print("Worker name: {s}\n", .{worker_name});

    const worker_exists = try workerExists(allocator, &client, accountid, worker_name);
    try stdout.print(
        "Worker exists: {}\n",
        .{worker_exists},
    );
    try bw.flush(); // don't forget to flush!
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
