using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Portfolio.Api.Models;
using Portfolio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<SiteStore>();
builder.Services.AddSingleton<AdminAuth>();
builder.Services.AddResponseCompression(o => o.EnableForHttps = true);
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 64L * 1024 * 1024; // 64 MB / request
    o.ValueLengthLimit = int.MaxValue;
});

var app = builder.Build();

var json = SiteStore.SerializerOptions;
var mediaRoot = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "media");
Directory.CreateDirectory(mediaRoot);

app.UseResponseCompression();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? "";
        // Ảnh upload có tên duy nhất -> cache vĩnh viễn; HTML/JS/CSS thì luôn kiểm tra lại.
        ctx.Context.Response.Headers.CacheControl =
            path.StartsWith("/media/", StringComparison.OrdinalIgnoreCase)
                ? "public,max-age=31536000,immutable"
                : "no-cache";
    }
});

// ---------------------------------------------------------------- helpers

static IResult Unauthorized401() => Results.Json(new { error = "Cần đăng nhập admin." }, statusCode: 401);

bool IsAuthed(HttpContext ctx, AdminAuth auth) =>
    auth.ValidateToken(ctx.Request.Cookies[AdminAuth.CookieName]);

// ---------------------------------------------------------------- auth

app.MapPost("/api/auth/login", async (HttpContext ctx, AdminAuth auth) =>
{
    var body = await ctx.Request.ReadFromJsonAsync<LoginRequest>();
    if (!auth.VerifyPassword(body?.Password))
    {
        await Task.Delay(400); // làm chậm brute-force
        return Results.Json(new { error = "Mật khẩu không đúng." }, statusCode: 401);
    }

    ctx.Response.Cookies.Append(AdminAuth.CookieName, auth.IssueToken(), new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        Secure = ctx.Request.IsHttps,
        Expires = DateTimeOffset.UtcNow.AddDays(7),
        Path = "/"
    });
    return Results.Ok(new { ok = true, usingDefaultPassword = auth.IsDefaultPassword });
});

app.MapPost("/api/auth/logout", (HttpContext ctx) =>
{
    ctx.Response.Cookies.Delete(AdminAuth.CookieName, new CookieOptions { Path = "/" });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/auth/me", (HttpContext ctx, AdminAuth auth) =>
    Results.Ok(new { authenticated = IsAuthed(ctx, auth), usingDefaultPassword = auth.IsDefaultPassword }));

// ---------------------------------------------------------------- site config

app.MapGet("/api/site", async (SiteStore store) => Results.Json(await store.GetSiteAsync(), json));

app.MapPut("/api/site", async (HttpContext ctx, SiteStore store, AdminAuth auth) =>
{
    if (!IsAuthed(ctx, auth)) return Unauthorized401();

    SiteConfig? incoming;
    try { incoming = await ctx.Request.ReadFromJsonAsync<SiteConfig>(json); }
    catch (JsonException ex) { return Results.Json(new { error = "JSON không hợp lệ: " + ex.Message }, statusCode: 400); }
    if (incoming is null) return Results.Json(new { error = "Thiếu nội dung." }, statusCode: 400);

    Sanitize(incoming);
    var saved = await store.SaveSiteAsync(incoming);
    return Results.Json(saved, json);
});

app.MapGet("/api/site/history", (HttpContext ctx, SiteStore store, AdminAuth auth) =>
    IsAuthed(ctx, auth) ? Results.Ok(store.ListHistory()) : Unauthorized401());

app.MapPost("/api/site/restore/{file}", async (string file, HttpContext ctx, SiteStore store, AdminAuth auth) =>
{
    if (!IsAuthed(ctx, auth)) return Unauthorized401();
    var restored = await store.RestoreAsync(file);
    return restored is null
        ? Results.Json(new { error = "Không tìm thấy bản lưu." }, statusCode: 404)
        : Results.Json(restored, json);
});

// ---------------------------------------------------------------- media

app.MapGet("/api/media", async (HttpContext ctx, SiteStore store, AdminAuth auth) =>
    IsAuthed(ctx, auth) ? Results.Json(await store.GetMediaAsync(), json) : Unauthorized401());

app.MapPost("/api/media", async (HttpContext ctx, SiteStore store, AdminAuth auth) =>
{
    if (!IsAuthed(ctx, auth)) return Unauthorized401();
    if (!ctx.Request.HasFormContentType) return Results.Json(new { error = "Cần multipart/form-data." }, statusCode: 400);

    var form = await ctx.Request.ReadFormAsync();
    var saved = new List<MediaItem>();
    var skipped = new List<string>();

    foreach (var file in form.Files)
    {
        if (file.Length == 0) continue;
        if (file.Length > 25L * 1024 * 1024) { skipped.Add(file.FileName + " (>25MB)"); continue; }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!MediaRules.AllowedExtensions.Contains(ext)) { skipped.Add(file.FileName + " (định dạng không hỗ trợ)"); continue; }

        var item = await StoreFileAsync(file.OpenReadStream(), ext, file.ContentType, file.FileName, mediaRoot);
        await store.AddMediaAsync(item);
        saved.Add(item);
    }

    return Results.Json(new { saved, skipped }, json);
});

