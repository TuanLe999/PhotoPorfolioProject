using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Portfolio.Api.Models;
using Portfolio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Các PaaS (Render, Railway, Fly, Heroku…) truyền cổng qua biến môi trường PORT.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port) &&
    string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddSingleton<StoragePaths>();
builder.Services.AddSingleton<SiteStore>();
builder.Services.AddSingleton<AdminAuth>();
builder.Services.AddResponseCompression(o => o.EnableForHttps = true);
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 64L * 1024 * 1024; // 64 MB / request
    o.ValueLengthLimit = int.MaxValue;
});
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    // Chạy sau reverse proxy của host: nhận lại scheme https thật để cookie
    // admin được đánh dấu Secure và link tự sinh không bị http.
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// Front-end React chạy ở domain khác (Vite khi dev, Vercel khi deploy) nên phải bật
// CORS kèm credentials để cookie phiên admin đi kèm request.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

const string CorsPolicy = "spa";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, policy => policy
    .WithOrigins(allowedOrigins)
    .AllowCredentials()
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

var json = SiteStore.SerializerOptions;
var storage = app.Services.GetRequiredService<StoragePaths>();
var mediaRoot = storage.MediaDir;

app.UseForwardedHeaders();

// HTML và JSON phải luôn được kiểm tra lại, nếu không trình duyệt (hoặc CDN của host)
// có thể giữ bản cũ và người xem không thấy nội dung admin vừa lưu.
app.Use((ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        var type = ctx.Response.ContentType ?? "";
        if (!ctx.Response.Headers.ContainsKey("Cache-Control") &&
            (type.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) ||
             type.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)))
        {
            ctx.Response.Headers.CacheControl = "no-cache";
        }
        return Task.CompletedTask;
    });
    return next();
});

app.UseResponseCompression();
app.UseCors(CorsPolicy);

// API không phục vụ giao diện — chỉ phục vụ ảnh đã upload.
// Tên file có id duy nhất nên cache vĩnh viễn được.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = "/media",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
        // ảnh phải xem được từ domain của front-end
        ctx.Context.Response.Headers.AccessControlAllowOrigin = "*";
    }
});

// ---------------------------------------------------------------- helpers

static IResult Unauthorized401() => Results.Json(new { error = "Cần đăng nhập admin." }, statusCode: 401);

/// <summary>
/// Cookie phiên admin. Front-end nằm ở domain khác nên cookie phải là SameSite=None,
/// mà None thì bắt buộc Secure — trình duyệt vẫn chấp nhận Secure trên localhost khi dev.
/// </summary>
static CookieOptions SessionCookie(HttpContext ctx, DateTimeOffset? expires) => new()
{
    HttpOnly = true,
    SameSite = SameSiteMode.None,
    Secure = true,
    Expires = expires,
    Path = "/"
};

bool IsAuthed(HttpContext ctx, AdminAuth auth) =>
    auth.ValidateToken(ctx.Request.Cookies[AdminAuth.CookieName]);

// Health check cho hosting platform
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// ---------------------------------------------------------------- auth

app.MapPost("/api/auth/login", async (HttpContext ctx, AdminAuth auth) =>
{
    var body = await ctx.Request.ReadFromJsonAsync<LoginRequest>();
    if (!auth.VerifyPassword(body?.Password))
    {
        await Task.Delay(400); // làm chậm brute-force
        return Results.Json(new { error = "Mật khẩu không đúng." }, statusCode: 401);
    }

    ctx.Response.Cookies.Append(AdminAuth.CookieName, auth.IssueToken(), SessionCookie(ctx, DateTimeOffset.UtcNow.AddDays(7)));
    return Results.Ok(new { ok = true, usingDefaultPassword = auth.IsDefaultPassword });
});

app.MapPost("/api/auth/logout", (HttpContext ctx) =>
{
    ctx.Response.Cookies.Delete(AdminAuth.CookieName, SessionCookie(ctx, null));
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

// Gọi thẳng vào gốc API thì chỉ cho biết nó còn sống + trỏ sang front-end.
app.MapGet("/", () => Results.Json(new
{
    service = "Portfolio API",
    docs = new[] { "/api/site", "/api/media", "/healthz" }
}));

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
