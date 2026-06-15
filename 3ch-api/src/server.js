const app = require("./app");
const http = require("http");
const { setupSupportChatSocket } = require("./services/supportChatSocket");

const PORT = Number(process.env.PORT || 3000);
const server = http.createServer(app);

setupSupportChatSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API 동작중 : http://127.0.0.1:${PORT}/swagger`);
});
