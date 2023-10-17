const std = @import("std");

// TODO: All this stuff needs to be different
const index = @embedFile("index.js");
const wasm = @embedFile("demo.wasm");
const accountid = @embedFile("accountid.txt");
const worker_name = @embedFile("worker_name.txt");

pub fn main() !void {
    // stdout is for the actual output of your application, for example if you
    // are implementing gzip, then only the compressed bytes should be sent to
    // stdout, not any debugging messages.
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print("Index bytes: {d}\n", .{index.len});
    try stdout.print("Wasm bytes: {d}\n", .{wasm.len});
    try stdout.print("Account: {s}\n", .{accountid});
    try stdout.print("Worker name: {s}\n", .{worker_name});

    try bw.flush(); // don't forget to flush!
}

test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
