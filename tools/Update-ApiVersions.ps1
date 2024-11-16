# Updates apiVersions in a file to the newest version supported by the resource provider (doesn't necessarily have a schema)
#
# INSTRUCTIONS:
#
# 1) Update tools\resourceTypesAndVersions.txt
#   a) Update schemas in the extension (this is automatic if ARM_LANGUAGE_SERVER_NUGET_VERSION is empty in package.json and the ARM-LanguageServer and WebTools-InternalTools-JsonSchemaZipBuilder pipelines are running regularly)
#   b) Open the updated extension in VS Code
#   c) Create an empty json file and run the "arm!" snippet to create a blank template target the resource group schema
#   d) Run this command: azurerm-vscode-tools.developer.showAvailableResourceTypesAndVersions
#   e) Repeat above two steps for the subscription, management group and tenant schemas
#   f) Copy the output in the output window to availableResourceTypesAndVersions.txt, replacing the old file contents (blank lines are ok)
#   g) Save availableResourceTypesAndVersions.txt
# 2) Update snippets
#   a) Start PowerShell
#   b) From repo root, run `pwsh ./tools/Update-ApiVersions.ps1`
#   c) Run tests and create PR
[CmdletBinding()]
param (
    # File or folder path
    [string[]]
    $Paths = @('./assets/resourceSnippets/','./test/snippets/expected/'),

    # If specified, use this file for available resource types/apiVersions (use azurerm-vscode-tools.developer.showAvailableResourceTypesAndVersions
    # command to generate), otherwise use calls to resource providers
    [string]
    $VersionsFile = './tools/resourceTypesAndVersions.txt'
)

$ErrorActionPreference = "Stop"

$providersCache = @{}
$versionsFileContents = @()

function FindUsedApiVersionsInJson {
    param (
        [Parameter(Mandatory)]
        [object]
        $json,

        [string]
        $ParentResourceType = ""
    )

    $uses = @()

    $resources = $json.Resources
    foreach ($resource in $resources) {
        $type = $resource.type
        if ($ParentResourceType -ne "") {
            $type = "$ParentResourceType/$type"
        }

        $apiVersion = $resource.apiVersion
        if ($type -ne "" -and $apiVersion -ne "") {
            $uses += "$type@$apiVersion"
        }

        # Handle child resources
        if ($resource.resources) {
            $uses += FindUsedApiVersionsInJson $resource $type
        }
    }

    $uses
}

function FindUsedApiVersionsInFile {
    param (
        [Parameter(Mandatory)]
        [string]
        $FilePath
    )

    $json = Get-Content $FilePath -Raw | ConvertFrom-Json
    $uses = FindUsedApiVersionsInJson $json
    $uses | Sort-Object
}

function GetApiVersion {
    param (
        [Parameter()]
        [string]
        $ResourceType
    )

    if ($versionsFileContents) {
        $info = $versionsFileContents | Where-Object { $_ -like "$ResourceType@*" }
        $versions = $info | ForEach-Object { $_ -replace ".*@", "" } | Sort-Object -Descending
        if (!$versions) {
            Write-Warning "Could not find resource $ResourceType"
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
                Write-Warning "Could not find resource provider $namespace"
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
            Write-Warning "Could not find resource $type on provider $namespace"
            return
        }

        $versions = [array]($typeInfo.ApiVersions | Sort-Object -Descending)
    }

    # Pick first version without "preview"
    $nonPreviews = [array] ($versions | Where-Object { $_ -notlike "*preview" })
    if ($nonPreviews.Length -eq 0) {
        Write-Warning "Couldn't find a non-preview version for $ResourceType"
        ([array]$versions)[0]
    }
    else {
        ([array]$nonPreviews)[0]
    }
}

function UpdateApiVersions {
    param (
        # File or folder path
        [string[]]
        $FilePaths
    )

    if ((Get-Item $FilePaths) -is [System.IO.DirectoryInfo]) {
        $FilePaths = (Get-ChildItem $FilePaths).FullName # Get all files in the folder
    }

    foreach ($FilePath in $FilePaths) {
        Write-Host $FilePath

        $content = Get-Content $FilePath -Raw
        $versions = FindUsedApiVersionsInFile $FilePath

        $versions | % {
            $type, $apiVersion = $_ -split "@"
            $newApiVersion = GetApiVersion $type
            if ($newApiVersion) {
                if ($newApiVersion -notmatch "[0-9]{4}-[0-9]{2}-[0-9]{2}") {
                    throw "Invalid API version found"
                }
                write-host "Looking to replace $type@$apiVersion with $type@$newApiVersion"

                # CONSIDER: Would be better to parse the JSON
                $pattern =
                '(?msix)' + # multiline, ignore whitespace, ignore case
                '"type":\s*"(?<type>[-a-z.\/]+)"' + # type
                '(?<between>(?:(?:"[^"]*"|[^"{\}])*))' + # skip any other properties that might come between the two, break if we see "{" or "}" except if they're inside double quotes
                 '"apiVersion":\s*"(?<version>[-a-zA-Z0-9]+)"' # apiVersion
                $content = $content -replace $pattern, {
                    $matchedType = $_.groups["type"].value
                    $middle = $_.groups["between"].value

                    # Use ends-with to allow matching child resource types, such as "secrets", which is shortened from the full "Microsoft.KeyVault/vaults/secrets"
                    if (($matchedType -eq $type) -or ($type -like "*/$matchedType")) {
                        Write-Host "... Replaced $matchedType@$apiVersion with $matchedType@$newApiVersion"
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

if ($VersionsFile) {
    $versionsFileContents += Get-Content $VersionsFile
}

foreach ($FilePath in $Paths) {
    UpdateApiVersions $FilePath
}
