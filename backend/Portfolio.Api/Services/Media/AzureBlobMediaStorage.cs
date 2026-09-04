using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Portfolio.Api.Models;

namespace Portfolio.Api.Services.Media;

public sealed class AzureBlobOptions
{
    /// <summary>Chuỗi kết nối Storage Account. Có giá trị thì app tự dùng Azure thay cho đĩa.</summary>
    public string? ConnectionString { get; set; }

    public string ContainerName { get; set; } = "media";

    /// <summary>Cho phép đọc ảnh ẩn danh để trình duyệt tải thẳng từ blob (nhanh, không tốn băng thông API).</summary>
    public bool PublicAccess { get; set; } = true;

    /// <summary>Tên miền CDN đặt trước blob, ví dụ https://cdn.studio.vn. Bỏ trống thì dùng URL blob gốc.</summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>
    /// Lần đầu bật Azure: tự đẩy các ảnh còn nằm dưới đĩa lên container để những URL
    /// /media/... đã lưu trong site.json không bị hỏng. Chỉ copy, không xoá file gốc.
    /// </summary>
    public bool MigrateLocalFiles { get; set; } = true;
}

/// <summary>
/// Lưu ảnh trên Azure Blob Storage. Ảnh không nằm trên máy chủ nên redeploy / đổi host
/// không mất gì, và có thể đặt CDN phía trước.
/// </summary>
public sealed class AzureBlobMediaStorage : IMediaStorage
{
    private const string ImmutableCache = "public,max-age=31536000,immutable";

    private readonly BlobContainerClient _container;
    private readonly AzureBlobOptions _options;
    private readonly ILogger<AzureBlobMediaStorage> _log;
    private readonly SemaphoreSlim _initGate = new(1, 1);

    private bool _initialised;
    private bool _servesPublicUrls;

    public AzureBlobMediaStorage(AzureBlobOptions options, ILogger<AzureBlobMediaStorage> log)
    {
        _options = options;
        _log = log;
        _container = new BlobContainerClient(options.ConnectionString, options.ContainerName);
    }

    /// <summary>Tạo container ở lần dùng đầu tiên và xác định ảnh có đọc ẩn danh được không.</summary>
    private async Task EnsureContainerAsync(CancellationToken ct)
    {
        if (_initialised) return;
        await _initGate.WaitAsync(ct);
        try
        {
            if (_initialised) return;

            if (_options.PublicAccess)
            {
                try
                {
                    await _container.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: ct);
                    _servesPublicUrls = true;
                }
                catch (RequestFailedException ex) when (ex.Status is 409 or 403)
                {
                    // Storage Account đang chặn truy cập ẩn danh -> vẫn chạy được,
                    // chỉ là ảnh sẽ đi qua endpoint /media của API.
                    _log.LogWarning("Không bật được truy cập ẩn danh cho container ({Reason}). Ảnh sẽ phục vụ qua API.", ex.ErrorCode);
                    await _container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);
                    _servesPublicUrls = false;
                }
            }
            else
            {
                await _container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);
                _servesPublicUrls = false;
            }

            _initialised = true;
        }
        finally { _initGate.Release(); }
    }

    public async Task<MediaItem> SaveAsync(Stream content, string extension, string? contentType, string originalName, CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);

        var fileName = MediaNaming.BuildFileName(originalName, extension, out var id);
        var resolvedType = contentType ?? MediaNaming.GuessContentType(extension);

        // Đệm ra file tạm: cần stream tua lại được để đọc kích thước ảnh trước khi upload.
        var tempPath = Path.Combine(Path.GetTempPath(), "pf-" + fileName);
        long size;
        int width, height;
        try
        {
            await using (var temp = File.Create(tempPath))
                await content.CopyToAsync(temp, ct);

            size = new FileInfo(tempPath).Length;
            await using (var probe = File.OpenRead(tempPath))
                (width, height) = ImageInspector.GetSize(probe);

            await using var upload = File.OpenRead(tempPath);
            await _container.GetBlobClient(fileName).UploadAsync(upload, new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = resolvedType, CacheControl = ImmutableCache }
            }, ct);
        }
        finally
        {
            try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { /* dọn sau */ }
        }

        return new MediaItem
        {
            Id = id,
            FileName = fileName,
            Url = BuildUrl(fileName),
            Size = size,
            Width = width,
            Height = height,
            ContentType = resolvedType
        };
    }

    /// <summary>
    /// URL ghi vào thư viện: đọc ẩn danh được thì trỏ thẳng blob/CDN, còn không thì
    /// dùng đường dẫn tương đối để front-end gọi qua API.
    /// </summary>
    private string BuildUrl(string fileName)
    {
        if (!_servesPublicUrls) return "/media/" + fileName;
        if (!string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
            return _options.PublicBaseUrl.TrimEnd('/') + "/" + fileName;
        return _container.GetBlobClient(fileName).Uri.ToString();
    }

    public async Task DeleteAsync(string fileName, CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);
        await _container.GetBlobClient(Path.GetFileName(fileName)).DeleteIfExistsAsync(cancellationToken: ct);
    }

    public async Task<MediaStreamResult?> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);
        var blob = _container.GetBlobClient(Path.GetFileName(fileName));
        try
        {
            var response = await blob.DownloadStreamingAsync(cancellationToken: ct);
            var contentType = response.Value.Details.ContentType is { Length: > 0 } type
                ? type
                : MediaNaming.GuessContentType(Path.GetExtension(fileName));
            return new MediaStreamResult(response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public string Describe() =>
        $"Azure Blob (container '{_options.ContainerName}', {(_options.PublicAccess ? "ảnh tải thẳng từ blob" : "ảnh đi qua API")})";

    /// <summary>
    /// Đẩy ảnh còn sót dưới đĩa lên container (bỏ qua file đã có trên blob).
    /// Chạy nền lúc khởi động để chuyển từ chế độ lưu đĩa sang Azure không mất ảnh cũ.
    /// </summary>
    public async Task MigrateLocalFilesAsync(string localDir, CancellationToken ct = default)
    {
        if (!_options.MigrateLocalFiles || !Directory.Exists(localDir)) return;

        var files = Directory.GetFiles(localDir)
            .Where(f => MediaNaming.AllowedExtensions.Contains(Path.GetExtension(f)))
            .ToArray();
        if (files.Length == 0) return;

        await EnsureContainerAsync(ct);

        int uploaded = 0, skipped = 0, failed = 0;
        foreach (var path in files)
        {
            if (ct.IsCancellationRequested) break;
            var name = Path.GetFileName(path);
            try
            {
                var blob = _container.GetBlobClient(name);
                if (await blob.ExistsAsync(ct)) { skipped++; continue; }

                await using var stream = File.OpenRead(path);
                await blob.UploadAsync(stream, new BlobUploadOptions
                {
                    HttpHeaders = new BlobHttpHeaders
                    {
                        ContentType = MediaNaming.GuessContentType(Path.GetExtension(name)),
                        CacheControl = ImmutableCache
                    }
                }, ct);
                uploaded++;
            }
            catch (Exception ex)
            {
                failed++;
                _log.LogWarning(ex, "Không chuyển được ảnh {File} lên blob.", name);
            }
        }

        _log.LogInformation("Chuyển ảnh cũ lên Azure Blob: {Uploaded} mới, {Skipped} đã có, {Failed} lỗi.",
            uploaded, skipped, failed);
    }
}
