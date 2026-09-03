# Portfolio Studio — website giới thiệu dịch vụ chụp ảnh

Website portfolio cho thợ chụp ảnh, gồm **trang giới thiệu** (hiện đại, nhiều animation, tone màu đổi được)
và **trang quản trị** cho phép kéo–thả ảnh, đổi kích thước, cắt/ghép, chèn hiệu ứng, điền text,
xem trước rồi lưu để áp dụng ngay lên trang thật.

## Công nghệ

| Phần | Lựa chọn | Vì sao |
|---|---|---|
| Back-end | **ASP.NET Core 10 minimal API** (C#) | theo yêu cầu; không phụ thuộc NuGet ngoài |
| Lưu trữ | **JSON file** (`Data/site.json`, `Data/media.json`) + ảnh trong `wwwroot/media` | deploy chỉ cần copy thư mục, không cần cài DB; ghi atomic + tự lưu 30 bản lịch sử |
| Front-end | **Vanilla JS (ES modules) + CSS thuần** | không cần Node/npm/bundler — mở là chạy, tải nhanh, dễ bảo trì |

> Không dùng framework front-end vì toàn bộ giao diện là DOM động do một "render engine" nhỏ (~400 dòng)
> sinh ra từ JSON. Cùng engine đó chạy cho **trang thật, khung preview và canvas của admin**, nên
> *preview thấy sao thì khách thấy vậy*.

## Chạy dự án

```bash
dotnet run --project src/Portfolio.Api/Portfolio.Api.csproj --urls http://localhost:5080
```

- Trang portfolio: <http://localhost:5080/>
- Trang quản trị: <http://localhost:5080/admin.html> — mật khẩu mặc định **`admin123`**

Đổi mật khẩu trong `src/Portfolio.Api/appsettings.json`:

```json
"Admin": { "Password": "mat-khau-cua-ban", "TokenSecret": "chuoi-bi-mat-dai-ngau-nhien" }
```

(`TokenSecret` để `change-me` thì server tự sinh secret ngẫu nhiên và lưu vào file `.token-secret` cạnh binary.)

## Tính năng trang quản trị

| Nhóm | Chi tiết |
|---|---|
| **Kéo–thả** | kéo ảnh từ thư viện thả vào khối · kéo file từ máy thả trực tiếp vào canvas (tự upload) · kéo tay cầm `⠿` để đổi vị trí khối trong/giữa các khu vực · kéo đổi thứ tự khu vực |
| **Kích thước** | kéo cạnh phải khối để đổi độ rộng (snap theo lưới 12 cột) · chọn tỉ lệ khung 1:1, 4:5, 2:3, 3:2, 16:9, 2.4:1 · cover/contain · chọn *trọng tâm ảnh* bằng cách bấm lên ảnh |
| **Cắt / ghép** | cắt ảnh có khoá tỉ lệ + lưới 1/3 → *Áp dụng* (không phá ảnh gốc, lưu vùng %) hoặc *Xuất ảnh mới* (tạo file mới) · ghép 2–4 ảnh thành ảnh mới với 4 kiểu bố cục, khoảng cách, bo góc, màu nền |
| **Text** | khối chữ / trích dẫn, cỡ chữ, canh lề, màu riêng · **nháy đúp lên chữ ngay trên canvas để sửa** · chú thích ảnh (dưới ảnh / trên ảnh / khi hover / ẩn) |
| **Animation** | 18 hiệu ứng khi cuộn tới (trôi, zoom, blur, wipe, flip, Ken Burns…) + trễ + thời lượng · 5 hiệu ứng hover · parallax · nút chạy lại hiệu ứng để xem cảm giác |
| **Tone màu** | 6 bộ màu sẵn (kể cả tone sáng) · 6 màu tuỳ chỉnh · 7 font · bo góc · độ hạt phim · tốc độ animation · quầng sáng theo con trỏ |
| **Preview & lưu** | Xem trước Desktop/Tablet/Mobile bằng đúng engine trang thật → *Lưu & áp dụng* mới đẩy ra cho khách |
| **An toàn** | Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) · tự lưu bản nháp vào máy, hỏi phục hồi khi mở lại · lịch sử 30 bản lưu, phục hồi 1 click · xuất/nhập `site.json` |

Phím tắt: `Ctrl+S` lưu · `Ctrl+P` preview · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo · `Delete` xoá khối đang chọn.

