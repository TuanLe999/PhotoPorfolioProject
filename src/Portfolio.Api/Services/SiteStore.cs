using System.Text.Json;
using Portfolio.Api.Models;

namespace Portfolio.Api.Services;

/// <summary>
/// Lưu trữ cấu hình site + thư viện media dưới dạng JSON file (atomic write, có snapshot lịch sử).
/// Không cần database ngoài -> deploy chỉ cần copy folder.
/// </summary>
public sealed class SiteStore
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _dataDir;
    private readonly string _sitePath;
    private readonly string _mediaPath;
    private readonly string _historyDir;

    private SiteConfig? _cache;
    private MediaLibrary? _mediaCache;

    public SiteStore(IWebHostEnvironment env)
    {
        _dataDir = Path.Combine(env.ContentRootPath, "Data");
        _historyDir = Path.Combine(_dataDir, "history");
        Directory.CreateDirectory(_dataDir);
        Directory.CreateDirectory(_historyDir);
        _sitePath = Path.Combine(_dataDir, "site.json");
        _mediaPath = Path.Combine(_dataDir, "media.json");
    }

    public static JsonSerializerOptions SerializerOptions => JsonOpts;

    // ---------- site ----------

    public async Task<SiteConfig> GetSiteAsync()
    {
        if (_cache is not null) return _cache;
        await _gate.WaitAsync();
        try
        {
            _cache ??= await ReadAsync<SiteConfig>(_sitePath) ?? SeedData.CreateDefault();
            return _cache;
        }
        finally { _gate.Release(); }
    }

    public async Task<SiteConfig> SaveSiteAsync(SiteConfig incoming)
    {
        var current = await GetSiteAsync();
        await _gate.WaitAsync();
        try
        {
            incoming.Revision = current.Revision + 1;
            incoming.UpdatedAt = DateTimeOffset.UtcNow;

            var stamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss");
            await WriteAsync(Path.Combine(_historyDir, $"site-{stamp}-r{current.Revision}.json"), current);
            TrimHistory(30);

            await WriteAsync(_sitePath, incoming);
            _cache = incoming;
            return incoming;
        }
        finally { _gate.Release(); }
    }

    public IEnumerable<object> ListHistory() =>
        new DirectoryInfo(_historyDir).GetFiles("site-*.json")
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .Select(f => new { file = f.Name, savedAt = f.LastWriteTimeUtc, size = f.Length });

    public async Task<SiteConfig?> RestoreAsync(string fileName)
    {
        var safe = Path.GetFileName(fileName);
        var path = Path.Combine(_historyDir, safe);
        if (!File.Exists(path)) return null;
        var snapshot = await ReadAsync<SiteConfig>(path);
        if (snapshot is null) return null;
        return await SaveSiteAsync(snapshot);
    }

    private void TrimHistory(int keep)
    {
        var stale = new DirectoryInfo(_historyDir).GetFiles("site-*.json")
            .OrderByDescending(f => f.LastWriteTimeUtc).Skip(keep);
        foreach (var f in stale) { try { f.Delete(); } catch { /* bỏ qua */ } }
    }

    // ---------- media ----------

    public async Task<MediaLibrary> GetMediaAsync()
    {
        if (_mediaCache is not null) return _mediaCache;
        await _gate.WaitAsync();
        try
        {
            _mediaCache ??= await ReadAsync<MediaLibrary>(_mediaPath) ?? new MediaLibrary();
            return _mediaCache;
        }
        finally { _gate.Release(); }
    }

    public async Task AddMediaAsync(MediaItem item)
    {
        var lib = await GetMediaAsync();
        await _gate.WaitAsync();
        try
        {
            lib.Items.Insert(0, item);
            await WriteAsync(_mediaPath, lib);
        }
        finally { _gate.Release(); }
    }

    public async Task<MediaItem?> RemoveMediaAsync(string id)
    {
        var lib = await GetMediaAsync();
        await _gate.WaitAsync();
        try
        {
            var found = lib.Items.FirstOrDefault(i => i.Id == id);
            if (found is null) return null;
            lib.Items.Remove(found);
            await WriteAsync(_mediaPath, lib);
            return found;
        }
        finally { _gate.Release(); }
    }

    // ---------- io ----------

    private static async Task<T?> ReadAsync<T>(string path)
    {
        if (!File.Exists(path)) return default;
        await using var fs = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(fs, JsonOpts);
    }

    private static async Task WriteAsync<T>(string path, T value)
    {
        var tmp = path + ".tmp";
        await using (var fs = File.Create(tmp))
            await JsonSerializer.SerializeAsync(fs, value, JsonOpts);
        File.Move(tmp, path, overwrite: true);
    }
}
