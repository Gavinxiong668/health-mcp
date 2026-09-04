module.exports = {
  apps: [{
    name: 'health-mcp',
    script: 'pnpm',
    args: 'start',
    cwd: '/home/gavin/health-mcp/health-mcp',
    env_file: '.env'
  }]
};
