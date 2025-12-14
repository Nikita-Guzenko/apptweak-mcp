#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.APPTWEAK_API_KEY;
if (!API_KEY) {
  throw new Error('APPTWEAK_API_KEY environment variable is required');
}

const BASE_URL = 'https://public-api.apptweak.com/api/public';

// ============================================================================
// TYPES
// ============================================================================

type Platform = 'ios' | 'android';
type Device = 'iphone' | 'ipad' | 'android';
type ChartType = 'free' | 'paid' | 'grossing';
type KeywordSortBy = 'score' | 'volume' | 'ranking';

interface ApiResponse<T = any> {
  content: T;
  metadata?: Record<string, any>;
}

interface KeywordData {
  keyword: string;
  volume?: number;
  difficulty?: number;
  score?: number;
  ranking?: number;
  installs?: number;
  relevancy?: number;
}

interface AppData {
  id: string;
  title: string;
  developer?: string;
  icon?: string;
  rating?: number;
  ratings_count?: number;
  price?: number;
  description?: string;
  version?: string;
  release_date?: string;
  genres?: string[];
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS = [
  // ---- BASIC APP TOOLS ----
  {
    name: 'search_apps',
    description: 'Search for apps by name on App Store or Google Play. Returns list of matching apps with basic info.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'App name or search term' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform to search' },
        country: { type: 'string', description: 'Two-letter country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Two-letter language code (default: en)', default: 'en' },
        limit: { type: 'number', description: 'Max results (default: 10)', default: 10 }
      },
      required: ['query', 'platform']
    }
  },
  {
    name: 'get_app_metadata',
    description: 'Get full metadata for an app: title, description, screenshots, ratings, version, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID (bundle ID for Android, numeric ID for iOS)' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' }
      },
      required: ['appId', 'platform']
    }
  },
  {
    name: 'get_app_metrics',
    description: 'Get estimated downloads and revenue for an app. Requires app to rank in top charts.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        metrics: {
          type: 'array',
          items: { type: 'string', enum: ['downloads', 'revenue', 'ratings'] },
          description: 'Metrics to fetch (default: all)',
          default: ['downloads', 'revenue', 'ratings']
        }
      },
      required: ['appId', 'platform']
    }
  },

  // ---- KEYWORD RESEARCH TOOLS ----
  {
    name: 'get_keyword_suggestions',
    description: 'Get keyword suggestions based on an app. Returns keywords the app ranks for with volume, difficulty, and estimated installs.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID to get suggestions for' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        sortBy: { type: 'string', enum: ['score', 'volume', 'ranking'], description: 'Sort order (default: score)', default: 'score' },
        limit: { type: 'number', description: 'Max keywords (default: 50)', default: 50 }
      },
      required: ['appId', 'platform']
    }
  },
  {
    name: 'get_category_keywords',
    description: 'Get top keywords for a category. Useful for discovering keywords in your niche.',
    inputSchema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', description: 'Category ID (e.g., "6002" for Utilities on iOS)' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        limit: { type: 'number', description: 'Max keywords (default: 100)', default: 100 }
      },
      required: ['categoryId', 'platform']
    }
  },
  {
    name: 'get_trending_keywords',
    description: 'Get trending keywords shown in App Store search tab. iOS only.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        device: { type: 'string', enum: ['iphone', 'ipad'], description: 'Device (default: iphone)', default: 'iphone' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD (default: 7 days ago)' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' }
      },
      required: []
    }
  },
  {
    name: 'get_keyword_metrics',
    description: 'Get metrics for specific keywords: search volume, difficulty, and top apps.',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'array', items: { type: 'string' }, description: 'List of keywords to analyze' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' }
      },
      required: ['keywords', 'platform']
    }
  },
  {
    name: 'get_app_keyword_rankings',
    description: 'Get current keyword rankings for an app. Shows position, volume, and estimated installs per keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords to check rankings for' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' }
      },
      required: ['appId', 'platform', 'keywords']
    }
  },
  {
    name: 'keyword_live_search',
    description: 'Perform a live search on the store and get organic results. Shows exactly what users see.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Keyword to search' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        limit: { type: 'number', description: 'Max results (default: 10)', default: 10 }
      },
      required: ['keyword', 'platform']
    }
  },

  // ---- COMPETITOR & MARKET TOOLS ----
  {
    name: 'get_top_charts',
    description: 'Get top charts for a category. Shows top free, paid, or grossing apps.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        categoryId: { type: 'string', description: 'Category ID (optional, defaults to overall)' },
        chartType: { type: 'string', enum: ['free', 'paid', 'grossing'], description: 'Chart type (default: free)', default: 'free' },
        limit: { type: 'number', description: 'Max results (default: 100)', default: 100 }
      },
      required: ['platform']
    }
  },
  {
    name: 'get_category_ranking',
    description: "Get an app's current ranking in its category charts.",
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' }
      },
      required: ['appId', 'platform']
    }
  },
  {
    name: 'get_app_reviews',
    description: 'Get app reviews with filtering options. Useful for sentiment analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        rating: { type: 'number', description: 'Filter by star rating (1-5)' },
        limit: { type: 'number', description: 'Max reviews (default: 50)', default: 50 }
      },
      required: ['appId', 'platform']
    }
  },

  // ---- AD INTELLIGENCE ----
  {
    name: 'get_paid_keywords',
    description: 'Get keywords an app is bidding on in Apple Search Ads. Reveals competitor ad strategy.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD (default: 30 days ago)' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' }
      },
      required: ['appId', 'platform']
    }
  },

  // ---- HIGH-LEVEL ASO TOOLS ----
  {
    name: 'analyze_competitors',
    description: 'Comprehensive competitor analysis: compare your app with competitors on keywords, rankings, and performance.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Your app ID' },
        competitorIds: { type: 'array', items: { type: 'string' }, description: 'Competitor app IDs' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' }
      },
      required: ['appId', 'competitorIds', 'platform']
    }
  },
  {
    name: 'find_keyword_opportunities',
    description: "Find keyword opportunities: keywords competitors rank for but you don't, high-volume low-competition keywords.",
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Your app ID' },
        competitorIds: { type: 'array', items: { type: 'string' }, description: 'Competitor app IDs to analyze' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        minVolume: { type: 'number', description: 'Minimum keyword volume (default: 20)', default: 20 },
        maxDifficulty: { type: 'number', description: 'Maximum keyword difficulty (default: 70)', default: 70 }
      },
      required: ['appId', 'competitorIds', 'platform']
    }
  },
  {
    name: 'get_aso_report',
    description: 'Generate comprehensive ASO report for an app: keywords, rankings, competitors, opportunities, recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        country: { type: 'string', description: 'Country code (default: US)', default: 'US' },
        language: { type: 'string', description: 'Language code (default: en)', default: 'en' },
        includeCompetitors: { type: 'boolean', description: 'Auto-detect and include competitors (default: true)', default: true }
      },
      required: ['appId', 'platform']
    }
  },
  {
    name: 'get_localization_keywords',
    description: 'Get optimized keywords for multiple countries/languages. Essential for localization.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        platform: { type: 'string', enum: ['ios', 'android'], description: 'Platform' },
        countries: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'Country codes to analyze (e.g., ["US", "DE", "JP", "BR"])'
        },
        keywordsPerCountry: { type: 'number', description: 'Keywords per country (default: 30)', default: 30 }
      },
      required: ['appId', 'platform', 'countries']
    }
  },
  {
    name: 'check_api_credits',
    description: 'Check remaining API credits balance.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ============================================================================
// API CLIENT
// ============================================================================

class AppTweakAPI {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'X-Apptweak-Key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.get<ApiResponse<T>>(endpoint, { params });
      return response.data.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        const message = axiosError.response?.data?.message || axiosError.message;
        const status = axiosError.response?.status;
        throw new Error(`AppTweak API error (${status}): ${message}`);
      }
      throw error;
    }
  }

  // ---- Basic App Methods ----
  
  async searchApps(platform: Platform, query: string, country: string, language: string) {
    return this.request<any[]>(`/${platform}/searches.json`, {
      term: query,
      country,
      language
    });
  }

  async getAppMetadata(platform: Platform, appId: string, country: string, language: string) {
    return this.request<any>(`/${platform}/applications/${appId}/metadata.json`, {
      country,
      language
    });
  }

  async getAppMetrics(platform: Platform, appId: string, country: string, metrics: string[]) {
    return this.request<any>(`/${platform}/applications/${appId}/metrics.json`, {
      country,
      metrics: metrics.join(',')
    });
  }

  // ---- Keyword Methods ----

  async getKeywordSuggestions(platform: Platform, appId: string, country: string, language: string, sort: string) {
    return this.request<KeywordData[]>(`/${platform}/keywords/suggestions/app.json`, {
      id: appId,
      country,
      language,
      sort
    });
  }

  async getCategoryKeywords(platform: Platform, categoryId: string, country: string, language: string) {
    return this.request<KeywordData[]>(`/${platform}/keywords/suggestions/category.json`, {
      category: categoryId,
      country,
      language
    });
  }

  async getTrendingKeywords(country: string, language: string, device: string, startDate: string, endDate: string) {
    return this.request<any[]>(`/ios/keywords/suggestions/trending.json`, {
      country,
      language,
      device,
      start_date: startDate,
      end_date: endDate
    });
  }

  async getKeywordMetrics(platform: Platform, keywords: string[], country: string, language: string) {
    return this.request<any>(`/${platform}/keywords/metrics/current.json`, {
      keywords: keywords.join(','),
      country,
      language,
      metrics: 'volume,difficulty'
    });
  }

  async getAppKeywordRankings(platform: Platform, appId: string, keywords: string[], country: string, language: string) {
    return this.request<any>(`/${platform}/applications/${appId}/keywords/rankings/current.json`, {
      keywords: keywords.join(','),
      country,
      language,
      metrics: 'ranking,volume,installs,relevancy'
    });
  }

  async keywordLiveSearch(platform: Platform, keyword: string, country: string, language: string) {
    return this.request<any[]>(`/${platform}/keywords/search-results/current.json`, {
      keyword,
      country,
      language
    });
  }

  async getTopKeywords(platform: Platform, appId: string, country: string, sort: string) {
    return this.request<KeywordData[]>(`/${platform}/applications/${appId}/keywords/top.json`, {
      country,
      sort
    });
  }

  // ---- Market & Competitor Methods ----

  async getTopCharts(platform: Platform, country: string, categoryId: string | undefined, chartType: ChartType, limit: number) {
    const params: Record<string, any> = {
      country,
      type: chartType,
      num: limit
    };
    if (categoryId) {
      params.categories = categoryId;
    }
    return this.request<any[]>(`/${platform}/rankings/top-charts/current.json`, params);
  }

  async getCategoryRanking(platform: Platform, appId: string, country: string) {
    return this.request<any>(`/${platform}/applications/${appId}/category-rankings/current.json`, {
      country
    });
  }

  async getAppReviews(platform: Platform, appId: string, country: string, language: string, rating?: number, limit: number = 50) {
    const params: Record<string, any> = {
      country,
      language,
      limit
    };
    if (rating) {
      params.ratings = rating.toString();
    }
    return this.request<any[]>(`/${platform}/applications/${appId}/reviews.json`, params);
  }

  // ---- Ad Intelligence ----

  async getPaidKeywords(platform: Platform, appId: string, country: string, startDate: string, endDate: string) {
    return this.request<any>(`/${platform}/applications/${appId}/paid-keywords.json`, {
      country,
      start_date: startDate,
      end_date: endDate,
      aggregated: true
    });
  }

  // ---- Utility ----

  async checkCredits() {
    return this.request<any>('/usage.json', {});
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function today(): string {
  return formatDate(new Date());
}

// ============================================================================
// MCP SERVER
// ============================================================================

class AppTweakMCPServer {
  private server: Server;
  private api: AppTweakAPI;

  constructor() {
    this.api = new AppTweakAPI(API_KEY!);
    
    this.server = new Server(
      {
        name: 'apptweak-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.executeTool(name, args || {});
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    });
  }

  private async executeTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      // ---- BASIC APP TOOLS ----
      case 'search_apps': {
        const { query, platform, country = 'US', language = 'en', limit = 10 } = args;
        const results = await this.api.searchApps(platform, query, country, language);
        return Array.isArray(results) ? results.slice(0, limit) : results;
      }

      case 'get_app_metadata': {
        const { appId, platform, country = 'US', language = 'en' } = args;
        return this.api.getAppMetadata(platform, appId, country, language);
      }

      case 'get_app_metrics': {
        const { appId, platform, country = 'US', metrics = ['downloads', 'revenue', 'ratings'] } = args;
        return this.api.getAppMetrics(platform, appId, country, metrics);
      }

      // ---- KEYWORD RESEARCH TOOLS ----
      case 'get_keyword_suggestions': {
        const { appId, platform, country = 'US', language = 'en', sortBy = 'score', limit = 50 } = args;
        const results = await this.api.getKeywordSuggestions(platform, appId, country, language, sortBy);
        return Array.isArray(results) ? results.slice(0, limit) : results;
      }

      case 'get_category_keywords': {
        const { categoryId, platform, country = 'US', language = 'en', limit = 100 } = args;
        const results = await this.api.getCategoryKeywords(platform, categoryId, country, language);
        return Array.isArray(results) ? results.slice(0, limit) : results;
      }

      case 'get_trending_keywords': {
        const { country = 'US', language = 'en', device = 'iphone', startDate, endDate } = args;
        const start = startDate || getDaysAgo(7);
        const end = endDate || today();
        return this.api.getTrendingKeywords(country, language, device, start, end);
      }

      case 'get_keyword_metrics': {
        const { keywords, platform, country = 'US', language = 'en' } = args;
        return this.api.getKeywordMetrics(platform, keywords, country, language);
      }

      case 'get_app_keyword_rankings': {
        const { appId, platform, keywords, country = 'US', language = 'en' } = args;
        return this.api.getAppKeywordRankings(platform, appId, keywords, country, language);
      }

      case 'keyword_live_search': {
        const { keyword, platform, country = 'US', language = 'en', limit = 10 } = args;
        const results = await this.api.keywordLiveSearch(platform, keyword, country, language);
        return Array.isArray(results) ? results.slice(0, limit) : results;
      }

      // ---- COMPETITOR & MARKET TOOLS ----
      case 'get_top_charts': {
        const { platform, country = 'US', categoryId, chartType = 'free', limit = 100 } = args;
        return this.api.getTopCharts(platform, country, categoryId, chartType, limit);
      }

      case 'get_category_ranking': {
        const { appId, platform, country = 'US' } = args;
        return this.api.getCategoryRanking(platform, appId, country);
      }

      case 'get_app_reviews': {
        const { appId, platform, country = 'US', language = 'en', rating, limit = 50 } = args;
        return this.api.getAppReviews(platform, appId, country, language, rating, limit);
      }

      // ---- AD INTELLIGENCE ----
      case 'get_paid_keywords': {
        const { appId, platform, country = 'US', startDate, endDate } = args;
        const start = startDate || getDaysAgo(30);
        const end = endDate || today();
        return this.api.getPaidKeywords(platform, appId, country, start, end);
      }

      // ---- HIGH-LEVEL ASO TOOLS ----
      case 'analyze_competitors': {
        return this.analyzeCompetitors(args);
      }

      case 'find_keyword_opportunities': {
        return this.findKeywordOpportunities(args);
      }

      case 'get_aso_report': {
        return this.generateASOReport(args);
      }

      case 'get_localization_keywords': {
        return this.getLocalizationKeywords(args);
      }

      case 'check_api_credits': {
        return this.api.checkCredits();
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  }

  // ---- HIGH-LEVEL METHODS ----

  private async analyzeCompetitors(args: Record<string, any>): Promise<any> {
    const { appId, competitorIds, platform, country = 'US', language = 'en' } = args;
    
    const allAppIds = [appId, ...competitorIds];
    const results: Record<string, any> = {
      yourApp: { id: appId },
      competitors: [],
      keywordComparison: [],
      summary: {}
    };

    // Fetch data for all apps in parallel
    const [appMetadataResults, keywordResults] = await Promise.all([
      Promise.all(allAppIds.map(id => 
        this.api.getAppMetadata(platform, id, country, language).catch(e => ({ error: e.message, id }))
      )),
      Promise.all(allAppIds.map(id => 
        this.api.getTopKeywords(platform, id, country, 'score').catch(e => [] as KeywordData[])
      ))
    ]);

    // Process your app
    results.yourApp.metadata = appMetadataResults[0];
    const yourKw = keywordResults[0];
    results.yourApp.keywords = Array.isArray(yourKw) ? yourKw.slice(0, 30) : [];

    // Process competitors
    for (let i = 1; i < allAppIds.length; i++) {
      const compKw = keywordResults[i];
      results.competitors.push({
        id: allAppIds[i],
        metadata: appMetadataResults[i],
        keywords: Array.isArray(compKw) ? compKw.slice(0, 30) : []
      });
    }

    // Find shared and unique keywords
    const yourKeywords = new Set((results.yourApp.keywords as KeywordData[]).map(k => k.keyword));
    const competitorKeywords: Map<string, { count: number; apps: string[] }> = new Map();

    for (const comp of results.competitors) {
      if (Array.isArray(comp.keywords)) {
        for (const kw of comp.keywords as KeywordData[]) {
          const existing = competitorKeywords.get(kw.keyword);
          if (existing) {
            existing.count++;
            existing.apps.push(comp.id);
          } else {
            competitorKeywords.set(kw.keyword, { count: 1, apps: [comp.id] });
          }
        }
      }
    }

    // Keywords you're missing
    const missingKeywords: Array<{ keyword: string; competitorCount: number; competitors: string[] }> = [];
    for (const [keyword, data] of competitorKeywords) {
      if (!yourKeywords.has(keyword)) {
        missingKeywords.push({
          keyword,
          competitorCount: data.count,
          competitors: data.apps
        });
      }
    }

    results.keywordOpportunities = missingKeywords
      .sort((a, b) => b.competitorCount - a.competitorCount)
      .slice(0, 20);

    results.summary = {
      totalCompetitors: competitorIds.length,
      yourKeywordCount: yourKeywords.size,
      keywordOpportunities: missingKeywords.length
    };

    return results;
  }

  private async findKeywordOpportunities(args: Record<string, any>): Promise<any> {
    const { appId, competitorIds, platform, country = 'US', language = 'en', minVolume = 20, maxDifficulty = 70 } = args;
    
    // Get your keywords
    const yourKeywords = await this.api.getTopKeywords(platform, appId, country, 'score')
      .catch(() => []);
    const yourKeywordSet = new Set((yourKeywords as KeywordData[]).map(k => k.keyword));

    // Get competitor keywords
    const competitorKeywordPromises = competitorIds.map((id: string) => 
      this.api.getTopKeywords(platform, id, country, 'score').catch(() => [])
    );
    const competitorKeywordsResults = await Promise.all(competitorKeywordPromises);

    // Aggregate competitor keywords
    const keywordData: Map<string, { keyword: string; volume?: number; difficulty?: number; competitorCount: number }> = new Map();
    
    for (const keywords of competitorKeywordsResults) {
      if (Array.isArray(keywords)) {
        for (const kw of keywords as KeywordData[]) {
          if (!yourKeywordSet.has(kw.keyword)) {
            const existing = keywordData.get(kw.keyword);
            if (existing) {
              existing.competitorCount++;
            } else {
              keywordData.set(kw.keyword, {
                keyword: kw.keyword,
                volume: kw.volume,
                difficulty: kw.difficulty,
                competitorCount: 1
              });
            }
          }
        }
      }
    }

    // Filter and sort opportunities
    const opportunities = Array.from(keywordData.values())
      .filter(k => {
        const volumeOk = !k.volume || k.volume >= minVolume;
        const difficultyOk = !k.difficulty || k.difficulty <= maxDifficulty;
        return volumeOk && difficultyOk;
      })
      .sort((a, b) => {
        // Score: higher volume, lower difficulty, more competitors = better
        const scoreA = (a.volume || 0) * (1 - (a.difficulty || 50) / 100) * a.competitorCount;
        const scoreB = (b.volume || 0) * (1 - (b.difficulty || 50) / 100) * b.competitorCount;
        return scoreB - scoreA;
      })
      .slice(0, 50);

    return {
      opportunities,
      summary: {
        totalOpportunities: keywordData.size,
        filteredOpportunities: opportunities.length,
        filters: { minVolume, maxDifficulty }
      }
    };
  }

  private async generateASOReport(args: Record<string, any>): Promise<any> {
    const { appId, platform, country = 'US', language = 'en', includeCompetitors = true } = args;

    const report: Record<string, any> = {
      app: { id: appId },
      generatedAt: new Date().toISOString(),
      country,
      language,
      platform
    };

    // Fetch app data
    try {
      report.app.metadata = await this.api.getAppMetadata(platform, appId, country, language);
    } catch (e) {
      report.app.metadataError = (e as Error).message;
    }

    // Fetch keywords
    try {
      const keywords = await this.api.getTopKeywords(platform, appId, country, 'score');
      report.keywords = {
        total: Array.isArray(keywords) ? keywords.length : 0,
        top: Array.isArray(keywords) ? keywords.slice(0, 20) : []
      };
    } catch (e) {
      report.keywordsError = (e as Error).message;
    }

    // Fetch category ranking
    try {
      report.categoryRanking = await this.api.getCategoryRanking(platform, appId, country);
    } catch (e) {
      report.categoryRankingError = (e as Error).message;
    }

    // Auto-detect competitors from keyword search if requested
    if (includeCompetitors && report.keywords?.top?.length > 0) {
      try {
        const topKeyword = report.keywords.top[0].keyword;
        const searchResults = await this.api.keywordLiveSearch(platform, topKeyword, country, language);
        if (Array.isArray(searchResults)) {
          report.competitors = searchResults
            .filter((app: any) => app.id !== appId)
            .slice(0, 5)
            .map((app: any) => ({
              id: app.id,
              title: app.title,
              rating: app.rating
            }));
        }
      } catch (e) {
        report.competitorsError = (e as Error).message;
      }
    }

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  private generateRecommendations(report: Record<string, any>): string[] {
    const recommendations: string[] = [];

    // Based on keywords
    if (report.keywords?.total < 20) {
      recommendations.push('Your app ranks for few keywords. Consider optimizing title, subtitle, and description with more relevant keywords.');
    }

    // Based on rating
    if (report.app?.metadata?.rating < 4.0) {
      recommendations.push('Your app rating is below 4.0. Focus on addressing user complaints in reviews to improve rating.');
    }

    // Based on category ranking
    if (!report.categoryRanking || report.categoryRanking.ranking > 100) {
      recommendations.push('Your app is not in top 100 of its category. Improve ASO and consider running Apple Search Ads.');
    }

    // General recommendations
    recommendations.push('Regularly update your app metadata based on trending and high-volume keywords.');
    recommendations.push('Monitor competitor keywords and add relevant ones to your metadata.');
    recommendations.push('Use localization to expand to new markets.');

    return recommendations;
  }

  private async getLocalizationKeywords(args: Record<string, any>): Promise<any> {
    const { appId, platform, countries, keywordsPerCountry = 30 } = args;
    
    const results: Record<string, any> = {};

    // Process countries in parallel (with rate limiting consideration)
    const batchSize = 3;
    for (let i = 0; i < countries.length; i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (country: string) => {
          try {
            const keywords = await this.api.getKeywordSuggestions(platform, appId, country, 'en', 'score');
            return {
              country,
              keywords: Array.isArray(keywords) ? keywords.slice(0, keywordsPerCountry) : [],
              error: null
            };
          } catch (e) {
            return {
              country,
              keywords: [],
              error: (e as Error).message
            };
          }
        })
      );

      for (const result of batchResults) {
        results[result.country] = {
          keywords: result.keywords,
          error: result.error
        };
      }
    }

    return {
      appId,
      platform,
      countries: results,
      summary: {
        totalCountries: countries.length,
        successfulCountries: Object.values(results).filter((r: any) => !r.error).length
      }
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AppTweak MCP Server v2.0.0 running');
  }
}

// ============================================================================
// START SERVER
// ============================================================================

const server = new AppTweakMCPServer();
server.run().catch(console.error);
