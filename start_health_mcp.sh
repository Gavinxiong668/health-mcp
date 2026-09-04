#!/bin/bash

# 加载用户的完整环境变量
source ~/.bashrc
source ~/.profile 2>/dev/null

# 如果 pnpm 通过 nvm 安装，加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 切换到项目目录
cd /home/gavin/health-mcp/health-mcp

# 执行 pnpm
pnpm start
