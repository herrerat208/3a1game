@echo off
setlocal
set "EXE=%TEMP%\cloudflared.exe"

if not exist "%EXE%" (
  echo Descargando cloudflared...
  curl -fsSL -o "%EXE%" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

echo.
echo Iniciando XAMPP...
start "" /B "C:\xampp\mysql\bin\mysqld.exe" --defaults-file=C:\xampp\mysql\bin\my.ini
start "" /B "C:\xampp\apache\bin\httpd.exe" -d C:\xampp\apache -f C:\xampp\apache\conf\httpd.conf

echo.
echo Iniciando tunel HTTPS. Copia la URL https://.../3a1-api que aparece abajo.
echo Si reinicias el tunel, la URL cambia: actualizala en Vercel y redeploya.
echo.
"%EXE%" tunnel --url http://localhost:80
