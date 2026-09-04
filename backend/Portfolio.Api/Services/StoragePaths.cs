namespace Portfolio.Api.Services;

/// <summary>
/// Nơi lưu dữ liệu runtime (nội dung site + ảnh upload).
/// Mặc định nằm trong thư mục dự án; khi deploy bằng container thì trỏ vào ổ đĩa
/// gắn ngoài qua cấu hình Storage:DataDir / Storage:MediaDir (biến môi trường
/// Storage__DataDir / Storage__MediaDir) để dữ liệu không mất sau mỗi lần redeploy.
/// </summary>
public sealed class StoragePaths
{
    public StoragePaths(IConfiguration config, IWebHostEnvironment env)
    {
        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");

        DataDir = Resolve(config["Storage:DataDir"], Path.Combine(env.ContentRootPath, "Data"), env);
        MediaDir = Resolve(config["Storage:MediaDir"], Path.Combine(webRoot, "media"), env);
        HistoryDir = Path.Combine(DataDir, "history");

        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(HistoryDir);
        Directory.CreateDirectory(MediaDir);
    }

    public string DataDir { get; }
    public string MediaDir { get; }
    public string HistoryDir { get; }

    public string SiteFile => Path.Combine(DataDir, "site.json");
    public string MediaFile => Path.Combine(DataDir, "media.json");
    public string TokenSecretFile => Path.Combine(DataDir, ".token-secret");

    private static string Resolve(string? configured, string fallback, IWebHostEnvironment env)
    {
        if (string.IsNullOrWhiteSpace(configured)) return fallback;
        return Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(env.ContentRootPath, configured);
    }
}
