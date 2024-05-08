const std = @import("std");
const cloudflare = @import("cloudflare.zig");

pub fn main() !u8 {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();
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
    const maybe_name = argIterator.next();
    if (maybe_name == null) {
        try usage(std.io.getStdErr().writer(), exe_name);
        return 1;
    }
    const worker_name = maybe_name.?;
    if (std.mem.eql(u8, worker_name, "-h")) {
        try usage(stdout, exe_name);
        return 0;
    }
    const maybe_script_name = argIterator.next();
    if (maybe_script_name == null) {
        try usage(std.io.getStdErr().writer(), exe_name);
        return 1;
    }
    const script = std.fs.cwd().readFileAlloc(allocator, maybe_script_name.?, std.math.maxInt(usize)) catch |err| {
        try usage(std.io.getStdErr().writer(), exe_name);
        return err;
    };

    cloudflare.pushWorker(allocator, &client, worker_name, script, ".", stdout, std.io.getStdErr().writer()) catch return 1;
    try bw.flush(); // don't forget to flush!
    return 0;
}

fn usage(writer: anytype, this: []const u8) !void {
    try writer.print("usage: {s} <worker name> <script file>\n", .{this});
}

test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
