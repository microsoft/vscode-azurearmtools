@ECHO OFF
PowerShell -NoProfile -NoLogo -ExecutionPolicy unrestricted -Command "[System.Threading.Thread]::CurrentThread.CurrentCulture = ''; [System.Threading.Thread]::CurrentThread.CurrentUICulture = ''; [System.Net.ServicePointManager]::SecurityProtocol=[System.Net.SecurityProtocolType]::Tls12+[System.Net.SecurityProtocolType]::Tls13; & '%~dp0dotnet-install.ps1' %*; exit $LASTEXITCODE"
