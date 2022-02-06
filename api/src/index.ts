import { createServer } from "http";
import { Socket } from "net";
import { URL } from "url";
import { WebSocketServer } from "ws";

import { App, Client } from "./app";

const webSocketServer = new WebSocketServer({ noServer: true });

const webServer = createServer((req, resp) => {
  resp.end();
});

const app = new App();

webServer.on("upgrade", (req, socket, head) => {
  webSocketServer.handleUpgrade(req, socket as Socket, head, (ws) => {
    webSocketServer.emit("connection", ws, req);
  });
});

webSocketServer.on("connection", (socket, req) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost/");

  const channel = app.getChannel(pathname.substring(1));

  console.log("client connected to channel %s", channel.name);

  const client = new Client((action) => {
    try {
      socket.send(JSON.stringify(action));
    } catch (err) {
      console.error("failed to encode action", err);
    }
  });
  channel.addClient(client);

  socket.on("message", (data) => {
    console.log("action received in channel %s: %s", channel.name, data);

    try {
      const action = JSON.parse(data.toString());
      channel.handleAction(action, client);
    } catch (err) {
      console.error("failed to parse action", err);
    }
  });

  socket.on("close", (code) => {
    console.log("client disconnected from channel %s", channel.name);

    channel.removeClient(client);
    app.attemptDisposeChannel(channel.name);
  });
});

webServer.listen(parseInt(process.env.PORT || "3000", 10));
