module.exports = {
  apps: [
    {
      name: 'health-mcp',
      script: 'pnpm',
      args: 'start',
      cwd: '/home/gavin/health-mcp/health-mcp',
      env: {
        HEALTH_MCP_TOKEN: '5f2ce1a7603644eece05a2a4fe2c2ac3'
      }
    }
  ]
};
