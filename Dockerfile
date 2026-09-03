# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# restore riêng để tận dụng cache layer khi chỉ sửa code
COPY src/Portfolio.Api/Portfolio.Api.csproj src/Portfolio.Api/
RUN dotnet restore src/Portfolio.Api/Portfolio.Api.csproj

COPY src/ src/
RUN dotnet publish src/Portfolio.Api/Portfolio.Api.csproj -c Release -o /app/publish

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Dữ liệu runtime trỏ ra ngoài thư mục app để mount ổ đĩa bền vững vào đây.
ENV Storage__DataDir=/data \
    Storage__MediaDir=/data/media \
    ASPNETCORE_ENVIRONMENT=Production
VOLUME ["/data"]

# Cổng lấy từ biến PORT (host như Render/Railway sẽ ghi đè giá trị này).
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Portfolio.Api.dll"]
