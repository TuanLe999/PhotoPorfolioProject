using Portfolio.Api.Models;

namespace Portfolio.Api.Services.Media;

/// <summary>
/// Nơi cất ảnh đã upload. Có hai bản cài: đĩa cục bộ (dev / host có ổ đĩa) và
/// Azure Blob Storage (deploy stateless, ảnh không mất khi redeploy).
/// </summary>
public interface IMediaStorage
{
    /// <summary>Lưu một file ảnh và trả về metadata để ghi vào thư viện.</summary>
    Task<MediaItem> SaveAsync(Stream content, string extension, string? contentType, string originalName, CancellationToken ct = default);

    /// <summary>Xoá file. Không tìm thấy thì bỏ qua, không ném lỗi.</summary>
    Task DeleteAsync(string fileName, CancellationToken ct = default);

    /// <summary>Mở file để đọc (dùng khi API tự phục vụ ảnh). Trả null nếu không có.</summary>
    Task<MediaStreamResult?> OpenReadAsync(string fileName, CancellationToken ct = default);

    /// <summary>Mô tả ngắn để ghi log lúc khởi động.</summary>
    string Describe();
}

public sealed record MediaStreamResult(Stream Content, string ContentType);

/// <summary>Quy tắc đặt tên file dùng chung cho mọi bản cài.</summary>
public static class MediaNaming
{
    public static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif" };

    /// <summary>Tên file duy nhất, giữ lại phần tên gốc cho dễ nhận ra: `anh-cuoi-3f2a1b.jpg`.</summary>
    public static string BuildFileName(string originalName, string extension, out string id)
    {
        id = Guid.NewGuid().ToString("n")[..12];
        return $"{Slugify(Path.GetFileNameWithoutExtension(originalName))}-{id}{extension}";
    }

    public static string Slugify(string input)
    {
        var chars = input.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) && c < 128 ? c : '-')
            .ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return string.IsNullOrEmpty(slug) ? "img" : slug[..Math.Min(slug.Length, 40)];
    }

    public static string GuessContentType(string extension) => extension.ToLowerInvariant() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        ".avif" => "image/avif",
        _ => "application/octet-stream"
    };
}
