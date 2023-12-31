const std = @import("std");
const cloudflare = @import("main.zig");
const CloudflareDeployStep = @This();

pub const base_id: std.Build.Step.Id = .custom;

step: std.Build.Step,
primary_javascript_path: std.Build.LazyPath,
worker_name: []const u8,

pub const Options = struct {};

pub fn create(
    owner: *std.Build,
    worker_name: []const u8,
    primary_javascript_path: std.Build.LazyPath,
    options: Options,
) *CloudflareDeployStep {
    _ = options;
    const self = owner.allocator.create(CloudflareDeployStep) catch @panic("OOM");
    self.* = CloudflareDeployStep{
        .step = std.Build.Step.init(.{
            .id = base_id,
            .name = owner.fmt("cloudflare deploy {s}", .{primary_javascript_path.getDisplayName()}),
            .owner = owner,
            .makeFn = make,
        }),
        .primary_javascript_path = primary_javascript_path,
        .worker_name = worker_name,
    };
    primary_javascript_path.addStepDependencies(&self.step);
    return self;
}

fn make(step: *std.Build.Step, prog_node: *std.Progress.Node) !void {
    _ = prog_node;
    const b = step.owner;
    const self = @fieldParentPtr(CloudflareDeployStep, "step", step);

    var client = std.http.Client{ .allocator = b.allocator };
    defer client.deinit();

    const script = try std.fs.cwd().readFileAlloc(b.allocator, self.primary_javascript_path.path, std.math.maxInt(usize));

    var al = std.ArrayList(u8).init(b.allocator);
    defer al.deinit();
    try cloudflare.pushWorker(
        b.allocator,
        &client,
        self.worker_name,
        script,
        al.writer(),
        std.io.getStdErr().writer(),
    );
    const start = std.mem.lastIndexOf(u8, al.items, "http").?;
    step.name = try std.fmt.allocPrint(
        b.allocator,
        "cloudflare deploy {s} to {s}",
        .{ self.primary_javascript_path.getDisplayName(), al.items[start .. al.items.len - 1] },
    );
}
