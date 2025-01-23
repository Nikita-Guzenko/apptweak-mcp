# AppTweak MCP Server

An MCP server that provides tools for app store analytics and competitor analysis using the AppTweak API.

<a href="https://glama.ai/mcp/servers/ym377qzb03"><img width="380" height="200" src="https://glama.ai/mcp/servers/ym377qzb03/badge" alt="AppTweak Server MCP server" /></a>

## Features

- App store analytics
- Competitor analysis
- Keyword research
- Download estimates
- Rankings tracking

## Installation

1. Clone the repository:
```bash
git clone https://github.com/robertredbox/apptweak-mcp.git
cd apptweak-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

4. Add the server to your Cline MCP settings file (`cline_mcp_settings.json`):
```json
{
  "mcpServers": {
    "apptweak-server": {
      "command": "node",
      "args": ["/path/to/apptweak-mcp/build/index.js"],
      "env": {
        "APPTWEAK_API_KEY": "your-api-key-here"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

5. Get an AppTweak API key from [AppTweak's website](https://www.apptweak.com/) and add it to the configuration.

## Available Tools

- `search_app`: Search for an app by name and platform (ios/android)
- `get_app_details`: Get detailed information about an app by ID
- `analyze_top_keywords`: Analyze top keywords for apps including brand analysis and estimated installs
- `analyze_reviews`: Analyze app reviews and ratings to extract user satisfaction insights

## Usage

Once installed and configured, you can use the AppTweak tools through Cline. For example:

```
search for Spotify on the iOS App Store
analyze keywords for com.spotify.music on Android
get reviews for 324684580 on iOS
