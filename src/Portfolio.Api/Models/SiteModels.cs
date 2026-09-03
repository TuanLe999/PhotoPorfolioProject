using System.Text.Json.Serialization;

namespace Portfolio.Api.Models;

/// <summary>Toàn bộ nội dung + cấu hình của trang portfolio (một document duy nhất).</summary>
public sealed class SiteConfig
{
    public ThemeConfig Theme { get; set; } = new();
    public SiteMeta Site { get; set; } = new();
    public List<Section> Sections { get; set; } = new();
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public int Revision { get; set; }
}

public sealed class ThemeConfig
{
    public string Mode { get; set; } = "dark";              // dark | light
    public string Primary { get; set; } = "#e8c37a";
    public string Accent { get; set; } = "#7ac8e8";
    public string Background { get; set; } = "#0b0b0f";
    public string Surface { get; set; } = "#14141b";
    public string Text { get; set; } = "#f4f2ee";
    public string Muted { get; set; } = "#9a97a3";
    public string HeadingFont { get; set; } = "'Cormorant Garamond', Georgia, serif";
    public string BodyFont { get; set; } = "'Inter', system-ui, sans-serif";
    public double Radius { get; set; } = 14;
    public double Grain { get; set; } = 0.05;               // 0..1 noise overlay
    public string CursorGlow { get; set; } = "on";          // on | off
    public double AnimationSpeed { get; set; } = 1;          // hệ số nhân duration
}

public sealed class SiteMeta
{
    public string Title { get; set; } = "LUMEN Studio";
    public string Tagline { get; set; } = "Nhiếp ảnh cưới & chân dung";
    public string LogoText { get; set; } = "LUMEN";
    public string HeroHeadline { get; set; } = "Giữ lại ánh sáng của khoảnh khắc";
    public string HeroSub { get; set; } = "Chụp ảnh cưới, chân dung và thương mại tại Hà Nội";
    public string? HeroImage { get; set; }
    public string HeroCtaText { get; set; } = "Xem portfolio";
    public string HeroCtaLink { get; set; } = "#work";
    public string About { get; set; } = "Tôi là một thợ chụp ảnh với 8 năm kinh nghiệm, theo đuổi thứ ánh sáng tự nhiên và những cảm xúc chưa kịp dàn dựng.";
    public string? AboutImage { get; set; }
    public string Email { get; set; } = "hello@lumen.studio";
    public string Phone { get; set; } = "+84 900 000 000";
    public string Address { get; set; } = "Hà Nội, Việt Nam";
    public string Instagram { get; set; } = "";
    public string Facebook { get; set; } = "";
    public string Behance { get; set; } = "";
    public List<ServiceItem> Services { get; set; } = new();
    public string FooterNote { get; set; } = "© LUMEN Studio";
}

public sealed class ServiceItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n")[..8];
    public string Name { get; set; } = "";
    public string Price { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> Includes { get; set; } = new();
    public bool Featured { get; set; }
}

/// <summary>Một khối nội dung (section) trên trang, chứa các block do admin kéo thả.</summary>
public sealed class Section
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n")[..8];
    public string Name { get; set; } = "Bộ ảnh mới";
    public string? Heading { get; set; }
    public string? Subheading { get; set; }
    public string Layout { get; set; } = "grid";     // grid | masonry | carousel | justified
    public int Columns { get; set; } = 12;
    public double Gap { get; set; } = 16;
    public string Background { get; set; } = "transparent"; // transparent | surface | accent
    public bool Visible { get; set; } = true;
    public List<Block> Blocks { get; set; } = new();
}

public sealed class Block
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n")[..8];
    public string Type { get; set; } = "image";      // image | text | spacer | video | quote

    // layout
    public int ColSpan { get; set; } = 4;            // 1..12
    public double AspectRatio { get; set; } = 1;     // w/h, 0 = auto
    public string Fit { get; set; } = "cover";       // cover | contain
    public double FocusX { get; set; } = 50;         // %
    public double FocusY { get; set; } = 50;         // %
    public double? Radius { get; set; }

    // media
    public string? Src { get; set; }
    public string? Thumb { get; set; }
    public string Alt { get; set; } = "";
    public CropRect? Crop { get; set; }

    // text
    public string? Title { get; set; }
    public string? Body { get; set; }
    public string Align { get; set; } = "left";      // left | center | right
    public double TitleSize { get; set; } = 32;
    public double BodySize { get; set; } = 16;
    public string? Color { get; set; }
    public string? Caption { get; set; }
    public string CaptionStyle { get; set; } = "below"; // below | overlay | hover | none

    // hiệu ứng
    public string Animation { get; set; } = "fade-up"; // xem assets/js/animations.js
    public double Delay { get; set; }                   // ms
    public double Duration { get; set; } = 800;         // ms
    public string Hover { get; set; } = "zoom";         // none | zoom | lift | tilt | reveal
    public double Parallax { get; set; }                // -1..1
    public string? Link { get; set; }
}

public sealed class CropRect
{
    public double X { get; set; }
    public double Y { get; set; }
    public double W { get; set; } = 100;
    public double H { get; set; } = 100;
}

public sealed class MediaItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n")[..12];
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public string? ThumbUrl { get; set; }
    public long Size { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string ContentType { get; set; } = "";
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<string> Tags { get; set; } = new();
}

public sealed class MediaLibrary
{
    public List<MediaItem> Items { get; set; } = new();
}

[JsonSerializable(typeof(SiteConfig))]
[JsonSerializable(typeof(MediaLibrary))]
internal partial class SiteJsonContext : JsonSerializerContext;
