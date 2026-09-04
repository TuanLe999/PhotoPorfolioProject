using System.Buffers.Binary;

namespace Portfolio.Api.Services;

/// <summary>Đọc kích thước ảnh trực tiếp từ header (JPEG/PNG/GIF/WebP) — không cần thư viện ngoài.</summary>
public static class ImageInspector
{
    public static (int Width, int Height) GetSize(Stream stream)
    {
        try
        {
            stream.Position = 0;
            Span<byte> head = new byte[32];
            if (stream.Read(head) < 24) return (0, 0);
            stream.Position = 0;

            // PNG
            if (head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47)
                return (BinaryPrimitives.ReadInt32BigEndian(head[16..20]),
                        BinaryPrimitives.ReadInt32BigEndian(head[20..24]));

            // GIF
            if (head[0] == 'G' && head[1] == 'I' && head[2] == 'F')
                return (BinaryPrimitives.ReadUInt16LittleEndian(head[6..8]),
                        BinaryPrimitives.ReadUInt16LittleEndian(head[8..10]));

            // WebP (VP8X / VP8 lossy / VP8L)
            if (head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F' &&
                head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P')
                return ReadWebP(stream);

            // JPEG
            if (head[0] == 0xFF && head[1] == 0xD8) return ReadJpeg(stream);
        }
        catch { /* ảnh lạ -> trả 0, front-end tự đo */ }
        finally { if (stream.CanSeek) stream.Position = 0; }
        return (0, 0);
    }

    private static (int, int) ReadWebP(Stream s)
    {
        var buf = new byte[30];
        s.Position = 0;
        if (s.Read(buf) < 30) return (0, 0);
        var fourcc = System.Text.Encoding.ASCII.GetString(buf, 12, 4);
        switch (fourcc)
        {
            case "VP8X":
                var w = (buf[24] | buf[25] << 8 | buf[26] << 16) + 1;
                var h = (buf[27] | buf[28] << 8 | buf[29] << 16) + 1;
                return (w, h);
            case "VP8 ":
                return (BinaryPrimitives.ReadUInt16LittleEndian(buf.AsSpan(26, 2)) & 0x3FFF,
                        BinaryPrimitives.ReadUInt16LittleEndian(buf.AsSpan(28, 2)) & 0x3FFF);
            case "VP8L":
                var bits = BinaryPrimitives.ReadUInt32LittleEndian(buf.AsSpan(21, 4));
                return ((int)(bits & 0x3FFF) + 1, (int)((bits >> 14) & 0x3FFF) + 1);
            default:
                return (0, 0);
        }
    }

    private static (int, int) ReadJpeg(Stream s)
    {
        s.Position = 2;
        Span<byte> two = new byte[2];
        while (s.Read(two) == 2)
        {
            if (two[0] != 0xFF) { s.Position -= 1; continue; }
            var marker = two[1];
            if (marker is 0xD8 or 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
            if (s.Read(two) != 2) break;
            var len = BinaryPrimitives.ReadUInt16BigEndian(two) - 2;
            if (marker is >= 0xC0 and <= 0xCF && marker is not (0xC4 or 0xC8 or 0xCC))
            {
                Span<byte> sof = new byte[5];
                if (s.Read(sof) != 5) break;
                return (BinaryPrimitives.ReadUInt16BigEndian(sof[3..5]),
                        BinaryPrimitives.ReadUInt16BigEndian(sof[1..3]));
            }
            if (len <= 0) break;
            s.Position += len;
        }
        return (0, 0);
    }
}
