const std = @import("std");
const cloudflare = @import("cloudflare.zig");
const CloudflareDeployStep = @This();

pub const base_id: std.Build.Step.Id = .custom;

step: std.Build.Step,
primary_javascript_path: std.Build.LazyPath,
worker_name: []const u8,
options: Options,

pub const Options = struct {
    /// if set, the primary file will not be read (and may not exist). This data
    /// will be used instead
    primary_file_data: ?[]const u8 = null,

    /// When set, the Javascript file will be searched/replaced with the target
    /// file name for import
    wasm_name: ?struct {
        search: []const u8,
        replace: []const u8,
    } = null,

    /// When set, the directory specified will be used rather than the current directory
    wasm_dir: ?[]const u8 = null,
};

pub fn create(
    owner: *std.Build,
    worker_name: []const u8,
    primary_javascript_path: std.Build.LazyPath,
    options: Options,
) *CloudflareDeployStep {
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
        .options = options,
    };
    if (options.primary_file_data == null)
        primary_javascript_path.addStepDependencies(&self.step);
    return self;
}

fn make(step: *std.Build.Step, prog_node: *std.Progress.Node) !void {
    _ = prog_node;
    const b = step.owner;
    const self = @as(*CloudflareDeployStep, @fieldParentPtr("step", step));

    var client = std.http.Client{ .allocator = b.allocator };
    try client.initDefaultProxies(b.allocator);
    defer client.deinit();

    const script = self.options.primary_file_data orelse
        try std.fs.cwd().readFileAlloc(b.allocator, self.primary_javascript_path.path, std.math.maxInt(usize));
    defer if (self.options.primary_file_data == null) b.allocator.free(script);

    var final_script = script;
    if (self.options.wasm_name) |n| {
        final_script = try std.mem.replaceOwned(u8, b.allocator, script, n.search, n.replace);
        if (self.options.primary_file_data == null) b.allocator.free(script);
    }
    defer if (self.options.wasm_name) |_| b.allocator.free(final_script);

    var al = std.ArrayList(u8).init(b.allocator);
    defer al.deinit();
    try cloudflare.pushWorker(
        b.allocator,
        &client,
        self.worker_name,
        self.options.wasm_dir orelse ".",
        final_script,
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
