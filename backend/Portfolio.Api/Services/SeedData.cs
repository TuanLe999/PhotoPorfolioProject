using Portfolio.Api.Models;

namespace Portfolio.Api.Services;

/// <summary>Nội dung mẫu khi chưa có site.json — block không có ảnh sẽ hiển thị placeholder gradient.</summary>
public static class SeedData
{
    public static SiteConfig CreateDefault()
    {
        var cfg = new SiteConfig();

        cfg.Site.Services =
        [
            new ServiceItem { Name = "Chân dung cá nhân", Price = "2.500.000đ", Featured = false,
                Description = "Buổi chụp 2 giờ tại studio hoặc ngoại cảnh.",
                Includes = ["2 giờ chụp", "20 ảnh retouch", "Toàn bộ ảnh gốc", "Tư vấn concept"] },
            new ServiceItem { Name = "Phóng sự cưới", Price = "12.000.000đ", Featured = true,
                Description = "Trọn ngày cưới, kể lại bằng ánh sáng tự nhiên.",
                Includes = ["10 giờ chụp", "400+ ảnh biên tập", "Album in 25x35", "2 nhiếp ảnh gia"] },
            new ServiceItem { Name = "Thương mại / Lookbook", Price = "Báo giá riêng", Featured = false,
                Description = "Chụp sản phẩm, lookbook thương hiệu.",
                Includes = ["Lên moodboard", "Studio + set design", "Retouch cao cấp", "Bản quyền thương mại"] }
        ];

        cfg.Sections =
        [
            new Section
            {
                Name = "Bộ ảnh nổi bật", Heading = "Tuyển chọn", Subheading = "Những khung hình tôi tự hào nhất",
                Layout = "grid", Gap = 18,
                Blocks =
                [
                    new Block { ColSpan = 8, AspectRatio = 1.5, Animation = "fade-up", Caption = "Ánh sáng cuối ngày — Hội An", Hover = "zoom" },
                    new Block { ColSpan = 4, AspectRatio = 0.75, Animation = "fade-left", Delay = 120, Caption = "Chân dung studio" },
                    new Block { ColSpan = 4, AspectRatio = 0.75, Animation = "fade-right", Caption = "Ngày cưới của Linh & Nam" },
                    new Block { ColSpan = 8, AspectRatio = 1.5, Animation = "fade-up", Delay = 120, Caption = "Phóng sự cưới ngoài trời" }
                ]
            },
            new Section
            {
                Name = "Câu chuyện", Layout = "grid", Gap = 24, Background = "surface",
                Blocks =
                [
                    new Block { Type = "text", ColSpan = 5, Title = "Tôi chụp thứ ánh sáng không dàn dựng",
                        Body = "Mỗi buổi chụp bắt đầu bằng một cuộc trò chuyện. Tôi muốn biết bạn là ai trước khi biết bạn đứng ở đâu.",
                        Animation = "fade-right", Align = "left" },
                    new Block { ColSpan = 7, AspectRatio = 1.4, Animation = "zoom-in", Delay = 150, Parallax = 0.2 }
                ]
            }
        ];

        return cfg;
    }
}
