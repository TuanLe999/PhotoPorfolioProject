# Portfolio Studio — website giới thiệu dịch vụ chụp ảnh

Website portfolio cho thợ chụp ảnh, gồm **trang giới thiệu** (hiện đại, nhiều animation, tone màu đổi được)
và **trang quản trị** cho phép kéo–thả ảnh, đổi kích thước, cắt/ghép, chèn hiệu ứng, điền text,
xem trước rồi lưu để áp dụng ngay lên trang thật.

Front-end và back-end **tách rời hoàn toàn**: React gọi .NET Web API qua HTTP, deploy độc lập ở hai nơi.

```
PhotoPorfolioProject/
├─ backend/Portfolio.Api/     # ASP.NET Core 10 Web API (chỉ JSON + ảnh, không phục vụ giao diện)
├─ frontend/                  # React 19 + TypeScript + Vite
├─ Dockerfile                 # image cho back-end
└─ render.yaml                # blueprint deploy back-end lên Render
```

## Công nghệ

| Phần | Lựa chọn | Vì sao |
|---|---|---|
| Back-end | **ASP.NET Core 10 minimal API** (C#) | theo yêu cầu |
| Nội dung | **JSON file** (`site.json`, `media.json`) | không cần DB; ghi atomic + tự giữ 30 bản lịch sử |
| Ảnh | **Azure Blob Storage**, hoặc đĩa máy chủ | đổi bằng cấu hình, không sửa code; blob thì redeploy/đổi host không mất ảnh |
| Front-end | **React 19 + TypeScript + Vite** | SPA 3 route, type an toàn từ model API xuống component |
| Điều hướng | react-router-dom 7 | `/` portfolio · `/admin` quản trị · `/preview` khung xem trước |
| State admin | store nhỏ tự viết + `useSyncExternalStore` | undo/redo, gộp bước khi kéo slider, tự lưu nháp — không cần Redux |

Component render (`BlockView` / `SectionView`) được **dùng chung** cho trang thật, canvas admin và khung
xem trước, nên *preview thấy sao thì khách thấy vậy*.

## Chạy ở máy

Cần **.NET 10 SDK** và **Node.js 20+**. Mở 2 terminal:

```bash
dotnet run --project backend/Portfolio.Api/Portfolio.Api.csproj --urls http://localhost:5080
```

```bash
npm install --prefix frontend && npm run dev --prefix frontend
```

- Portfolio: <http://localhost:5173/>
- Quản trị: <http://localhost:5173/admin> — mật khẩu mặc định **`admin123`**
- API: <http://localhost:5080> (`/healthz` để kiểm tra sống)

`frontend/.env.local` trỏ tới API (mặc định `VITE_API_URL=http://localhost:5080`).
Back-end nhận origin của front-end qua `Cors:AllowedOrigins` trong `appsettings.json`.

## Tính năng trang quản trị

| Nhóm | Chi tiết |
|---|---|
| **Kéo–thả** | kéo ảnh từ thư viện thả vào khối · kéo file từ máy thả trực tiếp vào canvas (tự upload) · kéo tay cầm `⠿` để đổi vị trí khối trong/giữa các khu vực · kéo đổi thứ tự khu vực |
| **Kích thước** | kéo cạnh phải khối để đổi độ rộng (snap theo lưới 12 cột) · tỉ lệ khung 1:1, 4:5, 2:3, 3:2, 16:9, 2.4:1 · cover/contain · chọn *trọng tâm ảnh* bằng cách bấm lên ảnh |
| **Cắt / ghép** | cắt ảnh có khoá tỉ lệ + lưới 1/3 → *Áp dụng* (không phá ảnh gốc, lưu vùng %) hoặc *Xuất ảnh mới* (tạo file mới) · ghép 2–4 ảnh thành ảnh mới với 4 kiểu bố cục, khoảng cách, bo góc, màu nền |
| **Text** | khối chữ / trích dẫn, cỡ chữ, canh lề, màu riêng · **nháy đúp lên chữ ngay trên canvas để sửa** · chú thích ảnh (dưới ảnh / trên ảnh / khi hover / ẩn) |
| **Animation** | 18 hiệu ứng khi cuộn tới (trôi, zoom, blur, wipe, flip, Ken Burns…) + trễ + thời lượng · 5 hiệu ứng hover · parallax · nút chạy lại hiệu ứng |
| **Tone màu** | 6 bộ màu sẵn (kể cả tone sáng) · 6 màu tuỳ chỉnh · 7 font · bo góc · độ hạt phim · tốc độ animation · quầng sáng theo con trỏ |
| **Preview & lưu** | Xem trước Desktop/Tablet/Mobile bằng đúng component của trang thật → *Lưu & áp dụng* mới đẩy ra cho khách |
| **An toàn** | Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) · tự lưu nháp vào máy, mời khôi phục khi mở lại · lịch sử 30 bản lưu · xuất/nhập `site.json` |

