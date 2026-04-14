const express = require("express");
const mongoose = require("mongoose");
const Route = require("./models/Route");
const axios = require("axios");
const https = require("https");
const path = require("path");
const cookieParser = require("cookie-parser");
const { pathToRegexp, match } = require("path-to-regexp");
const { authenticate, router: authRoutes } = require("./routes/authRoutes");
const authUniversal = require("./middlewares/authUniversal");
const routeRoutes = require("./routes/routeRoutes");
const Log = require("./models/Log");
const logRoutes = require("./routes/logRoutes");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/healthgate", express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/healthgate/api/admin", routeRoutes);
app.use("/healthgate/api/admin", logRoutes);
app.use("/healthgate/api/auth", authRoutes);

mongoose
  .connect("mongodb://localhost:27017/healthgate", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB conectado"))
  .catch((err) => console.error(err));

app.get("/healthgate/login", (req, res) => {
  res.render("login");
});

app.get("/healthgate/routes", authUniversal, async (req, res) => {
  try {
    const routes = await Route.find();
    res.render("routes", { routes, user: req.user });
  } catch (error) {
    res.status(500).send("Erro ao carregar rotas");
  }
});

app.get("/healthgate/routes/new", authUniversal, (req, res) => {
  res.render("newRoute");
});

app.get("/healthgate/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/healthgate/login");
});

let fassECGToken = null;
let fassECGTokenExpiry = null;
async function getAccessTokenForFassECG() {
  const now = Date.now();

  if (fassECGToken && fassECGTokenExpiry && now < fassECGTokenExpiry) {
    return fassECGToken;
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", process.env.FASS_ECG_GRANT_TYPE);
    params.append("client_id", process.env.FASS_ECG_CLIENT_ID);
    params.append("client_secret", process.env.FASS_ECG_CLIENT_SECRET);

    const tokenResponse = await axios.post(
      process.env.FASS_ECG_AUTH_URL,
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
      },
    );

    const token = tokenResponse.data.access_token;

    // salva token e tempo de expiração (com margem de segurança)
    fassECGToken = token;
    fassECGTokenExpiry = now + tokenResponse.data.expires_in * 1000 - 5000;

    console.log("Novo token FASS_ECG obtido com sucesso");
    console.log("TOKEN:", token); // opcional pra debug

    return fassECGToken;
  } catch (error) {
    console.error(
      "Erro na obtenção do token:",
      error.response?.data || error.message,
    );
    throw new Error("Falha na autenticação");
  }
}
async function handleRequest(req, res, projectName) {
  try {
    const routes = await Route.find({
      method: req.method,
      nameProject: projectName,
    });
    if (!routes.length) {
      return res
        .status(404)
        .json({ message: "Nenhuma rota encontrada para o projeto" });
    }

    routes.sort((a, b) => {
      const countParams = (path) => (path.match(/{[^}]+}/g) || []).length;
      return (
        countParams(a.sourcePath) - countParams(b.sourcePath) ||
        a.sourcePath.localeCompare(b.sourcePath)
      );
    });

    let matchingRoute = null;
    let params = {};

    for (const route of routes) {
      const routeRegex = pathToRegexp(route.sourcePath);
      const matcher = match(route.sourcePath, { decode: decodeURIComponent });
      const matchResult = matcher(req.path);

      if (matchResult) {
        matchingRoute = route;
        params = matchResult.params;
        break;
      }
    }

    if (!matchingRoute) {
      return res.status(404).json({ message: "Rota não encontrada" });
    }

    let targetUrl = matchingRoute.targetUrl;
    Object.keys(params).forEach((param) => {
      targetUrl = targetUrl.replace(`:${param}`, params[param]);
    });
    console.log("Target URL final:", targetUrl);
    console.log("Params extraídos:", params);
    const queryParams = new URLSearchParams(req.query).toString();
    if (queryParams) targetUrl += `?${queryParams}`;

    // Monta os headers base
    let headers = {
      "content-type": "application/json",
      accept: "application/json",
    };

    // Sobrescreve content-type para PUT FHIR
    if (projectName === "FASS_ECG" && matchingRoute.method === "PUT") {
      headers["content-type"] = "application/fhir+json";
      headers["accept"] = "application/fhir+json";
    }

    // Adiciona Authorization
    if (projectName === "FASS_ECG") {
      headers["Authorization"] = `Bearer ${await getAccessTokenForFassECG()}`;
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    console.log("Headers enviados:", headers);
    console.log("Body enviado:", typeof req.body, req.body);

    const response = await axios({
      method: matchingRoute.method,
      url: targetUrl,
      headers: headers,
      // Passa o body diretamente — Axios serializa automaticamente quando
      // recebe um objeto e o content-type é application/json ou fhir+json
      data: req.body,
      httpsAgent: agent,
    });

    await Log.create({
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      statusCode: response.status,
      responseBody: response.data,
      projectName: projectName,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Erro ao redirecionar a requisição:", error);

    await Log.create({
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      statusCode: error.response?.status || 500,
      responseBody: error.response?.data || { error: error.message },
      projectName: projectName,
    });

    res.status(500).json({
      message: "Erro ao redirecionar a requisição",
      error: error.message,
    });
  }
}

app.use("/healthgate/api/fassecg", (req, res) =>
  handleRequest(req, res, "FASS_ECG"),
);
app.use("/healthgate/api/ifcloud", (req, res) =>
  handleRequest(req, res, "IF_CLOUD"),
);
app.use("/healthgate/api/h2cloud", (req, res) =>
  handleRequest(req, res, "H2CLOUD"),
);
app.listen(3001, () => console.log("Servidor rodando na porta 3001"));
