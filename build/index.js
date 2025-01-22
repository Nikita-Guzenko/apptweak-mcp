#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
const API_KEY = process.env.APPTWEAK_API_KEY || '1U7ydYWbx1VYYj-bjyPXKwz5qIE';
if (!API_KEY) {
    throw new Error('APPTWEAK_API_KEY environment variable is required');
}
const BASE_URL = 'https://api.apptweak.com';
function isRatingBreakdown(obj) {
    return (obj &&
        typeof obj === 'object' &&
        typeof obj['1'] === 'number' &&
        typeof obj['2'] === 'number' &&
        typeof obj['3'] === 'number' &&
        typeof obj['4'] === 'number' &&
        typeof obj['5'] === 'number');
}
function isSearchAppArgs(args) {
    if (!args || typeof args !== 'object')
        return false;
    const a = args;
    return (typeof a.query === 'string' &&
        (a.platform === 'ios' || a.platform === 'android') &&
        (a.country === undefined || typeof a.country === 'string') &&
        (a.language === undefined || typeof a.language === 'string'));
}
function isGetAppDetailsArgs(args) {
    if (!args || typeof args !== 'object')
        return false;
    const a = args;
    return (typeof a.appId === 'string' &&
        (a.platform === 'ios' || a.platform === 'android') &&
        (a.country === undefined || typeof a.country === 'string') &&
        (a.language === undefined || typeof a.language === 'string'));
}
function isAnalyzeTopKeywordsArgs(args) {
    if (!args || typeof args !== 'object')
        return false;
    const a = args;
    return (Array.isArray(a.appIds) &&
        a.appIds.every(id => typeof id === 'string') &&
        (a.platform === 'ios' || a.platform === 'android') &&
        (a.country === undefined || typeof a.country === 'string') &&
        (a.limit === undefined || typeof a.limit === 'number') &&
        (a.sortBy === undefined || ['score', 'volume', 'rank'].includes(a.sortBy)));
}
function isAnalyzeReviewsArgs(args) {
    if (!args || typeof args !== 'object')
        return false;
    const a = args;
    return (typeof a.appId === 'string' &&
        (a.platform === 'ios' || a.platform === 'android') &&
        (a.country === undefined || typeof a.country === 'string') &&
        (a.language === undefined || typeof a.language === 'string'));
}
class AppTweakServer {
    constructor() {
        this.creditCost = 0;
        this.server = new Server({
            name: 'apptweak-server',
            version: '0.2.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.axiosInstance = axios.create({
            baseURL: BASE_URL,
            headers: {
                'X-Apptweak-Key': API_KEY,
            },
        });
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'search_app',
                    description: 'Search for an app by name and platform (ios/android)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'App name to search for',
                            },
                            platform: {
                                type: 'string',
                                enum: ['ios', 'android'],
                                description: 'Platform to search on (ios/android)',
                            },
                            country: {
                                type: 'string',
                                description: 'Two-letter country code (e.g., US, GB)',
                                default: 'US',
                            },
                            language: {
                                type: 'string',
                                description: 'Two-letter language code (e.g., en, fr)',
                                default: 'en',
                            },
                        },
                        required: ['query', 'platform'],
                    },
                },
                {
                    name: 'get_app_details',
                    description: 'Get detailed information about an app by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            appId: {
                                type: 'string',
                                description: 'App ID (e.g., com.example.app for Android or 123456789 for iOS)',
                            },
                            platform: {
                                type: 'string',
                                enum: ['ios', 'android'],
                                description: 'Platform (ios/android)',
                            },
                            country: {
                                type: 'string',
                                description: 'Two-letter country code (e.g., US, GB)',
                                default: 'US',
                            },
                            language: {
                                type: 'string',
                                description: 'Two-letter language code (e.g., en, fr)',
                                default: 'en',
                            },
                        },
                        required: ['appId', 'platform'],
                    },
                },
                {
                    name: 'analyze_top_keywords',
                    description: 'Analyze top keywords for apps including brand analysis and estimated installs',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            appIds: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                },
                                description: 'Array of app IDs to analyze',
                            },
                            platform: {
                                type: 'string',
                                enum: ['ios', 'android'],
                                description: 'Platform (ios/android)',
                            },
                            country: {
                                type: 'string',
                                description: 'Two-letter country code (e.g., US, GB)',
                                default: 'US',
                            },
                            limit: {
                                type: 'number',
                                description: 'Number of keywords to analyze per app (max 20)',
                                default: 10,
                                maximum: 20
                            },
                            sortBy: {
                                type: 'string',
                                enum: ['score', 'volume', 'rank'],
                                description: 'How to sort keyword suggestions',
                                default: 'score'
                            }
                        },
                        required: ['appIds', 'platform'],
                    },
                },
                {
                    name: 'analyze_reviews',
                    description: 'Analyze app reviews and ratings to extract user satisfaction insights',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            appId: {
                                type: 'string',
                                description: 'App ID to analyze reviews for'
                            },
                            platform: {
                                type: 'string',
                                enum: ['ios', 'android'],
                                description: 'Platform (ios/android)'
                            },
                            country: {
                                type: 'string',
                                description: 'Two-letter country code (e.g., US, GB)',
                                default: 'US'
                            },
                            language: {
                                type: 'string',
                                description: 'Filter reviews by language (e.g., en, es)',
                                default: 'en'
                            }
                        },
                        required: ['appId', 'platform']
                    }
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case 'search_app': {
                        if (!isSearchAppArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid search app arguments');
                        }
                        const { query, platform, country = 'US', language = 'en' } = request.params.arguments;
                        try {
                            const response = await this.axiosInstance.get(`/${platform}/searches.json`, {
                                params: { term: query, country, language },
                            });
                            return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
                        }
                        catch (error) {
                            if (axios.isAxiosError(error)) {
                                const errorDetails = {
                                    status: error.response?.status,
                                    statusText: error.response?.statusText,
                                    data: error.response?.data,
                                    headers: error.response?.headers,
                                    message: error.message
                                };
                                return {
                                    content: [{ type: 'text', text: `AppTweak API Error Details: ${JSON.stringify(errorDetails, null, 2)}` }],
                                    isError: true
                                };
                            }
                            throw error;
                        }
                    }
                    case 'get_app_details': {
                        if (!isGetAppDetailsArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid app details arguments');
                        }
                        const { appId, platform, country = 'US', language = 'en' } = request.params.arguments;
                        try {
                            const response = await this.axiosInstance.get(`/${platform}/applications/${appId}.json`, {
                                params: { country, language },
                            });
                            return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
                        }
                        catch (error) {
                            if (axios.isAxiosError(error)) {
                                const message = error.response?.status === 404
                                    ? `App ID "${appId}" not found. The app might not be available in ${country} or the app listing might have changed.`
                                    : `Failed to get app details: ${error.response?.data?.message || error.message}`;
                                return {
                                    content: [{ type: 'text', text: message }],
                                    isError: true
                                };
                            }
                            throw error;
                        }
                    }
                    case 'analyze_top_keywords': {
                        if (!isAnalyzeTopKeywordsArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid analyze top keywords arguments');
                        }
                        const { appIds, platform, country = 'US', limit = 10, sortBy = 'score' } = request.params.arguments;
                        const results = [];
                        for (const appId of appIds) {
                            try {
                                const response = await this.axiosInstance.get(`/${platform}/applications/${appId}/keywords/top.json`, {
                                    params: {
                                        country,
                                        sort: sortBy
                                    }
                                });
                                // Sort keywords by volume in descending order and filter out low volume keywords
                                const sortedKeywords = response.data.content
                                    .filter((k) => k.volume > 5) // Filter out very low volume keywords
                                    .sort((a, b) => b.volume - a.volume); // Sort by volume descending
                                // Then apply the limit
                                const limitedKeywords = sortedKeywords.slice(0, limit);
                                results.push({
                                    appId,
                                    keywords: limitedKeywords
                                });
                            }
                            catch (error) {
                                if (axios.isAxiosError(error)) {
                                    results.push({
                                        appId,
                                        error: `Failed to analyze keywords: ${error.response?.data?.message || error.message}`
                                    });
                                }
                                else {
                                    throw error;
                                }
                            }
                        }
                        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
                    }
                    case 'analyze_reviews': {
                        if (!isAnalyzeReviewsArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid analyze reviews arguments');
                        }
                        const { appId, platform, country = 'US', language = 'en' } = request.params.arguments;
                        try {
                            const response = await this.axiosInstance.get(`/${platform}/applications/${appId}.json`, {
                                params: { country, language }
                            });
                            const ratings = response.data.content.ratings;
                            if (!ratings) {
                                return {
                                    content: [{
                                            type: 'text',
                                            text: JSON.stringify({
                                                message: 'No ratings data available for this app',
                                                parameters: { appId, platform, country, language }
                                            }, null, 2)
                                        }]
                                };
                            }
                            const currentVersion = ratings.current_version;
                            const allVersions = ratings.all_versions;
                            const calculatePercentages = (starCount, total) => {
                                return Object.entries(starCount).reduce((acc, [star, count]) => {
                                    acc[`${star}_star`] = `${((count / total) * 100).toFixed(1)}%`;
                                    return acc;
                                }, {});
                            };
                            const calculateSentiment = (starCount, total) => {
                                const positive = starCount['5'] + starCount['4'];
                                const neutral = starCount['3'];
                                const negative = starCount['2'] + starCount['1'];
                                return {
                                    positive: `${((positive / total) * 100).toFixed(1)}%`,
                                    neutral: `${((neutral / total) * 100).toFixed(1)}%`,
                                    negative: `${((negative / total) * 100).toFixed(1)}%`
                                };
                            };
                            const analyzeIssues = (starCount, total) => {
                                const issues = [];
                                const lowRatings = starCount['1'] + starCount['2'];
                                const lowRatingPercentage = (lowRatings / total) * 100;
                                if (lowRatingPercentage > 20) {
                                    issues.push('High proportion of negative reviews (>20% 1-2 stars)');
                                }
                                const recentRatingDrop = currentVersion.average < allVersions.average - 0.2;
                                if (recentRatingDrop) {
                                    issues.push(`Rating drop in current version (${currentVersion.average.toFixed(2)} vs ${allVersions.average.toFixed(2)} overall)`);
                                }
                                return issues;
                            };
                            const analysis = {
                                currentVersion: {
                                    totalReviews: currentVersion.count,
                                    averageRating: currentVersion.average.toFixed(2),
                                    ratingDistribution: calculatePercentages(currentVersion.star_count, currentVersion.count),
                                    sentiment: calculateSentiment(currentVersion.star_count, currentVersion.count)
                                },
                                allVersions: {
                                    totalReviews: allVersions.count,
                                    averageRating: allVersions.average.toFixed(2),
                                    ratingDistribution: calculatePercentages(allVersions.star_count, allVersions.count),
                                    sentiment: calculateSentiment(allVersions.star_count, allVersions.count)
                                },
                                insights: {
                                    potentialIssues: analyzeIssues(currentVersion.star_count, currentVersion.count),
                                    ratingTrend: currentVersion.average >= allVersions.average ? 'Improving' : 'Declining'
                                },
                                metadata: {
                                    appId,
                                    platform,
                                    country,
                                    language,
                                    lastUpdated: response.data.metadata.content.last_updated_at
                                }
                            };
                            return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
                        }
                        catch (error) {
                            if (axios.isAxiosError(error)) {
                                return {
                                    content: [{
                                            type: 'text',
                                            text: `Failed to analyze reviews: ${error.response?.data?.message || error.message}`
                                        }],
                                    isError: true
                                };
                            }
                            throw error;
                        }
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `AppTweak API error: ${error.response?.data?.message ?? error.message}`,
                            },
                        ],
                        isError: true,
                    };
                }
                throw error;
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('AppTweak MCP server running on stdio');
    }
}
const server = new AppTweakServer();
server.run().catch(console.error);
