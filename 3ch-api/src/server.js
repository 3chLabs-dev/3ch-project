const app = require("./app");

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API 동작중 : http://127.0.0.1:${PORT}/swagger`);
});
