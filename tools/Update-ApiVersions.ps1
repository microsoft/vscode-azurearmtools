# Updates apiVersions in a file to the newest version supported by the resource provider (doesn't necessarily have a schema)

$providersCache = @{}
$versionsFileContents = @()

function Update-ApiVersions {
    [CmdletBinding()]
    param (
        # File or folder path
        [Parameter(Mandatory)]
        [string[]]
        $Path,

        # If specified, use this file for available resource types/apiVersions (use azurerm-vscode-tools.developer.showAvailableResourceTypesAndVersions
        # command to generate), otherwise use calls to resource providers
        [string]
        $VersionsFile
    )

    if ($VersionsFile) {
        $versionsFileContents += Get-Content $VersionsFile
    }

    if ((Get-Item $Path) -is [System.IO.DirectoryInfo]) {
        $Path = (Get-ChildItem $Path).FullName
    }

    foreach ($FilePath in $Path) {
        Write-Host $FilePath
        $content = Get-Content $FilePath -Raw
        $versions = Find-UsedApiVersionsInFile $FilePath

        $versions | % {
            $type, $apiVersion = $_ -split "@"
            $newApiVersion = Get-ApiVersion $type
            if ($newApiVersion) {
                write-host "$type@$apiVersion -> $type@$newApiVersion"
        
                $pattern = 
                '(?ms)' + # multiline
                '"type":\s*"(?<type>[-a-zA-Z.\/]+)"' + # type
                '(?<middle>[,\s]*)' + # newline/whitespace
                '"apiVersion":\s*"(?<version>[-a-zA-Z0-9]+)"' # apiVersion
                $content = $content -replace $pattern, {
                    $matchedType = $_.groups["type"].value
                    $middle = $_.groups["middle"].value
                    # $matchedVersion =  $_.groups["version"].value

                    if ($matchedType -eq $type) {
                        """type"": ""$matchedtype""$middle""apiVersion"": ""$newApiVersion"""
                    }
                    else {
                        return $_
                    }
                }
            } 
        }

        Set-Content $FilePath $content.TrimEnd()
        Write-Host "Saved $FilePath"
    }

    Write-Host "Done."
}

function Find-UsedApiVersionsInFile {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [string]
        $FilePath
    )

    $json = Get-Content $FilePath -Raw | ConvertFrom-Json
    $uses = Find-UsedApiVersionsInJson $json
    $uses | sort 
}

function Find-UsedApiVersionsInJson {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [object]
        $json
    )

    $uses = @()

    $resources = $json.Resources
    foreach ($resource in $resources) {
        $type = $resource.type
        $apiVersion = $resource.apiVersion
        if ($type && $apiVersion) {
            $uses += "$type@$apiVersion"
        }
    }

    $uses
}

function Get-ApiVersion {
    param (
        [Parameter()]
        [string]
        $ResourceType
    )

    if ($versionsFileContents) {
        $info = $versionsFileContents | Where-Object { $_ -like "$ResourceType@*" }
        $versions = $info | ForEach-Object { $_ -replace ".*@", "" } | Sort-Object -Descending
        if (!$versions) {
            Write-Error "Could not find resource $ResourceType"
            return
        }
    }
    else {
        $namespace, $type = $ResourceType -split "/", 2

        if (!($providersCache.ContainsKey($namespace))) {
            Write-Host "Looking up provider $namespace..."
            $providerInfo = Get-AzResourceProvider -ProviderNamespace $namespace
            $providersCache[$namespace] = $providerInfo
            if (!$providerInfo) {
                Write-Error "Could not find resource provider $namespace"
                return
            }
        }
        else {
            $providerInfo = $providersCache[$namespace]
            if (!$providerInfo) {
                return
            }
        }

        $typeInfo = $providerInfo.ResourceTypes | Where-Object { $_.ResourceTypeName -eq $type }
        if (!$typeInfo) {
            Write-Error "Could not find resource $type on provider $namespace"
            return
        }

        $versions = $typeInfo.ApiVersions | Sort-Object -Descending
    }

    # Pick first version without "preview"
    $nonPreviews = $versions | Where-Object { $_ -notlike "*preview" }
    if ($nonPreviews.Length -eq 0) {
        Write-Warning "Couldn't find a non-preview version for $ResourceType"
        $versions[0]
    }
    else {
        $nonPreviews[0]
    }
}