## API

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/api/site` | công khai | cấu hình + nội dung trang |
| PUT | `/api/site` | admin | lưu & áp dụng (tự snapshot bản cũ) |
| GET | `/api/site/history` | admin | danh sách bản lưu |
| POST | `/api/site/restore/{file}` | admin | phục hồi bản lưu |
| GET | `/api/media` | admin | thư viện ảnh |
| POST | `/api/media` | admin | upload nhiều file (≤25MB/ảnh) |
| POST | `/api/media/from-data-url` | admin | lưu ảnh đã cắt/ghép từ canvas |
| DELETE | `/api/media/{id}` | admin | xoá ảnh |
| POST | `/api/auth/login` · `/logout` · GET `/me` | — | phiên admin (cookie HttpOnly, HMAC, 7 ngày) |

## Cấu trúc

```
src/Portfolio.Api/
├─ Program.cs               # minimal API: auth, site, media + kẹp giá trị hợp lệ khi lưu
├─ Models/SiteModels.cs     # SiteConfig / Theme / Section / Block / MediaItem
├─ Services/
│  ├─ SiteStore.cs          # đọc-ghi JSON atomic, cache, snapshot lịch sử
│  ├─ AdminAuth.cs          # mật khẩu + token HMAC trong cookie
│  ├─ ImageInspector.cs     # đọc kích thước JPEG/PNG/GIF/WebP từ header
│  └─ SeedData.cs           # nội dung mẫu lần đầu chạy
├─ Data/                    # site.json, media.json, history/
└─ wwwroot/
   ├─ index.html            # trang portfolio
   ├─ admin.html            # trang quản trị
   ├─ preview.html          # khung xem trước (nhận config qua postMessage)
   ├─ assets/css/           # theme.css (token + animation) · render.css (block) · site.css · admin.css
   └─ assets/js/
      ├─ renderer.js        # engine dựng block/section từ JSON  ← dùng chung
      ├─ page.js            # dựng vỏ trang (nav/hero/about/services)  ← dùng chung
      ├─ motion.js          # reveal khi cuộn, parallax, lightbox, cursor glow
      ├─ site.js / preview.js
      └─ state.js · api.js · ui.js · canvas.js · imagetools.js   # phần admin
```

## Deploy

> **Vercel không chạy được app này.** Vercel chỉ có runtime Node/Python/Go/Ruby và static —
> không có .NET, nên deploy sẽ ra output rỗng và mọi URL trả `404 NOT_FOUND`. Ngoài ra Vercel là
> serverless với filesystem chỉ đọc, còn app này cần ghi `site.json` và ảnh upload lên đĩa.
> Hãy chọn một host chạy container/.NET **có ổ đĩa bền vững**.

App đã sẵn sàng cho container: `Dockerfile` ở gốc repo, cổng lấy từ biến `PORT`,
dữ liệu trỏ ra ngoài code qua `Storage__DataDir` / `Storage__MediaDir`, có `/healthz` cho health check,
và tự đọc `X-Forwarded-Proto` để cookie admin được đánh dấu `Secure` khi chạy sau HTTPS của host.

### Chạy thử bằng Docker

```bash
docker build -t photo-portfolio .
docker run -p 8080:8080 -v portfolio-data:/data -e Admin__Password=matkhaucuaban photo-portfolio
```

### Render (đơn giản nhất — có sẵn `render.yaml`)

New → **Blueprint** → chọn repo → nhập `Admin__Password`. Blueprint đã khai báo disk 5GB mount vào `/data`.
Lưu ý: **plan Free của Render không mount được disk** (ảnh upload sẽ mất mỗi lần restart) — cần plan Starter,
hoặc chuyển sang lưu ảnh trên object storage (S3/R2/Azure Blob).

### Azure App Service (Linux, có bậc Free F1 với dung lượng bền vững)

```bash
az webapp up --name ten-app-cua-ban --runtime "DOTNETCORE:10.0" --sku F1
az webapp config appsettings set --name ten-app-cua-ban --resource-group <rg> \
  --settings Admin__Password=... Admin__TokenSecret=... Storage__DataDir=/home/data Storage__MediaDir=/home/data/media
```

`/home` trên App Service là vùng lưu bền vững, nên trỏ dữ liệu vào đó.

### Railway / Fly.io

Dùng chung `Dockerfile`; chỉ cần tạo volume mount vào `/data` và đặt biến `Admin__Password`,
`Admin__TokenSecret`. Cả hai đều tự truyền `PORT`.

### Biến môi trường

| Biến | Mặc định | Việc |
|---|---|---|
| `Admin__Password` | `admin123` | **bắt buộc đổi** khi deploy |
| `Admin__TokenSecret` | tự sinh, lưu ở `DataDir/.token-secret` | khoá ký cookie admin |
| `Storage__DataDir` | `<app>/Data` | nơi lưu `site.json`, `media.json`, lịch sử |
| `Storage__MediaDir` | `<app>/wwwroot/media` | nơi lưu ảnh upload |
| `PORT` | `8080` trong image | cổng lắng nghe |

> `Data/*.json` và `wwwroot/media/*` **không** được commit — server sinh ra nội dung mẫu ở lần chạy đầu,
> và dữ liệu bạn nhập qua trang admin nằm trên ổ đĩa của host chứ không nằm trong git.

## Ghi chú vận hành

- **Xoá dữ liệu demo**: xoá `src/Portfolio.Api/Data/*.json` và ảnh trong `wwwroot/media/` (hoặc nội dung ổ đĩa `/data` khi deploy), chạy lại → quay về nội dung mẫu.
- **Reduced motion**: người dùng bật "giảm chuyển động" trong hệ điều hành sẽ thấy trang tĩnh, không animation.
- **Trước khi mở ra Internet**: đổi `Admin:Password` + `Admin:TokenSecret`, chạy sau HTTPS (cookie tự bật `Secure`),
  và cân nhắc thêm rate-limit cho `/api/auth/login`.
