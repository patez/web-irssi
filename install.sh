#!/bin/bash

set -e

echo "🚀 Web IRSSI Installation Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${BLUE}Detected OS: $OS${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
    
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}⚠ Node.js 18+ recommended (you have v$NODE_VERSION)${NC}"
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js 18+ first:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

# Check system dependencies
echo ""
echo -e "${YELLOW}Checking system dependencies...${NC}"

MISSING_DEPS=()

if ! command -v tmux &> /dev/null; then
    MISSING_DEPS+=("tmux")
fi

if ! command -v irssi &> /dev/null; then
    MISSING_DEPS+=("irssi")
fi

if ! command -v gcc &> /dev/null; then
    MISSING_DEPS+=("build-essential")
fi

if ! command -v python3 &> /dev/null; then
    MISSING_DEPS+=("python3")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${YELLOW}Missing dependencies: ${MISSING_DEPS[*]}${NC}"
    echo ""
    read -p "Install missing dependencies? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            sudo apt update
            sudo apt install -y ${MISSING_DEPS[@]}
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
            sudo yum install -y ${MISSING_DEPS[@]}
        else
            echo -e "${RED}Unsupported OS for auto-install${NC}"
            echo "Please install manually: ${MISSING_DEPS[*]}"
            exit 1
        fi
    else
        echo -e "${RED}Cannot continue without dependencies${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ All dependencies installed${NC}"

# Install npm packages
echo ""
echo -e "${YELLOW}Installing npm packages...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ npm packages installed${NC}"
else
    echo -e "${RED}✗ npm install failed${NC}"
    exit 1
fi

# Create .env if it doesn't exist
echo ""
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${NC}"
    echo -e "${YELLOW}⚠ Please edit .env with your settings:${NC}"
    echo "  nano .env"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi

# Create necessary directories
echo ""
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p irssi-sessions
chmod 755 irssi-sessions
echo -e "${GREEN}✓ Directories created${NC}"

# Test server startup
echo ""
echo -e "${YELLOW}Testing server startup...${NC}"
timeout 5 node server/index.js &> /dev/null &
SERVER_PID=$!
sleep 3

if ps -p $SERVER_PID > /dev/null; then
    kill $SERVER_PID 2>/dev/null
    echo -e "${GREEN}✓ Server starts successfully${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    echo "Check configuration and try: node server/index.js"
    exit 1
fi

# Installation complete
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Configure environment:"
echo "   nano .env"
echo ""
echo "2. Start the server:"
echo "   ${GREEN}npm start${NC}  (production)"
echo "   ${GREEN}npm run dev${NC}  (development)"
echo ""
echo "3. Or use PM2 for production:"
echo "   npm install -g pm2"
echo "   pm2 start server/index.js --name web-irssi"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "4. Access the application:"
echo "   http://localhost:3001"
echo ""
echo -e "${YELLOW}⚠ Don't forget to:${NC}"
echo "  - Edit .env with your settings"
echo "  - Set up email for user activation"
echo "  - Create your first admin user"
echo ""
echo -e "${BLUE}For help, see README.md${NC}"
echo ""
