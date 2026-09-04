using Portfolio.Api.Models;

namespace Portfolio.Api.Services.Media;

/// <summary>Lưu ảnh xuống đĩa của máy chủ (mặc định khi chưa cấu hình Azure Blob).</summary>
public sealed class LocalMediaStorage : IMediaStorage
{
    private readonly string _root;

    public LocalMediaStorage(StoragePaths paths)
    {
        _root = paths.MediaDir;
        Directory.CreateDirectory(_root);
    }

    public async Task<MediaItem> SaveAsync(Stream content, string extension, string? contentType, string originalName, CancellationToken ct = default)
    {
        var fileName = MediaNaming.BuildFileName(originalName, extension, out var id);
        var fullPath = Path.Combine(_root, fileName);

        await using (var target = File.Create(fullPath))
            await content.CopyToAsync(target, ct);

        int width, height;
        await using (var probe = File.OpenRead(fullPath))
            (width, height) = ImageInspector.GetSize(probe);

        return new MediaItem
        {
            Id = id,
            FileName = fileName,
            Url = "/media/" + fileName,
            Size = new FileInfo(fullPath).Length,
            Width = width,
            Height = height,
            ContentType = contentType ?? MediaNaming.GuessContentType(extension)
        };
    }

    public Task DeleteAsync(string fileName, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, Path.GetFileName(fileName));
        if (File.Exists(path))
        {
            try { File.Delete(path); }
            catch (IOException) { /* file đang bị giữ, để lần dọn sau */ }
        }
        return Task.CompletedTask;
    }

    public Task<MediaStreamResult?> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, Path.GetFileName(fileName));
        if (!File.Exists(path)) return Task.FromResult<MediaStreamResult?>(null);

        Stream stream = File.OpenRead(path);
        var contentType = MediaNaming.GuessContentType(Path.GetExtension(path));
        return Task.FromResult<MediaStreamResult?>(new MediaStreamResult(stream, contentType));
    }

    public string Describe() => $"đĩa cục bộ ({_root})";
}
