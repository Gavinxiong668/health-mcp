import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Ping 工具 - 用于测试 MCP 连接是否正常
 * 
 * 这是一个最简单的工具，不依赖任何外部服务，
 * 直接返回 'pong'，用于验证工具注册和调用链路是否通畅。
 */
export const registerPingTool = (server: McpServer) => {
  server.tool(
    'ping',
    '返回 pong，用于测试 MCP 连接是否正常。调用时参数为空对象 {}。',
    {}, // 无参数
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: 'pong'
          }
        ]
      };
    }
  );
};
