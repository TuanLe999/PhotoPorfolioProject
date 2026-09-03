using System.Security.Cryptography;
using System.Text;

namespace Portfolio.Api.Services;

/// <summary>
/// Xác thực admin đơn giản: mật khẩu trong cấu hình -> phát hành token HMAC đặt trong cookie HttpOnly.
/// Đủ cho site 1 người quản trị; muốn nhiều user thì thay bằng ASP.NET Core Identity.
/// </summary>
public sealed class AdminAuth
{
    public const string CookieName = "pf_admin";
    private readonly byte[] _key;
    private readonly string _password;
    private readonly TimeSpan _lifetime = TimeSpan.FromDays(7);

    public AdminAuth(IConfiguration config)
    {
        _password = config["Admin:Password"] ?? "admin123";
        var secret = config["Admin:TokenSecret"];
        if (string.IsNullOrWhiteSpace(secret) || secret == "change-me")
        {
            // Không có secret cấu hình -> sinh secret ổn định theo máy, lưu cạnh Data.
            secret = LoadOrCreateLocalSecret();
        }
        _key = Encoding.UTF8.GetBytes(secret);
    }

    public bool IsDefaultPassword => _password == "admin123";

    public bool VerifyPassword(string? candidate) =>
        candidate is not null &&
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(candidate), Encoding.UTF8.GetBytes(_password));

    public string IssueToken()
    {
        var expires = DateTimeOffset.UtcNow.Add(_lifetime).ToUnixTimeSeconds();
        var payload = $"admin.{expires}";
        return $"{payload}.{Sign(payload)}";
    }

    public bool ValidateToken(string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var parts = token.Split('.');
        if (parts.Length != 3) return false;
        var payload = $"{parts[0]}.{parts[1]}";
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(Sign(payload)), Encoding.UTF8.GetBytes(parts[2])))
            return false;
        return long.TryParse(parts[1], out var exp) && DateTimeOffset.UtcNow.ToUnixTimeSeconds() < exp;
    }

    private string Sign(string payload)
    {
        using var hmac = new HMACSHA256(_key);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    private static string LoadOrCreateLocalSecret()
    {
        var path = Path.Combine(AppContext.BaseDirectory, ".token-secret");
        if (File.Exists(path)) return File.ReadAllText(path).Trim();
        var generated = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        File.WriteAllText(path, generated);
        return generated;
    }
}
