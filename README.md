# AppTweak MCP Server v2.0

A comprehensive Model Context Protocol (MCP) server for AppTweak API. Enables AI assistants to perform full ASO (App Store Optimization) workflows using natural language.

## Features

### Basic App Tools
- **search_apps** - Search for apps on App Store or Google Play
- **get_app_metadata** - Get full app metadata (title, description, screenshots, ratings)
- **get_app_metrics** - Get estimated downloads and revenue

### Keyword Research
- **get_keyword_suggestions** - Get keyword recommendations based on an app
- **get_category_keywords** - Get top keywords for a category
- **get_trending_keywords** - Get trending keywords from App Store (iOS only)
- **get_keyword_metrics** - Get search volume and difficulty for keywords
- **get_app_keyword_rankings** - Check app rankings for specific keywords
- **keyword_live_search** - Perform live search and see organic results

### Market Intelligence
- **get_top_charts** - Get top free/paid/grossing charts
- **get_category_ranking** - Get app's position in category charts
- **get_app_reviews** - Fetch and analyze app reviews

### Ad Intelligence
- **get_paid_keywords** - See keywords competitors bid on in Apple Search Ads

### High-Level ASO Tools
- **analyze_competitors** - Comprehensive competitor comparison
- **find_keyword_opportunities** - Discover keywords competitors rank for
- **get_aso_report** - Generate full ASO report with recommendations
- **get_localization_keywords** - Get optimized keywords for multiple countries

### Utility
- **check_api_credits** - Check remaining API credits

## Installation

### Prerequisites
- Node.js 18+
- AppTweak API key ([Get one here](https://www.apptweak.com/))

### Setup

1. Clone the repository:
```bash
git clone https://github.com/TranslateMe/apptweak-mcp.git
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

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apptweak": {
      "command": "node",
      "args": ["/absolute/path/to/apptweak-mcp/build/index.js"],
      "env": {
        "APPTWEAK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude CLI

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "apptweak": {
      "command": "node",
      "args": ["/absolute/path/to/apptweak-mcp/build/index.js"],
      "env": {
        "APPTWEAK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage Examples

### Basic Usage

```
Search for meditation apps on iOS in the US
```

```
Get metadata for app ID 1234567890 on iOS
```

### Keyword Research

```
Get keyword suggestions for my app com.example.myapp on Android in Germany
```

```
What are the top keywords in the Utilities category on iOS?
```

```
Check my rankings for keywords: "meditation", "sleep", "relax" on iOS US
```

### Competitor Analysis

```
Analyze my competitors: compare my app 1234567890 with competitors 
9876543210, 5555555555 on iOS in the US
```

```
Find keyword opportunities my competitors rank for but I don't
```

### Full ASO Workflow

```
Generate a complete ASO report for my app com.example.myapp on Android US
```

```
Get localized keywords for my app in US, Germany, Japan, and Brazil
```

### Market Research

```
Show me the top 50 free apps in the Health & Fitness category on iOS US
```

```
What keywords is my competitor bidding on in Apple Search Ads?
```

## Tool Reference

### search_apps
Search for apps by name.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Search term |
| platform | ios/android | Yes | - | Platform |
| country | string | No | US | Country code |
| language | string | No | en | Language code |
| limit | number | No | 10 | Max results |

### get_keyword_suggestions
Get keyword suggestions for an app.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appId | string | Yes | - | App ID |
| platform | ios/android | Yes | - | Platform |
| country | string | No | US | Country code |
| language | string | No | en | Language code |
| sortBy | score/volume/ranking | No | score | Sort order |
| limit | number | No | 50 | Max keywords |

### analyze_competitors
Comprehensive competitor analysis.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appId | string | Yes | - | Your app ID |
| competitorIds | string[] | Yes | - | Competitor IDs |
| platform | ios/android | Yes | - | Platform |
| country | string | No | US | Country code |
| language | string | No | en | Language code |

### find_keyword_opportunities
Find keywords competitors rank for but you don't.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appId | string | Yes | - | Your app ID |
| competitorIds | string[] | Yes | - | Competitor IDs |
| platform | ios/android | Yes | - | Platform |
| country | string | No | US | Country code |
| minVolume | number | No | 20 | Min keyword volume |
| maxDifficulty | number | No | 70 | Max difficulty |

### get_localization_keywords
Get keywords for multiple countries.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appId | string | Yes | - | App ID |
| platform | ios/android | Yes | - | Platform |
| countries | string[] | Yes | - | Country codes |
| keywordsPerCountry | number | No | 30 | Keywords per country |

## API Credits

AppTweak API uses a credit system. Different endpoints cost different amounts:
- Metadata: 10 credits/app
- Keywords: 5-20 credits depending on endpoint
- Reviews: 10 credits/request

Use `check_api_credits` to monitor your balance.

## Country & Language Codes

Common country codes: US, GB, DE, FR, JP, KR, CN, BR, RU, IN

Common language codes: en, de, fr, ja, ko, zh, pt, ru, hi

See [AppTweak documentation](https://developers.apptweak.com/reference/country-codes) for full list.

## Category IDs

### iOS (App Store)
- 6000: Business
- 6002: Utilities
- 6003: Travel
- 6005: Social Networking
- 6006: Reference
- 6007: Productivity
- 6008: Photo & Video
- 6009: News
- 6012: Lifestyle
- 6013: Health & Fitness
- 6014: Games
- 6015: Finance
- 6016: Entertainment
- 6017: Education
- 6018: Books
- 6020: Medical
- 6021: Magazines & Newspapers
- 6022: Catalogs
- 6023: Food & Drink
- 6024: Navigation
- 6025: Music
- 6026: Sports
- 6027: Weather

### Android (Google Play)
See [AppTweak documentation](https://developers.apptweak.com/reference/google-play-store-categories) for full list.

## License

MIT

## Credits

- Original MCP server by [punkpeye](https://github.com/punkpeye/apptweak-mcp)
- Extended version by [731Labs](https://github.com/TranslateMe)
- Powered by [AppTweak API](https://www.apptweak.com/)