Phím tắt: `Ctrl+S` lưu · `Ctrl+P` preview · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo · `Delete` xoá khối đang chọn.

## API

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/api/site` | công khai | cấu hình + nội dung trang |
| PUT | `/api/site` | admin | lưu & áp dụng (tự snapshot bản cũ) |
| GET | `/api/site/history` · POST `/api/site/restore/{file}` | admin | lịch sử & phục hồi |
| GET | `/api/media` · POST `/api/media` · DELETE `/api/media/{id}` | admin | thư viện ảnh, upload nhiều file (≤25MB/ảnh) |
| POST | `/api/media/from-data-url` | admin | lưu ảnh đã cắt/ghép từ canvas |
| POST | `/api/auth/login` · `/logout` · GET `/me` | — | phiên admin (cookie HttpOnly, HMAC, 7 ngày) |
| GET | `/media/{file}` | công khai | ảnh đã upload |

Vì hai domain khác nhau, cookie phiên dùng `SameSite=None; Secure` và mọi request từ React gửi kèm
`credentials: 'include'`. Trình duyệt vẫn chấp nhận cookie `Secure` trên `http://localhost` khi dev.

## Deploy

> **Vercel không chạy được back-end .NET** (chỉ có runtime Node/Python/Go/Ruby, filesystem chỉ đọc).
> Vì vậy: **React lên Vercel**, **API lên host chạy container có ổ đĩa bền vững**.

### 1. Back-end → Render (có sẵn `render.yaml`)

New → **Blueprint** → chọn repo. Blueprint khai báo disk 5GB mount vào `/data`. Cần nhập:

- `Admin__Password` — mật khẩu quản trị
- `Cors__AllowedOrigins__0` — URL front-end, ví dụ `https://ten-app.vercel.app`

Lưu ý: **plan Free của Render không mount được disk** (ảnh upload mất khi restart) — cần plan Starter.
Các lựa chọn khác dùng chung `Dockerfile`: Railway, Fly.io (tạo volume `/data`), hoặc
Azure App Service Linux bậc Free F1 với `Storage__DataDir=/home/data`.

Chạy thử bằng Docker:

```bash
docker build -t photo-portfolio-api . && docker run -p 8080:8080 -v portfolio-data:/data -e Admin__Password=matkhau photo-portfolio-api
```

### 1b. Ảnh → Azure Blob Storage (khuyến nghị khi deploy)

Mặc định ảnh lưu xuống đĩa máy chủ. Đặt chuỗi kết nối là app tự chuyển sang Azure Blob,
không phải sửa code:

```
Storage__AzureBlob__ConnectionString=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
Storage__AzureBlob__ContainerName=media
```

Các bước trên Azure Portal:

1. Tạo **Storage Account** (Standard, LRS là đủ), region Southeast Asia.
2. Trong **Configuration**, bật **Allow Blob anonymous access** — để trình duyệt tải ảnh
   thẳng từ blob, không tốn băng thông API. Không bật cũng chạy được: app tự nhận ra và
   phục vụ ảnh qua endpoint `/media/...` (chậm hơn một chút).
