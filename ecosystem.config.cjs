module.exports = {
  apps: [{
    name: "web-irssi",
    script: "./server/index.js",
    // 🚀 This is key: Ensure the environment is identical to your manual test
    env: {
      NODE_ENV: "production",
      PATH: process.env.PATH, 
      TERM: "xterm-256color"
    },
    // Prevent PM2 from killing the 'orphaned' tmux process
    kill_timeout: 3000,
    wait_ready: true
  }]
}