// Lưu ảnh đã cắt/ghép từ canvas của trang admin (data URL).
app.MapPost("/api/media/from-data-url", async (HttpContext ctx, SiteStore store, AdminAuth auth) =>
{
    if (!IsAuthed(ctx, auth)) return Unauthorized401();

    var body = await ctx.Request.ReadFromJsonAsync<DataUrlRequest>();
    if (string.IsNullOrWhiteSpace(body?.DataUrl) || !body.DataUrl.StartsWith("data:image/"))
        return Results.Json(new { error = "dataUrl phải là data:image/*" }, statusCode: 400);

    var comma = body.DataUrl.IndexOf(',');
    if (comma < 0) return Results.Json(new { error = "dataUrl không hợp lệ." }, statusCode: 400);

    var mime = body.DataUrl[5..comma].Split(';')[0];
    var ext = mime switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/webp" => ".webp",
        _ => null
    };
    if (ext is null) return Results.Json(new { error = "Chỉ hỗ trợ png/jpeg/webp." }, statusCode: 400);

    byte[] bytes;
    try { bytes = Convert.FromBase64String(body.DataUrl[(comma + 1)..]); }
    catch (FormatException) { return Results.Json(new { error = "base64 không hợp lệ." }, statusCode: 400); }
    if (bytes.Length > 25L * 1024 * 1024) return Results.Json(new { error = "Ảnh vượt 25MB." }, statusCode: 400);

    using var ms = new MemoryStream(bytes);
    var item = await StoreFileAsync(ms, ext, mime, body.FileName ?? "edited", mediaRoot);
    item.Tags.Add("edited");
    await store.AddMediaAsync(item);
    return Results.Json(item, json);
});

app.MapDelete("/api/media/{id}", async (string id, HttpContext ctx, SiteStore store, AdminAuth auth) =>
{
    if (!IsAuthed(ctx, auth)) return Unauthorized401();

    var removed = await store.RemoveMediaAsync(id);
    if (removed is null) return Results.Json(new { error = "Không tìm thấy ảnh." }, statusCode: 404);

    var path = Path.Combine(mediaRoot, Path.GetFileName(removed.FileName));
    if (File.Exists(path)) { try { File.Delete(path); } catch { /* file đang bị giữ */ } }
    return Results.Ok(new { ok = true });
});

app.MapFallbackToFile("index.html");

app.Run();

// ---------------------------------------------------------------- local funcs

static async Task<MediaItem> StoreFileAsync(Stream source, string ext, string? contentType, string originalName, string mediaRoot)
{
    var id = Guid.NewGuid().ToString("n")[..12];
    var slug = MediaRules.Slugify(Path.GetFileNameWithoutExtension(originalName));
    var fileName = slug + "-" + id + ext;
    var fullPath = Path.Combine(mediaRoot, fileName);

    await using (var target = File.Create(fullPath))
        await source.CopyToAsync(target);

    int w, h;
    await using (var probe = File.OpenRead(fullPath))
        (w, h) = ImageInspector.GetSize(probe);

    return new MediaItem
    {
        Id = id,
        FileName = fileName,
        Url = "/media/" + fileName,
        Size = new FileInfo(fullPath).Length,
        Width = w,
        Height = h,
        ContentType = contentType ?? "application/octet-stream"
    };
}

/// <summary>Kẹp các giá trị layout/hiệu ứng về khoảng hợp lệ trước khi lưu.</summary>
static void Sanitize(SiteConfig cfg)
{
    cfg.Theme.Radius = Math.Clamp(cfg.Theme.Radius, 0, 48);
    cfg.Theme.Grain = Math.Clamp(cfg.Theme.Grain, 0, 1);
    cfg.Theme.AnimationSpeed = Math.Clamp(cfg.Theme.AnimationSpeed, 0.2, 3);

    foreach (var section in cfg.Sections)
    {
        section.Columns = Math.Clamp(section.Columns, 1, 12);
        section.Gap = Math.Clamp(section.Gap, 0, 80);
        foreach (var b in section.Blocks)
        {
            b.ColSpan = Math.Clamp(b.ColSpan, 1, 12);
            b.AspectRatio = Math.Clamp(b.AspectRatio, 0, 4);
            b.FocusX = Math.Clamp(b.FocusX, 0, 100);
            b.FocusY = Math.Clamp(b.FocusY, 0, 100);
            b.Delay = Math.Clamp(b.Delay, 0, 4000);
            b.Duration = Math.Clamp(b.Duration, 100, 5000);
            b.Parallax = Math.Clamp(b.Parallax, -1, 1);
            b.TitleSize = Math.Clamp(b.TitleSize, 10, 120);
            b.BodySize = Math.Clamp(b.BodySize, 10, 48);
            if (b.Radius is { } r) b.Radius = Math.Clamp(r, 0, 200);

            if (b.Crop is { } crop)
            {
                crop.X = Math.Clamp(crop.X, 0, 100);
                crop.Y = Math.Clamp(crop.Y, 0, 100);
                crop.W = Math.Clamp(crop.W, 1, 100 - crop.X);
                crop.H = Math.Clamp(crop.H, 1, 100 - crop.Y);
            }
        }
    }
}

static class MediaRules
{
    public static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif" };

    public static string Slugify(string input)
    {
        var chars = input.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) && c < 128 ? c : '-')
            .ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return string.IsNullOrEmpty(slug) ? "img" : slug[..Math.Min(slug.Length, 40)];
    }
}

record LoginRequest(string? Password);
record DataUrlRequest(string? DataUrl, string? FileName);