3. Copy **Access keys → Connection string** vào biến môi trường ở trên. Container `media`
   được app tự tạo ở lần upload đầu.

| Biến | Mặc định | Việc |
|---|---|---|
| `Storage__AzureBlob__ConnectionString` | rỗng | có giá trị = dùng Azure, rỗng = lưu đĩa |
| `Storage__AzureBlob__ContainerName` | `media` | tên container |
| `Storage__AzureBlob__PublicAccess` | `true` | cho đọc ảnh ẩn danh (tải thẳng từ blob) |
| `Storage__AzureBlob__PublicBaseUrl` | rỗng | tên miền CDN đặt trước blob, ví dụ `https://cdn.studio.vn` |
| `Storage__AzureBlob__MigrateLocalFiles` | `true` | lần đầu bật Azure, tự đẩy ảnh còn dưới đĩa lên container |

**Chuyển từ đĩa sang blob**: chỉ cần thêm biến rồi restart. Lúc khởi động app tự copy ảnh cũ
trong thư mục media lên container (chỉ copy, không xoá file gốc; chạy lại nhiều lần cũng không
trùng lặp), nên các URL `/media/...` đã lưu trong `site.json` vẫn hoạt động. Ảnh upload mới sẽ
có URL trỏ thẳng blob/CDN.

Chạy thử ở máy không cần tài khoản Azure — dùng emulator [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite):

```bash
npm install -g azurite && azurite-blob --location ./.azurite
```

rồi đặt `Storage__AzureBlob__ConnectionString=UseDevelopmentStorage=true`.

### 2. Front-end → Vercel

Import repo → **Root Directory: `frontend`** (đã có `frontend/vercel.json` khai báo Vite + SPA rewrite).
Thêm biến môi trường:

```
VITE_API_URL=https://ten-api.onrender.com
```

Deploy xong, quay lại back-end thêm domain Vercel vào `Cors__AllowedOrigins__0` rồi redeploy.

### Biến môi trường back-end

| Biến | Mặc định | Việc |
|---|---|---|
| `Admin__Password` | `admin123` | **bắt buộc đổi** khi deploy |
| `Admin__TokenSecret` | tự sinh, lưu ở `DataDir/.token-secret` | khoá ký cookie admin |
| `Cors__AllowedOrigins__0` | `http://localhost:5173` | domain front-end được phép gọi API |
| `Storage__DataDir` | `<app>/Data` | nơi lưu `site.json`, `media.json`, lịch sử — **vẫn cần ổ đĩa bền vững** |
| `Storage__MediaDir` | `<app>/wwwroot/media` | nơi lưu ảnh khi **không** dùng Azure Blob |
| `Storage__AzureBlob__*` | — | xem mục 1b |
| `PORT` | `8080` trong image | cổng lắng nghe |

> ⚠️ Blob mới chỉ lo phần **ảnh**. Nội dung trang (`site.json`) vẫn nằm ở `Storage__DataDir`,
> nên host chạy API vẫn cần một ổ đĩa bền vững (Render disk, `/home` của Azure App Service…).
> File này rất nhỏ (~10KB) nên disk 1GB nhỏ nhất cũng thừa.

> `Data/` và ảnh upload **không** được commit — server sinh nội dung mẫu ở lần chạy đầu, còn dữ liệu
> bạn nhập qua trang admin nằm trên ổ đĩa của host chứ không nằm trong git.

## Ghi chú vận hành

- **Xoá dữ liệu demo**: xoá `backend/Portfolio.Api/Data/*.json` và ảnh trong thư mục media (hoặc nội dung `/data` khi deploy).
- **Reduced motion**: người dùng bật "giảm chuyển động" trong hệ điều hành sẽ thấy trang tĩnh.
- **Trước khi mở ra Internet**: đổi `Admin__Password` + `Admin__TokenSecret`, chạy HTTPS cả hai phía,
  và cân nhắc thêm rate-limit cho `/api/auth/login`.
